import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MAX_ROWS = 20000;
const ACTIVE_DAYS = 14;

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // CSV Injection protection
  if (/^[=\+\-\@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Escape quotes and wrap in quotes if needed
  if (/[",\n]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tipe = searchParams.get('tipe');

  let csvContent = '';
  let filename = `export-${tipe}-${new Date().toISOString().split('T')[0]}.csv`;

  if (tipe === 'rekap') {
    const search = searchParams.get('q')?.slice(0, 80) || '';
    const onlyActive = searchParams.get('active') === 'true';

    let query = supabase.from('absensi').select('nama, universitas, tanggal, nama_key, univ_key, tgl_mulai, tgl_selesai');
    if (search) query = query.ilike('nama', `%${search}%`);

    const { data } = await query;
    if (!data) return new Response('No data', { status: 404 });

    const rekapMap = new Map<string, { nama: string; universitas: string; count: number; terakhir: string; tgl_mulai: string; tgl_selesai: string }>();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - ACTIVE_DAYS);
    const thresholdStr = threshold.toISOString().split('T')[0];

    for (const row of data as any[]) {
      const key = `${row.nama_key}|${row.univ_key}`;
      const entry = rekapMap.get(key) || {
        nama: row.nama,
        universitas: row.universitas,
        count: 0,
        terakhir: row.tanggal,
        tgl_mulai: row.tgl_mulai || '-',
        tgl_selesai: row.tgl_selesai || '-',
      };
      entry.count++;
      if (row.tanggal > entry.terakhir) entry.terakhir = row.tanggal;
      if (row.tgl_mulai && entry.tgl_mulai === '-') entry.tgl_mulai = row.tgl_mulai;
      if (row.tgl_selesai && entry.tgl_selesai === '-') entry.tgl_selesai = row.tgl_selesai;
      rekapMap.set(key, entry);
    }

    let rows = Array.from(rekapMap.values());
    if (onlyActive) rows = rows.filter(r => r.terakhir >= thresholdStr);

    csvContent = '\uFEFFNAMA,UNIVERSITAS,MULAI MAGANG,BERAKHIR MAGANG,JUMLAH HADIR,TERAKHIR HADIR\n';
    rows.slice(0, MAX_ROWS).forEach(r => {
      csvContent += `${escapeCSV(r.nama)},${escapeCSV(r.universitas)},${escapeCSV(r.tgl_mulai)},${escapeCSV(r.tgl_selesai)},${r.count},${r.terakhir}\n`;
    });
  } else if (tipe === 'individu') {
    const nama = searchParams.get('nama')?.trim() || '';
    const univ = searchParams.get('univ')?.trim() || '';

    if (!nama || !univ) {
      return new Response('Nama dan universitas wajib diisi', { status: 400 });
    }

    const namaKey = nama.toLowerCase();
    const univKey = univ.toLowerCase();

    const { data: absenData } = await supabase
      .from('absensi')
      .select('*')
      .eq('nama_key', namaKey)
      .eq('univ_key', univKey)
      .order('tanggal', { ascending: false });

    const { data: izinData } = await supabase
      .from('izin')
      .select('*')
      .eq('nama_key', namaKey)
      .eq('univ_key', univKey)
      .order('tanggal', { ascending: false });

    const absenList = (absenData || []) as any[];
    const izinList = (izinData || []) as any[];

    let tglMulai = '-';
    let tglSelesai = '-';
    let terakhirHadir = '-';

    for (const a of absenList) {
      if (a.tgl_mulai && tglMulai === '-') tglMulai = a.tgl_mulai;
      if (a.tgl_selesai && tglSelesai === '-') tglSelesai = a.tgl_selesai;
      if (terakhirHadir === '-' || a.tanggal > terakhirHadir) terakhirHadir = a.tanggal;
    }
    for (const iz of izinList) {
      if (iz.tgl_mulai && tglMulai === '-') tglMulai = iz.tgl_mulai;
      if (iz.tgl_selesai && tglSelesai === '-') tglSelesai = iz.tgl_selesai;
    }

    const safeName = nama.replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `Rekap_Individu_${safeName}_${new Date().toISOString().split('T')[0]}.csv`;

    // Bagian 1: Ringkasan Profil & Statistik Kehadiran
    csvContent = '\uFEFFREKAPITULASI INDIVIDU PESERTA MAGANG - KANWIL DITJEN IMIGRASI SULSEL\n';
    csvContent += `Nama Peserta,${escapeCSV(nama)}\n`;
    csvContent += `Universitas / Instansi,${escapeCSV(univ)}\n`;
    csvContent += `Mulai Magang,${escapeCSV(tglMulai)}\n`;
    csvContent += `Berakhir Magang,${escapeCSV(tglSelesai)}\n`;
    csvContent += `Total Hadir,${absenList.length} Hari\n`;
    csvContent += `Total Izin / Sakit,${izinList.length} Hari\n`;
    csvContent += `Terakhir Hadir,${escapeCSV(terakhirHadir)}\n\n`;

    // Bagian 2: Gabungan Riwayat Kehadiran & Izin
    csvContent += 'TANGGAL,STATUS,JAM MASUK,JAM KELUAR,KETERANGAN,LINK SURAT\n';

    const combined: { tanggal: string; status: string; masuk: string; keluar: string; ket: string; surat: string }[] = [];

    for (const a of absenList) {
      combined.push({
        tanggal: a.tanggal || '',
        status: 'HADIR',
        masuk: a.jam_masuk || '-',
        keluar: a.jam_keluar || '-',
        ket: a.keterangan || '-',
        surat: '-',
      });
    }

    for (const iz of izinList) {
      combined.push({
        tanggal: iz.tanggal || '',
        status: iz.jenis ? `IZIN (${String(iz.jenis).toUpperCase()})` : 'IZIN',
        masuk: '-',
        keluar: '-',
        ket: iz.keterangan || '-',
        surat: iz.link_surat || '-',
      });
    }

    combined.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));

    combined.forEach(row => {
      csvContent += `${escapeCSV(row.tanggal)},${escapeCSV(row.status)},${escapeCSV(row.masuk)},${escapeCSV(row.keluar)},${escapeCSV(row.ket)},${escapeCSV(row.surat)}\n`;
    });
  } else if (tipe === 'riwayat') {
    const start = searchParams.get('start')?.slice(0, 10);
    const end = searchParams.get('end')?.slice(0, 10);
    const univ = searchParams.get('univ')?.slice(0, 80);
    const q = searchParams.get('q')?.slice(0, 80);

    let query = supabase.from('absensi').select('*');
    if (start) query = query.gte('tanggal', start);
    if (end) query = query.lte('tanggal', end);
    if (univ) query = query.ilike('universitas', `%${univ}%`);
    if (q) query = query.ilike('nama', `%${q}%`);

    const { data } = await query.order('tanggal', { ascending: false }).limit(MAX_ROWS);
    if (!data) return new Response('No data', { status: 404 });

    csvContent = '\uFEFFTANGGAL,NAMA,UNIVERSITAS,JAM MASUK,JAM KELUAR,KETERANGAN\n';
    data.forEach(r => {
      csvContent += `${r.tanggal},${escapeCSV(r.nama)},${escapeCSV(r.universitas)},${r.jam_masuk},${r.jam_keluar},${escapeCSV(r.keterangan)}\n`;
    });
  } else if (tipe === 'izin') {
    const start = searchParams.get('start')?.slice(0, 10);
    const end = searchParams.get('end')?.slice(0, 10);

    let query = supabase.from('izin').select('*');
    if (start) query = query.gte('tanggal', start);
    if (end) query = query.lte('tanggal', end);

    const { data } = await query.order('tanggal', { ascending: false }).limit(MAX_ROWS);
    if (!data) return new Response('No data', { status: 404 });

    csvContent = '\uFEFFTANGGAL,NAMA,UNIVERSITAS,JENIS,KETERANGAN,LINK SURAT\n';
    data.forEach(r => {
      csvContent += `${r.tanggal},${escapeCSV(r.nama)},${escapeCSV(r.universitas)},${escapeCSV(r.jenis)},${escapeCSV(r.keterangan)},${escapeCSV(r.link_surat)}\n`;
    });
  } else if (tipe === 'log') {
    const { data } = await supabase
      .from('admin_log')
      .select('waktu,aksi,tabel,sheets_ok,sebelum,sesudah')
      .order('waktu', { ascending: false })
      .limit(MAX_ROWS);
    if (!data) return new Response('No data', { status: 404 });

    filename = `log-admin-${new Date().toISOString().split('T')[0]}.csv`;
    csvContent = '\uFEFFWAKTU,AKSI,TABEL,SHEETS_OK,SEBELUM,SESUDAH\n';
    data.forEach(r => {
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
}