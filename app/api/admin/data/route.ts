import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTodayDate } from '@/lib/waktu';

const ACTIVE_DAYS = 14;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tipe = searchParams.get('tipe');

  if (tipe === 'summary') {
    return handleSummary();
  } else if (tipe === 'rekap') {
    return handleRekap(searchParams);
  } else if (tipe === 'riwayat') {
    return handleRiwayat(searchParams);
  } else if (tipe === 'izin') {
    return handleIzin(searchParams);
  } else if (tipe === 'log') {
    return handleLog();
  }

  return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
}

async function handleLog() {
  const { data } = await supabase
    .from('admin_log')
    .select('id, waktu, aksi, tabel, sebelum, sesudah, sheets_ok')
    .order('waktu', { ascending: false })
    .limit(50);
  return NextResponse.json(data || []);
}

async function handleSummary() {
  const tanggal = getTodayDate();

  const { data: hadir } = await supabase
    .from('absensi')
    .select('nama, universitas, jam_masuk, jam_keluar, keterangan')
    .eq('tanggal', tanggal)
    .order('jam_masuk', { ascending: false });

  const { data: izin } = await supabase
    .from('izin')
    .select('nama, universitas, jenis, keterangan, link_surat')
    .eq('tanggal', tanggal);

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - ACTIVE_DAYS);
  const thresholdStr = thresholdDate.toISOString().split('T')[0];

  const { data: aktif } = await supabase
    .from('absensi')
    .select('nama, universitas, nama_key, univ_key')
    .gte('tanggal', thresholdStr);

  const uniqueAktif = Array.from(new Map(aktif?.map((a) => [`${a.nama_key}|${a.univ_key}`, a])).values());

  const hadirKeys = new Set(hadir?.map((h) => `${h.nama.toLowerCase().trim()}|${h.universitas.toLowerCase().trim()}`));
  const izinKeys = new Set(izin?.map((i) => `${i.nama.toLowerCase().trim()}|${i.universitas.toLowerCase().trim()}`));

  const belum = uniqueAktif.filter((a) => !hadirKeys.has(`${a.nama_key}|${a.univ_key}`) && !izinKeys.has(`${a.nama_key}|${a.univ_key}`));

  const { data: logsData } = await supabase
    .from('admin_log')
    .select('id, waktu, aksi, tabel, sebelum, sesudah, sheets_ok')
    .order('waktu', { ascending: false })
    .limit(50);

  return NextResponse.json({ hadir: hadir || [], izin: izin || [], belum, logs: logsData || [] });
}

async function handleRekap(params: URLSearchParams) {
  const search = params.get('q')?.slice(0, 80) || '';
  const onlyActive = params.get('active') === 'true';
  const todayStr = getTodayDate();

  let query = supabase
    .from('absensi')
    .select('nama, universitas, tanggal, jam_keluar, keterangan, nama_key, univ_key, tgl_mulai, tgl_selesai');

  if (search) {
    query = query.ilike('nama', `%${search}%`);
  }

  const { data } = await query;
  if (!data) return NextResponse.json([]);

  const { data: izinData } = await supabase
    .from('izin')
    .select('nama_key, univ_key, tgl_mulai, tgl_selesai');

  const izinCountMap = new Map<string, { count: number; tgl_mulai: string | null; tgl_selesai: string | null }>();
  for (const iz of (izinData || []) as any[]) {
    const k = `${iz.nama_key}|${iz.univ_key}`;
    const cur = izinCountMap.get(k) || { count: 0, tgl_mulai: null, tgl_selesai: null };
    cur.count++;
    if (iz.tgl_mulai && !cur.tgl_mulai) cur.tgl_mulai = iz.tgl_mulai;
    if (iz.tgl_selesai && !cur.tgl_selesai) cur.tgl_selesai = iz.tgl_selesai;
    izinCountMap.set(k, cur);
  }

  const rekapMap = new Map<
    string,
    {
      nama: string;
      universitas: string;
      count: number;
      izinCount: number;
      spCount: number;
      terakhir: string;
      tgl_mulai: string | null;
      tgl_selesai: string | null;
    }
  >();

  const now = new Date();
  const threshold = new Date();
  threshold.setDate(now.getDate() - ACTIVE_DAYS);

  for (const row of data as any[]) {
    const key = `${row.nama_key}|${row.univ_key}`;
    const izInfo = izinCountMap.get(key);
    const entry = rekapMap.get(key) || {
      nama: row.nama,
      universitas: row.universitas,
      count: 0,
      izinCount: izInfo?.count || 0,
      spCount: 0,
      terakhir: row.tanggal,
      tgl_mulai: row.tgl_mulai || izInfo?.tgl_mulai || null,
      tgl_selesai: row.tgl_selesai || izInfo?.tgl_selesai || null,
    };
    entry.count++;

    const hasTapTag = typeof row.keterangan === 'string' && row.keterangan.includes('[TAP]');
    const isPastUnclosed = row.tanggal < todayStr && !row.jam_keluar;
    if (hasTapTag || isPastUnclosed) {
      entry.spCount++;
    }

    if (row.tanggal > entry.terakhir) entry.terakhir = row.tanggal;
    if (row.tgl_mulai && !entry.tgl_mulai) entry.tgl_mulai = row.tgl_mulai;
    if (row.tgl_selesai && !entry.tgl_selesai) entry.tgl_selesai = row.tgl_selesai;
    rekapMap.set(key, entry);
  }

  let result = Array.from(rekapMap.values());

  if (onlyActive) {
    const thresholdStr = threshold.toISOString().split('T')[0];
    result = result.filter((r) => r.terakhir >= thresholdStr);
  }

  return NextResponse.json(result);
}

async function handleRiwayat(params: URLSearchParams) {
  const start = params.get('start')?.slice(0, 10);
  const end = params.get('end')?.slice(0, 10);
  const univ = params.get('univ')?.slice(0, 80);
  const q = params.get('q')?.slice(0, 80);
  const page = Math.min(Math.max(parseInt(params.get('page') || '1'), 1), 1000);
  const size = Math.min(Math.max(parseInt(params.get('size') || '50'), 1), 100);

  let query = supabase.from('absensi').select('*', { count: 'exact' });

  if (start) query = query.gte('tanggal', start);
  if (end) query = query.lte('tanggal', end);
  if (univ) query = query.ilike('universitas', `%${univ}%`);
  if (q) query = query.ilike('nama', `%${q}%`);

  const from = (page - 1) * size;
  const to = from + size - 1;

  const { data, count } = await query
    .order('tanggal', { ascending: false })
    .order('jam_masuk', { ascending: false })
    .range(from, to);

  return NextResponse.json({ data: data || [], total: count || 0 });
}

async function handleIzin(params: URLSearchParams) {
  const start = params.get('start')?.slice(0, 10);
  const end = params.get('end')?.slice(0, 10);

  let query = supabase.from('izin').select('*');

  if (start) query = query.gte('tanggal', start);
  if (end) query = query.lte('tanggal', end);

  const { data } = await query.order('tanggal', { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Aksi Buka Blokir SP-3
    if (body.action === 'unblock_sp') {
      const nama_key = (body.nama || '').trim().toLowerCase();
      const univ_key = (body.universitas || '').trim().toLowerCase();
      const todayStr = getTodayDate();

      if (!nama_key || !univ_key) {
        return NextResponse.json({ ok: false, error: 'Nama dan universitas wajib diisi.' }, { status: 400 });
      }

      const { data: rows } = await supabase
        .from('absensi')
        .select('tanggal, jam_keluar, keterangan')
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key);

      for (const r of rows || []) {
        const hasTap = typeof r.keterangan === 'string' && r.keterangan.includes('[TAP]');
        const isPastNull = r.tanggal < todayStr && !r.jam_keluar;
        if (hasTap || isPastNull) {
          const cleanKet = r.keterangan ? r.keterangan.replace(/\[TAP\]/g, '').trim() || null : null;
          await supabase
            .from('absensi')
            .update({
              jam_keluar: r.jam_keluar || '16:00',
              keterangan: cleanKet,
            })
            .eq('nama_key', nama_key)
            .eq('univ_key', univ_key)
            .eq('tanggal', r.tanggal);
        }
      }

      return NextResponse.json({ ok: true });
    }

    const { nama, universitas, tgl_mulai, tgl_selesai } = body;

    if (!nama || !universitas || !tgl_mulai || !tgl_selesai || tgl_selesai < tgl_mulai) {
      return NextResponse.json({ ok: false, error: 'Tanggal mulai dan selesai wajib diisi dengan benar.' }, { status: 400 });
    }

    const nama_key = nama.trim().toLowerCase();
    const univ_key = universitas.trim().toLowerCase();

    const { error: errAbsen } = await supabase
      .from('absensi')
      .update({ tgl_mulai, tgl_selesai })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key);

    await supabase
      .from('izin')
      .update({ tgl_mulai, tgl_selesai })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key);

    if (errAbsen) {
      return NextResponse.json({ ok: false, error: errAbsen.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Gagal menyimpan periode.' }, { status: 500 });
  }
}