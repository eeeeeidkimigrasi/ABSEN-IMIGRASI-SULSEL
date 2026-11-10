import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetch-all';

const ACTIVE_DAYS = 14;

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/\[TAP\]/g, '').replace(/\[RESET\]/g, '').trim();

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

    let csvContent = '';
    let filename = `export-${tipe}-${new Date().toISOString().split('T')[0]}.csv`;

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
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - ACTIVE_DAYS);
      const thresholdStr = threshold.toISOString().split('T')[0];

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
      const nama = (searchParams.get('nama') || '').trim().toLowerCase();
      const univ = (searchParams.get('univ') || '').trim().toLowerCase();

      const data = await fetchAll<any>((from, to) =>
        supabase
          .from('absensi')
          .select('*')
          .eq('nama_key', nama)
          .eq('univ_key', univ)
          .order('tanggal', { ascending: false })
          .range(from, to)
      );

      filename = `rekap-individu-${nama.replace(/\s+/g, '_')}.csv`;
      csvContent = '\uFEFFTANGGAL,NAMA,UNIVERSITAS,JAM MASUK,JAM KELUAR,KETERANGAN\n';
      data.forEach((r) => {
        csvContent += `${r.tanggal},${escapeCSV(r.nama)},${escapeCSV(r.universitas)},${r.jam_masuk || ''},${r.jam_keluar || ''},${escapeCSV(r.keterangan)}\n`;
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

      filename = `log-admin-${new Date().toISOString().split('T')[0]}.csv`;
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