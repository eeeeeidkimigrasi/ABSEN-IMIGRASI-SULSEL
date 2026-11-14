import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTodayDate, getDayName } from '@/lib/waktu';
import { fetchAll } from '@/lib/fetch-all';

const BATAS_JAM_PULANG = process.env.BATAS_JAM_PULANG || '18:00';

const ipHits = new Map();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

function getCurrentTimeWita(): string {
  const wita = new Date(Date.now() + 8 * 3600 * 1000);
  return wita.toISOString().slice(11, 16);
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
    .select('id, aksi, tabel, sebelum, sesudah')
    .order('id', { ascending: true });

  const map = new Map<string, string>();
  for (const row of data || []) {
    const info = row.sesudah as any;
    const seb = row.sebelum as any;
    const isHoliday =
      row.tabel === 'hari_libur' ||
      seb?.tipe_log === 'hari_libur' ||
      (info && typeof info === 'object' && info.tanggal && !info.nama);

    if (!isHoliday || !info?.tanggal) continue;

    if (row.aksi === 'tambah' || row.aksi === 'tambah_libur') {
      map.set(String(info.tanggal), String(info.keterangan || 'Hari Libur Nasional'));
    } else if (row.aksi === 'hapus' || row.aksi === 'hapus_libur') {
      map.delete(String(info.tanggal));
    }
  }
  return map;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan, silakan tunggu 1 menit.' }, { status: 429 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const rawNama = (searchParams.get('nama') || '').trim().replace(/\s+/g, ' ');
    const rawUniv = (searchParams.get('univ') || '').trim().replace(/\s+/g, ' ');
    const nama_key = rawNama.toLowerCase();
    const univ_key = rawUniv.toLowerCase();

    if (!nama_key || !univ_key) {
      return NextResponse.json({ error: 'Nama lengkap dan universitas wajib diisi.' }, { status: 400 });
    }

    const todayStr = getTodayDate();
    const jamSekarang = getCurrentTimeWita();

    const [absensiRows, izinRows, customHolidays] = await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from('absensi')
          .select('nama, universitas, tanggal, jam_masuk, jam_keluar, keterangan, tgl_mulai, tgl_selesai')
          .eq('nama_key', nama_key)
          .eq('univ_key', univ_key)
          .order('tanggal', { ascending: true })
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from('izin')
          .select('nama, universitas, tanggal, jenis, keterangan, link_surat, tgl_mulai, tgl_selesai')
          .eq('nama_key', nama_key)
          .eq('univ_key', univ_key)
          .order('tanggal', { ascending: true })
          .range(from, to)
      ),
      getCustomHolidaysMap(),
    ]);

    if (absensiRows.length === 0 && izinRows.length === 0) {
      return NextResponse.json(
        { error: 'Data peserta tidak ditemukan. Pastikan ejaan Nama Lengkap dan Universitas sesuai saat presensi.' },
        { status: 404 }
      );
    }

    let displayNama = rawNama;
    let displayUniv = rawUniv;
    let tgl_mulai: string | null = null;
    let tgl_selesai: string | null = null;
    let earliestDate = todayStr;
    let terakhirHadir = '-';
    let spCount = 0;

    const izinMap = new Map();
    for (const iz of izinRows as any[]) {
      izinMap.set(iz.tanggal, iz);
      if (iz.nama) displayNama = iz.nama;
      if (iz.universitas) displayUniv = iz.universitas;
      if (iz.tgl_mulai && !tgl_mulai) tgl_mulai = iz.tgl_mulai;
      if (iz.tgl_selesai && !tgl_selesai) tgl_selesai = iz.tgl_selesai;
      if (iz.tanggal < earliestDate) earliestDate = iz.tanggal;
    }

    const absenMap = new Map();
    for (const r of absensiRows as any[]) {
      absenMap.set(r.tanggal, r);
      if (r.nama) displayNama = r.nama;
      if (r.universitas) displayUniv = r.universitas;
      if (r.tgl_mulai && !tgl_mulai) tgl_mulai = r.tgl_mulai;
      if (r.tgl_selesai && !tgl_selesai) tgl_selesai = r.tgl_selesai;
      if (r.tanggal < earliestDate) earliestDate = r.tanggal;
      if (terakhirHadir === '-' || r.tanggal > terakhirHadir) terakhirHadir = r.tanggal;

      const rawKet = String(r.keterangan || '');
      const hasIzinSameDay = izinMap.has(r.tanggal);
      if (!rawKet.includes('[RESET]') && !rawKet.includes('[AUTO]')) {
        const hasTapTag = rawKet.includes('[TAP]');
        const isPastUnclosed = r.tanggal < todayStr && !r.jam_keluar && !hasIzinSameDay;
        const isTodayLateUnclosed =
          r.tanggal === todayStr && !r.jam_keluar && jamSekarang >= BATAS_JAM_PULANG && !hasIzinSameDay;
        if (hasTapTag || isPastUnclosed || isTodayLateUnclosed) {
          spCount++;
        }
      }
    }

    const startStr = tgl_mulai || earliestDate;
    const endStr = tgl_selesai && tgl_selesai < todayStr ? tgl_selesai : todayStr;
    const allDates = startStr <= endStr ? generateDateRange(startStr, endStr) : [todayStr];

    let alphaCount = 0;
    for (const d of allDates) {
      if (isWeekendOrFriday(d) || customHolidays.has(d)) continue;
      if (d === todayStr && jamSekarang < BATAS_JAM_PULANG) continue;
      if (!absenMap.has(d) && !izinMap.has(d)) {
        alphaCount++;
      }
    }

    const cleanKet = (val?: string | null) =>
      val
        ? val
            .replace(/\[TAP\]/g, '')
            .replace(/\[RESET\]/g, '')
            .replace(/\[AUTO\]/g, '')
            .replace(/\[GRP:[a-zA-Z0-9_-]+\]/g, '')
            .trim()
        : '';

    const calendar = [...allDates].reverse().map((d) => {
      const hari = getDayName(d);
      const abs = absenMap.get(d);
      const iz = izinMap.get(d);
      const liburRutin = isWeekendOrFriday(d);
      const liburNasional = customHolidays.get(d);

      if (abs) {
        const rawKet = String(abs.keterangan || '');
        const isAuto = rawKet.includes('[AUTO]');
        const hasTap =
          !rawKet.includes('[RESET]') &&
          !isAuto &&
          !iz &&
          (rawKet.includes('[TAP]') ||
            (d < todayStr && !abs.jam_keluar) ||
            (d === todayStr && !abs.jam_keluar && jamSekarang >= BATAS_JAM_PULANG));

        return {
          tanggal: d,
          hari,
          status: 'HADIR',
          jam_masuk: abs.jam_masuk ? String(abs.jam_masuk).slice(0, 5) : '-',
          jam_keluar: abs.jam_keluar ? String(abs.jam_keluar).slice(0, 5) : '-',
          tidak_absen_pulang: hasTap,
          keterangan: cleanKet(abs.keterangan) || (isAuto ? 'Hadir (Pra-Sistem)' : iz ? `Izin: ${iz.jenis}` : '-'),
        };
      }

      if (iz) {
        return {
          tanggal: d,
          hari,
          status: 'IZIN',
          jenis_izin: iz.jenis || 'Izin',
          jam_masuk: '-',
          jam_keluar: '-',
          tidak_absen_pulang: false,
          keterangan: cleanKet(iz.keterangan) || iz.jenis || '-',
        };
      }

      if (liburNasional) {
        return {
          tanggal: d,
          hari,
          status: 'LIBUR',
          jam_masuk: '-',
          jam_keluar: '-',
          tidak_absen_pulang: false,
          keterangan: `Libur Nasional: ${liburNasional}`,
        };
      }

      if (liburRutin) {
        return {
          tanggal: d,
          hari,
          status: 'LIBUR',
          jam_masuk: '-',
          jam_keluar: '-',
          tidak_absen_pulang: false,
          keterangan: 'Libur (Jumat / Akhir Pekan)',
        };
      }

      if (d === todayStr && jamSekarang < BATAS_JAM_PULANG) {
        return {
          tanggal: d,
          hari,
          status: 'BELUM_ABSEN',
          jam_masuk: '-',
          jam_keluar: '-',
          tidak_absen_pulang: false,
          keterangan: 'Belum Melakukan Presensi Hari Ini',
        };
      }

      return {
        tanggal: d,
        hari,
        status: 'TIDAK_HADIR',
        jam_masuk: '-',
        jam_keluar: '-',
        tidak_absen_pulang: false,
        keterangan: 'Tidak Hadir (Tanpa Keterangan)',
      };
    });

    const { data: ttdRows } = await supabase
      .from('admin_log')
      .select('id, sesudah')
      .eq('aksi', 'edit')
      .eq('tabel', 'absensi')
      .order('id', { ascending: false })
      .limit(50);
    const foundTtd = (ttdRows || []).find((r: any) => r.sesudah && r.sesudah.tipe_log === 'ttd_config');
    const ttd = foundTtd?.sesudah || {
      jabatan: 'Ketua Tim Kepegawaian dan Kerja Sama',
      nama: '',
      nip: '',
    };

    return NextResponse.json({
      nama: displayNama,
      universitas: displayUniv,
      tgl_mulai: startStr,
      tgl_selesai: tgl_selesai || null,
      count: absenMap.size,
      izinCount: izinMap.size,
      alphaCount,
      spCount,
      terakhir: terakhirHadir,
      calendar,
      ttd,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Gagal memuat rekap peserta.' }, { status: 500 });
  }
}