import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetch-all';
import { getTodayDate, getDayName } from '@/lib/waktu';

const ACTIVE_DAYS = 14;
const BATAS_JAM_PULANG = process.env.BATAS_JAM_PULANG || '18:00';

function getCurrentTimeWita(): string {
  const wita = new Date(Date.now() + 8 * 3600 * 1000);
  return wita.toISOString().slice(11, 16);
}

function getThresholdDateWita(daysAgo: number): string {
  const wita = new Date(Date.now() + 8 * 3600 * 1000);
  wita.setUTCDate(wita.getUTCDate() - daysAgo);
  return wita.toISOString().slice(0, 10);
}

function isWeekendOrFriday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 5 || day === 6;
}

function generateDateRange(startStr: string, endStr: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
    return [];
  }
  const dates: string[] = [];
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (cur <= end && dates.length < 730) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

async function getCustomHolidaysMap() {
  const { data } = await supabase
    .from('admin_log')
    .select('id, aksi, sesudah')
    .eq('tabel', 'hari_libur')
    .order('id', { ascending: true });

  const map = new Map<string, string>();
  for (const row of data || []) {
    const info = row.sesudah as any;
    if (row.aksi === 'tambah_libur' && info?.tanggal) {
      map.set(String(info.tanggal), String(info.keterangan || 'Hari Libur Nasional'));
    } else if (row.aksi === 'hapus_libur' && info?.tanggal) {
      map.delete(String(info.tanggal));
    }
  }
  return map;
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val)
    .replace(/\[TAP\]/g, '')
    .replace(/\[RESET\]/g, '')
    .replace(/\[AUTO\]/g, '')
    .replace(/\[GRP:[a-zA-Z0-9_-]+\]/g, '')
    .trim();

  if (/^[=+-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  if (/[",\n]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const tipe = searchParams.get('tipe');
    const todayStr = getTodayDate();
    const jamSekarang = getCurrentTimeWita();

    let csvContent = '';
    let filename = `export-${tipe}-${todayStr}.csv`;

    if (tipe === 'rekap') {
      const search = searchParams.get('q')?.slice(0, 80) || '';
      const onlyActive = searchParams.get('active') === 'true';

      const data = await fetchAll<any>((from, to) => {
        let q = supabase.from('absensi').select('nama, universitas, tanggal, nama_key, univ_key');
        if (search) q = q.ilike('nama', `%${search}%`);
        return q
          .order('tanggal', { ascending: true })
          .order('nama_key', { ascending: true })
          .order('univ_key', { ascending: true })
          .range(from, to);
      });

      const rekapMap = new Map<string, { nama: string; universitas: string; count: number; terakhir: string }>();
      const thresholdStr = getThresholdDateWita(ACTIVE_DAYS);

      for (const row of data) {
        const key = `${row.nama_key}|${row.univ_key}`;
        const entry = rekapMap.get(key) || { nama: row.nama, universitas: row.universitas, count: 0, terakhir: row.tanggal };
        entry.count++;
        if (row.tanggal > entry.terakhir) entry.terakhir = row.tanggal;
        rekapMap.set(key, entry);
      }

      let rows = Array.from(rekapMap.values());
      if (onlyActive) rows = rows.filter((r) => r.terakhir >= thresholdStr);

      csvContent = '\uFEFFNAMA,UNIVERSITAS,JUMLAH HADIR,TERAKHIR HADIR\n';
      rows.forEach((r) => {
        csvContent += `${escapeCSV(r.nama)},${escapeCSV(r.universitas)},${r.count},${r.terakhir}\n`;
      });
    } else if (tipe === 'individu') {
      const rawNama = (searchParams.get('nama') || '').trim();
      const rawUniv = (searchParams.get('univ') || '').trim();
      const nama = rawNama.toLowerCase();
      const univ = rawUniv.toLowerCase();

      const customHolidays = await getCustomHolidaysMap();

      const absensiRows = await fetchAll<any>((from, to) =>
        supabase
          .from('absensi')
          .select('*')
          .eq('nama_key', nama)
          .eq('univ_key', univ)
          .order('tanggal', { ascending: true })
          .range(from, to)
      );

      const izinRows = await fetchAll<any>((from, to) =>
        supabase
          .from('izin')
          .select('*')
          .eq('nama_key', nama)
          .eq('univ_key', univ)
          .order('tanggal', { ascending: true })
          .range(from, to)
      );

      let tgl_mulai: string | null = null;
      let tgl_selesai: string | null = null;
      let earliestDate = todayStr;
      let displayNama = rawNama;
      let displayUniv = rawUniv;

      const absenMap = new Map<string, any>();
      for (const r of absensiRows) {
        absenMap.set(r.tanggal, r);
        if (r.nama) displayNama = r.nama;
        if (r.universitas) displayUniv = r.universitas;
        if (r.tgl_mulai && !tgl_mulai) tgl_mulai = r.tgl_mulai;
        if (r.tgl_selesai && !tgl_selesai) tgl_selesai = r.tgl_selesai;
        if (r.tanggal < earliestDate) earliestDate = r.tanggal;
      }

      const izinMap = new Map<string, any>();
      for (const iz of izinRows) {
        izinMap.set(iz.tanggal, iz);
        if (iz.nama) displayNama = iz.nama;
        if (iz.universitas) displayUniv = iz.universitas;
        if (iz.tgl_mulai && !tgl_mulai) tgl_mulai = iz.tgl_mulai;
        if (iz.tgl_selesai && !tgl_selesai) tgl_selesai = iz.tgl_selesai;
        if (iz.tanggal < earliestDate) earliestDate = iz.tanggal;
      }

      const startStr = tgl_mulai || earliestDate;
      const endStr = tgl_selesai && tgl_selesai < todayStr ? tgl_selesai : todayStr;
      const allDates = startStr <= endStr ? generateDateRange(startStr, endStr) : [todayStr];

      filename = `rekap-individu-${nama.replace(/\s+/g, '_')}.csv`;
      csvContent = '\uFEFFTANGGAL,HARI,NAMA,UNIVERSITAS,STATUS,JAM MASUK,JAM KELUAR,KETERANGAN\n';

      [...allDates].reverse().forEach((d) => {
        const hari = getDayName(d);
        const abs = absenMap.get(d);
        const iz = izinMap.get(d);
        const libur = isWeekendOrFriday(d);
        const liburNas = customHolidays.get(d);

        if (abs) {
          const isAuto = String(abs.keterangan || '').includes('[AUTO]');
          const ketStr = escapeCSV(abs.keterangan) || (isAuto ? 'Hadir (Pra-Sistem)' : '');
          csvContent += `${d},${hari},${escapeCSV(displayNama)},${escapeCSV(displayUniv)},HADIR,${String(abs.jam_masuk || '-').slice(0, 5)},${String(abs.jam_keluar || '-').slice(0, 5)},${ketStr}\n`;
        } else if (iz) {
          csvContent += `${d},${hari},${escapeCSV(displayNama)},${escapeCSV(displayUniv)},IZIN (${escapeCSV(iz.jenis)}),-,-,${escapeCSV(iz.keterangan)}\n`;
        } else if (liburNas) {
          csvContent += `${d},${hari},${escapeCSV(displayNama)},${escapeCSV(displayUniv)},LIBUR NASIONAL,-,-,${escapeCSV(liburNas)}\n`;
        } else if (libur) {
          csvContent += `${d},${hari},${escapeCSV(displayNama)},${escapeCSV(displayUniv)},LIBUR,-,-,Libur (Jumat / Akhir Pekan)\n`;
        } else if (d === todayStr && jamSekarang < BATAS_JAM_PULANG) {
          csvContent += `${d},${hari},${escapeCSV(displayNama)},${escapeCSV(displayUniv)},BELUM ABSEN,-,-,Belum Melakukan Presensi Hari Ini\n`;
        } else {
          csvContent += `${d},${hari},${escapeCSV(displayNama)},${escapeCSV(displayUniv)},TIDAK HADIR,-,-,Tidak Hadir (Tanpa Keterangan)\n`;
        }
      });
    } else if (tipe === 'riwayat') {
      const start = searchParams.get('start')?.slice(0, 10);
      const end = searchParams.get('end')?.slice(0, 10);
      const univ = searchParams.get('univ')?.slice(0, 80);
      const q = searchParams.get('q')?.slice(0, 80);

      const data = await fetchAll<any>((from, to) => {
        let query = supabase.from('absensi').select('*');
        if (start) query = query.gte('tanggal', start);
        if (end) query = query.lte('tanggal', end);
        if (univ) query = query.ilike('universitas', `%${univ}%`);
        if (q) query = query.ilike('nama', `%${q}%`);
        return query
          .order('tanggal', { ascending: false })
          .order('nama_key', { ascending: true })
          .order('univ_key', { ascending: true })
          .range(from, to);
      });

      csvContent = '\uFEFFTANGGAL,NAMA,UNIVERSITAS,JAM MASUK,JAM KELUAR,KETERANGAN\n';
      data.forEach((r) => {
        csvContent += `${r.tanggal},${escapeCSV(r.nama)},${escapeCSV(r.universitas)},${r.jam_masuk || ''},${r.jam_keluar || ''},${escapeCSV(r.keterangan)}\n`;
      });
    } else if (tipe === 'izin') {
      const start = searchParams.get('start')?.slice(0, 10);
      const end = searchParams.get('end')?.slice(0, 10);

      const data = await fetchAll<any>((from, to) => {
        let query = supabase.from('izin').select('*');
        if (start) query = query.gte('tanggal', start);
        if (end) query = query.lte('tanggal', end);
        return query
          .order('tanggal', { ascending: false })
          .order('nama_key', { ascending: true })
          .order('univ_key', { ascending: true })
          .range(from, to);
      });

      csvContent = '\uFEFFTANGGAL,NAMA,UNIVERSITAS,JENIS,KETERANGAN,LINK SURAT\n';
      data.forEach((r) => {
        csvContent += `${r.tanggal},${escapeCSV(r.nama)},${escapeCSV(r.universitas)},${escapeCSV(r.jenis)},${escapeCSV(r.keterangan)},${escapeCSV(r.link_surat)}\n`;
      });
    } else if (tipe === 'log') {
      const data = await fetchAll<any>((from, to) =>
        supabase
          .from('admin_log')
          .select('waktu,aksi,tabel,sheets_ok,sebelum,sesudah')
          .order('waktu', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)
      );

      filename = `log-admin-${todayStr}.csv`;
      csvContent = '\uFEFFWAKTU,AKSI,TABEL,SHEETS_OK,SEBELUM,SESUDAH\n';
      data.forEach((r) => {
        const sebelum = r.sebelum ? JSON.stringify(r.sebelum) : '';
        const sesudah = r.sesudah ? JSON.stringify(r.sesudah) : '';
        csvContent += `${escapeCSV(r.waktu)},${escapeCSV(r.aksi)},${escapeCSV(r.tabel)},${escapeCSV(r.sheets_ok)},${escapeCSV(sebelum)},${escapeCSV(sesudah)}\n`;
      });
    } else {
      return new Response('Tipe tidak valid', { status: 400 });
    }

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Export CSV Error:', err);
    return new Response(err?.message || 'Gagal mengekspor data', { status: 500 });
  }
}