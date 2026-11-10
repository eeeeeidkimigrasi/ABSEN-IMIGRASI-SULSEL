import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTodayDate } from '@/lib/waktu';
import { fetchAll } from '@/lib/fetch-all';

const ACTIVE_DAYS = 14;
const BATAS_JAM_PULANG = '18:00';

function getCurrentTimeWita(): string {
  const wita = new Date(Date.now() + 8 * 3600 * 1000);
  return wita.toISOString().slice(11, 16);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const tipe = searchParams.get('tipe');

    if (tipe === 'summary') {
      return await handleSummary();
    } else if (tipe === 'rekap') {
      return await handleRekap(searchParams);
    } else if (tipe === 'riwayat') {
      return await handleRiwayat(searchParams);
    } else if (tipe === 'izin') {
      return await handleIzin(searchParams);
    } else if (tipe === 'log') {
      return await handleLog();
    }

    return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
  } catch (err: any) {
    console.error('API Admin Data Error:', err);
    return NextResponse.json({ error: err?.message || 'Gagal memuat data dari database.' }, { status: 500 });
  }
}

async function handleLog() {
  const { data, error } = await supabase
    .from('admin_log')
    .select('id, waktu, aksi, tabel, sebelum, sesudah, sheets_ok')
    .order('waktu', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return NextResponse.json(data || []);
}

async function handleSummary() {
  const tanggal = getTodayDate();

  const { data: hadir, error: errHadir } = await supabase
    .from('absensi')
    .select('nama, universitas, jam_masuk, jam_keluar, keterangan')
    .eq('tanggal', tanggal)
    .order('jam_masuk', { ascending: false });
  if (errHadir) throw new Error(errHadir.message);

  const { data: izin, error: errIzin } = await supabase
    .from('izin')
    .select('nama, universitas, jenis, keterangan, link_surat')
    .eq('tanggal', tanggal);
  if (errIzin) throw new Error(errIzin.message);

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - ACTIVE_DAYS);
  const thresholdStr = thresholdDate.toISOString().split('T')[0];

  const aktif = await fetchAll<any>((from, to) =>
    supabase
      .from('absensi')
      .select('nama, universitas, nama_key, univ_key')
      .gte('tanggal', thresholdStr)
      .order('tanggal', { ascending: false })
      .order('nama_key', { ascending: true })
      .order('univ_key', { ascending: true })
      .range(from, to)
  );

  const uniqueAktif = Array.from(new Map(aktif.map((a) => [`${a.nama_key}|${a.univ_key}`, a])).values());

  const hadirKeys = new Set((hadir || []).map((h) => `${h.nama.toLowerCase().trim()}|${h.universitas.toLowerCase().trim()}`));
  const izinKeys = new Set((izin || []).map((i) => `${i.nama.toLowerCase().trim()}|${i.universitas.toLowerCase().trim()}`));

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
  const jamSekarang = getCurrentTimeWita();

  const data = await fetchAll<any>((from, to) => {
    let q = supabase
      .from('absensi')
      .select('nama, universitas, tanggal, jam_keluar, keterangan, nama_key, univ_key, tgl_mulai, tgl_selesai');
    if (search) q = q.ilike('nama', `%${search}%`);
    return q
      .order('tanggal', { ascending: true })
      .order('nama_key', { ascending: true })
      .order('univ_key', { ascending: true })
      .range(from, to);
  });

  const izinData = await fetchAll<any>((from, to) =>
    supabase
      .from('izin')
      .select('nama_key, univ_key, tanggal, tgl_mulai, tgl_selesai')
      .order('tanggal', { ascending: true })
      .order('nama_key', { ascending: true })
      .order('univ_key', { ascending: true })
      .range(from, to)
  );

  const izinCountMap = new Map<string, { count: number; tgl_mulai: string | null; tgl_selesai: string | null }>();
  const izinDateSet = new Set<string>();

  for (const iz of izinData) {
    const k = `${iz.nama_key}|${iz.univ_key}`;
    izinDateSet.add(`${k}|${iz.tanggal}`);
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

  for (const row of data) {
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

    const ket = String(row.keterangan || '');
    const hasIzinSameDay = izinDateSet.has(`${key}|${row.tanggal}`);

    // Aturan: jika tidak di-reset dan tidak sedang izin di tanggal tersebut
    if (!ket.includes('[RESET]')) {
      const hasTapTag = ket.includes('[TAP]');
      const isPastUnclosed = row.tanggal < todayStr && !row.jam_keluar && !hasIzinSameDay;
      const isTodayLateUnclosed =
        row.tanggal === todayStr && !row.jam_keluar && jamSekarang >= BATAS_JAM_PULANG && !hasIzinSameDay;

      if (hasTapTag || isPastUnclosed || isTodayLateUnclosed) {
        entry.spCount++;
      }
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

  const { data, count, error } = await query
    .order('tanggal', { ascending: false })
    .order('jam_masuk', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  return NextResponse.json({ data: data || [], total: count || 0 });
}

async function handleIzin(params: URLSearchParams) {
  const start = params.get('start')?.slice(0, 10);
  const end = params.get('end')?.slice(0, 10);

  const data = await fetchAll<any>((from, to) => {
    let q = supabase.from('izin').select('*');
    if (start) q = q.gte('tanggal', start);
    if (end) q = q.lte('tanggal', end);
    return q
      .order('tanggal', { ascending: false })
      .order('nama_key', { ascending: true })
      .order('univ_key', { ascending: true })
      .range(from, to);
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Aksi Buka Blokir SP-3: jam_keluar tetap kosong (-), hanya membersihkan/memutihkan status SP
    if (body.action === 'unblock_sp') {
      const nama_key = (body.nama || '').trim().toLowerCase();
      const univ_key = (body.universitas || '').trim().toLowerCase();

      if (!nama_key || !univ_key) {
        return NextResponse.json({ ok: false, error: 'Nama dan universitas wajib diisi.' }, { status: 400 });
      }

      const rows = await fetchAll<any>((from, to) =>
        supabase
          .from('absensi')
          .select('tanggal, jam_keluar, keterangan')
          .eq('nama_key', nama_key)
          .eq('univ_key', univ_key)
          .order('tanggal', { ascending: true })
          .range(from, to)
      );

      for (const r of rows) {
        const ket = String(r.keterangan || '');
        const hasTap = ket.includes('[TAP]');
        const isNullExit = !r.jam_keluar;
        if (hasTap || isNullExit) {
          const baseKet = ket.replace(/\[TAP\]/g, '').replace(/\[RESET\]/g, '').trim();
          const newKet = isNullExit
            ? (baseKet ? `${baseKet} [RESET]` : '[RESET]')
            : (baseKet || null);

          await supabase
            .from('absensi')
            .update({ keterangan: newKet })
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