import { cleanupInactiveParticipants } from '@/lib/auto-clean';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTodayDate, getDayName } from '@/lib/waktu';
import { fetchAll } from '@/lib/fetch-all';

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

// Jumat (5), Sabtu (6), Minggu (0) adalah hari libur rutin
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

// Mengambil daftar Hari Libur Nasional / Cuti Bersama yang disimpan Admin
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
  try {
    const { searchParams } = req.nextUrl;
    const tipe = searchParams.get('tipe');

    if (tipe === 'summary') {
      return await handleSummary();
    } else if (tipe === 'rekap') {
      return await handleRekap(searchParams);
    } else if (tipe === 'individu') {
      return await handleIndividu(searchParams);
    } else if (tipe === 'riwayat') {
      return await handleRiwayat(searchParams);
    } else if (tipe === 'izin') {
      return await handleIzin(searchParams);
    } else if (tipe === 'log') {
      return await handleLog();
    } else if (tipe === 'libur') {
      return await handleLibur();
    } else if (tipe === 'peserta_list') {
      return await handlePesertaList();
    }

    return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
  } catch (err: any) {
    console.error('API Admin Data Error:', err);
    return NextResponse.json({ error: err?.message || 'Gagal memuat data dari database.' }, { status: 500 });
  }
}

async function handleLibur() {
  const map = await getCustomHolidaysMap();
  const list = Array.from(map.entries())
    .map(([tanggal, keterangan]) => ({
      tanggal,
      hari: getDayName(tanggal),
      keterangan,
    }))
    .sort((a, b) => (a.tanggal > b.tanggal ? -1 : a.tanggal < b.tanggal ? 1 : 0));
  return NextResponse.json(list);
}

async function handlePesertaList() {
  const abs = await fetchAll<any>((from, to) =>
    supabase
      .from('absensi')
      .select('nama, universitas, nama_key, univ_key')
      .order('tanggal', { ascending: false })
      .order('nama_key', { ascending: true })
      .order('univ_key', { ascending: true })
      .range(from, to)
  );

  const iz = await fetchAll<any>((from, to) =>
    supabase
      .from('izin')
      .select('nama, universitas, nama_key, univ_key')
      .order('tanggal', { ascending: false })
      .order('nama_key', { ascending: true })
      .order('univ_key', { ascending: true })
      .range(from, to)
  );

  const pMap = new Map<string, { nama: string; universitas: string }>();
  for (const r of [...abs, ...iz]) {
    const k = `${r.nama_key}|${r.univ_key}`;
    if (!pMap.has(k) && r.nama && r.universitas) {
      pMap.set(k, { nama: r.nama, universitas: r.universitas });
    }
  }

  const list = Array.from(pMap.values()).sort((a, b) =>
    a.nama.toLowerCase().localeCompare(b.nama.toLowerCase())
  );
  return NextResponse.json(list);
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
  const hari = getDayName(tanggal);
  const customHolidays = await getCustomHolidaysMap();
  const liburNasional = customHolidays.get(tanggal);
  const liburRutin = isWeekendOrFriday(tanggal);
  const isLibur = Boolean(liburNasional || liburRutin);
  const keteranganLibur = liburNasional
    ? `Libur Nasional: ${liburNasional}`
    : liburRutin
    ? `Hari Libur (${hari})`
    : null;

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

  const thresholdStr = getThresholdDateWita(ACTIVE_DAYS);

  const [aktifAbs, aktifIz] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('absensi')
        .select('nama, universitas, nama_key, univ_key')
        .gte('tanggal', thresholdStr)
        .order('tanggal', { ascending: false })
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from('izin')
        .select('nama, universitas, nama_key, univ_key')
        .gte('tanggal', thresholdStr)
        .order('tanggal', { ascending: false })
        .range(from, to)
    ),
  ]);
  const aktif = [...(aktifAbs as any[]), ...(aktifIz as any[])];

  const uniqueAktif = Array.from(new Map(aktif.map((a) => [`${a.nama_key}|${a.univ_key}`, a])).values());

  const hadirKeys = new Set((hadir || []).map((h) => `${h.nama.toLowerCase().trim()}|${h.universitas.toLowerCase().trim()}`));
  const izinKeys = new Set((izin || []).map((i) => `${i.nama.toLowerCase().trim()}|${i.universitas.toLowerCase().trim()}`));

  const belum = isLibur
    ? []
    : uniqueAktif.filter((a) => !hadirKeys.has(`${a.nama_key}|${a.univ_key}`) && !izinKeys.has(`${a.nama_key}|${a.univ_key}`));

  // Auto-maintenance: bersihkan log perubahan biasa yang lebih tua dari 90 hari (kecuali hari_libur)
  const ninetyDaysAgoIso = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  await supabase
    .from('admin_log')
    .delete()
    .neq('tabel', 'hari_libur')
    .lt('waktu', ninetyDaysAgoIso);

  const { data: logsData } = await supabase
    .from('admin_log')
    .select('id, waktu, aksi, tabel, sebelum, sesudah, sheets_ok')
    .neq('tabel', 'hari_libur')
    .order('waktu', { ascending: false })
    .limit(50);

  return NextResponse.json({
    tanggal,
    hari,
    is_libur: isLibur,
    keterangan_libur: keteranganLibur,
    hadir: hadir || [],
    izin: izin || [],
    belum,
    logs: logsData || [],
  });
}

async function handleRekap(params: URLSearchParams) {
  const search = params.get('q')?.slice(0, 80) || '';
  const onlyActive = params.get('active') === 'true';
  const todayStr = getTodayDate();
  const jamSekarang = getCurrentTimeWita();
  const thresholdStr = getThresholdDateWita(ACTIVE_DAYS);

  // Optimasi jangka panjang: jika hanya peserta aktif (14 hari), ambil daftar nama_key aktif dari absensi & izin
  let activeNamaKeys: string[] | null = null;
  if (onlyActive) {
    const [recentAbs, recentIz] = await Promise.all([
      fetchAll((from, to) => {
        let rq = supabase.from('absensi').select('nama_key').gte('tanggal', thresholdStr);
        if (search) rq = rq.ilike('nama', `%${search}%`);
        return rq.order('nama_key', { ascending: true }).range(from, to);
      }),
      fetchAll((from, to) => {
        let iq = supabase.from('izin').select('nama_key').gte('tanggal', thresholdStr);
        if (search) iq = iq.ilike('nama', `%${search}%`);
        return iq.order('nama_key', { ascending: true }).range(from, to);
      }),
    ]);
    activeNamaKeys = Array.from(
      new Set([...recentAbs, ...recentIz].map((r: any) => r.nama_key).filter(Boolean))
    );
    if (activeNamaKeys.length === 0) {
      return NextResponse.json([]);
    }
  }

  const [data, izinData, customHolidays] = await Promise.all([
    fetchAll((from, to) => {
      let q = supabase
        .from('absensi')
        .select('nama, universitas, tanggal, jam_keluar, keterangan, nama_key, univ_key, tgl_mulai, tgl_selesai');
      if (search) q = q.ilike('nama', `%${search}%`);
      if (activeNamaKeys && activeNamaKeys.length <= 200) q = q.in('nama_key', activeNamaKeys);
      return q
        .order('tanggal', { ascending: true })
        .order('nama_key', { ascending: true })
        .order('univ_key', { ascending: true })
        .range(from, to);
    }),
    fetchAll((from, to) => {
      let iq = supabase
        .from('izin')
        .select('nama, universitas, nama_key, univ_key, tanggal, tgl_mulai, tgl_selesai');
      if (activeNamaKeys && activeNamaKeys.length <= 200) iq = iq.in('nama_key', activeNamaKeys);
      return iq
        .order('tanggal', { ascending: true })
        .order('nama_key', { ascending: true })
        .order('univ_key', { ascending: true })
        .range(from, to);
    }),
    getCustomHolidaysMap(),
  ]);

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

  const hadirDateSet = new Set<string>();

  const rekapMap = new Map<
    string,
    {
      key: string;
      nama: string;
      universitas: string;
      count: number;
      autoCount: number;
      izinCount: number;
      alphaCount: number;
      spCount: number;
      pertama: string;
      terakhir: string;
      tgl_mulai: string | null;
      tgl_selesai: string | null;
    }
  >();

  for (const row of data) {
    const key = `${row.nama_key}|${row.univ_key}`;
    hadirDateSet.add(`${key}|${row.tanggal}`);
    const izInfo = izinCountMap.get(key);
    const entry = rekapMap.get(key) || {
      key,
      nama: row.nama,
      universitas: row.universitas,
      count: 0,
      autoCount: 0,
      izinCount: izInfo?.count || 0,
      alphaCount: 0,
      spCount: 0,
      pertama: row.tanggal,
      terakhir: row.tanggal,
      tgl_mulai: row.tgl_mulai || izInfo?.tgl_mulai || null,
      tgl_selesai: row.tgl_selesai || izInfo?.tgl_selesai || null,
    };
    entry.count++;

    const ket = String(row.keterangan || '');
    if (ket.includes('[AUTO]')) {
      entry.autoCount++;
    }

    const hasIzinSameDay = izinDateSet.has(`${key}|${row.tanggal}`);

    if (!ket.includes('[RESET]') && !ket.includes('[AUTO]')) {
      const hasTapTag = ket.includes('[TAP]');
      const isPastUnclosed = row.tanggal < todayStr && !row.jam_keluar && !hasIzinSameDay;
      const isTodayLateUnclosed =
        row.tanggal === todayStr && !row.jam_keluar && jamSekarang >= BATAS_JAM_PULANG && !hasIzinSameDay;

      if (hasTapTag || isPastUnclosed || isTodayLateUnclosed) {
        entry.spCount++;
      }
    }

    if (row.tanggal < entry.pertama) entry.pertama = row.tanggal;
    if (row.tanggal > entry.terakhir) entry.terakhir = row.tanggal;
    if (row.tgl_mulai && !entry.tgl_mulai) entry.tgl_mulai = row.tgl_mulai;
    if (row.tgl_selesai && !entry.tgl_selesai) entry.tgl_selesai = row.tgl_selesai;
    rekapMap.set(key, entry);
  }

  for (const entry of Array.from(rekapMap.values())) {
    const startRange = entry.tgl_mulai || entry.pertama;
    const rawEnd = entry.tgl_selesai && entry.tgl_selesai < todayStr ? entry.tgl_selesai : todayStr;
    if (startRange && rawEnd >= startRange) {
      const allDates = generateDateRange(startRange, rawEnd);
      let alpha = 0;
      for (const d of allDates) {
        if (isWeekendOrFriday(d) || customHolidays.has(d)) continue;
        if (d === todayStr && jamSekarang < BATAS_JAM_PULANG) continue;
        if (!hadirDateSet.has(`${entry.key}|${d}`) && !izinDateSet.has(`${entry.key}|${d}`)) {
          alpha++;
        }
      }
      entry.alphaCount = alpha;
    }
  }

  let result = Array.from(rekapMap.values());

  if (onlyActive) {
    result = result.filter((r) => r.terakhir >= thresholdStr);
  }

  return NextResponse.json(result);
}

async function handleIndividu(params: URLSearchParams) {
  const nama_key = (params.get('nama') || '').trim().toLowerCase();
  const univ_key = (params.get('univ') || '').trim().toLowerCase();
  const todayStr = getTodayDate();
  const jamSekarang = getCurrentTimeWita();

  if (!nama_key || !univ_key) {
    return NextResponse.json({ error: 'Nama dan universitas wajib diisi' }, { status: 400 });
  }

  const [absensiRows, izinRows, customHolidays] = await Promise.all([
    fetchAll<any>((from, to) =>
      supabase
        .from('absensi')
        .select('tanggal, jam_masuk, jam_keluar, keterangan, tgl_mulai, tgl_selesai')
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key)
        .order('tanggal', { ascending: true })
        .range(from, to)
    ),
    fetchAll<any>((from, to) =>
      supabase
        .from('izin')
        .select('tanggal, jenis, keterangan, link_surat, tgl_mulai, tgl_selesai')
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key)
        .order('tanggal', { ascending: true })
        .range(from, to)
    ),
    getCustomHolidaysMap(),
  ]);

  let tgl_mulai: string | null = null;
  let tgl_selesai: string | null = null;
  let earliestDate = todayStr;
  let firstRealDate: string | null = null;
  let autoCount = 0;

  const absenMap = new Map<string, any>();
  for (const r of absensiRows) {
    absenMap.set(r.tanggal, r);
    const ket = String(r.keterangan || '');
    if (ket.includes('[AUTO]')) {
      autoCount++;
    } else if (!firstRealDate || r.tanggal < firstRealDate) {
      firstRealDate = r.tanggal;
    }
    if (r.tgl_mulai && !tgl_mulai) tgl_mulai = r.tgl_mulai;
    if (r.tgl_selesai && !tgl_selesai) tgl_selesai = r.tgl_selesai;
    if (r.tanggal < earliestDate) earliestDate = r.tanggal;
  }

  const izinMap = new Map<string, any>();
  for (const iz of izinRows) {
    izinMap.set(iz.tanggal, iz);
    if (!firstRealDate || iz.tanggal < firstRealDate) {
      firstRealDate = iz.tanggal;
    }
    if (iz.tgl_mulai && !tgl_mulai) tgl_mulai = iz.tgl_mulai;
    if (iz.tgl_selesai && !tgl_selesai) tgl_selesai = iz.tgl_selesai;
    if (iz.tanggal < earliestDate) earliestDate = iz.tanggal;
  }

  const startStr = tgl_mulai || earliestDate;
  const endStr = tgl_selesai && tgl_selesai < todayStr ? tgl_selesai : todayStr;
  const allDates = startStr <= endStr ? generateDateRange(startStr, endStr) : [todayStr];

  const cutoffPast = firstRealDate || todayStr;
  let missingPastWorkdays = 0;
  if (tgl_mulai && tgl_mulai < cutoffPast) {
    for (const d of allDates) {
      if (d < cutoffPast && !isWeekendOrFriday(d) && !customHolidays.has(d) && !absenMap.has(d) && !izinMap.has(d)) {
        missingPastWorkdays++;
      }
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
        is_auto: isAuto,
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
        link_surat: iz.link_surat || null,
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

  return NextResponse.json({
    tgl_mulai: startStr,
    tgl_selesai: tgl_selesai || null,
    batas_hitung: endStr,
    first_real_date: cutoffPast,
    missing_past_workdays: missingPastWorkdays,
    auto_count: autoCount,
    calendar,
  });
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

    // 0. Hapus Seluruh Data Peserta (Untuk membersihkan data tes / peserta batal magang)
    if (body.action === 'delete_participant') {
      const nama = (body.nama || '').trim();
      const universitas = (body.universitas || '').trim();
      const nama_key = nama.toLowerCase();
      const univ_key = universitas.toLowerCase();

      if (!nama_key || !univ_key) {
        return NextResponse.json({ ok: false, error: 'Nama dan universitas wajib diisi.' }, { status: 400 });
      }

      const [{ data: delAbs, error: errDelAbs }, { data: delIz, error: errDelIz }] = await Promise.all([
        supabase.from('absensi').delete().eq('nama_key', nama_key).eq('univ_key', univ_key).select('tanggal'),
        supabase.from('izin').delete().eq('nama_key', nama_key).eq('univ_key', univ_key).select('tanggal'),
      ]);

      if (errDelAbs || errDelIz) {
        return NextResponse.json(
          { ok: false, error: errDelAbs?.message || errDelIz?.message || 'Gagal menghapus data peserta.' },
          { status: 500 }
        );
      }

      try {
        await supabase.from('peserta').delete().eq('nama_key', nama_key).eq('univ_key', univ_key);
      } catch {}

      await supabase.from('admin_log').insert({
        aksi: 'hapus',
        tabel: 'absensi',
        sebelum: {
          nama,
          universitas,
          absensi_dihapus: delAbs?.length || 0,
          izin_dihapus: delIz?.length || 0,
        },
        sesudah: null,
        sheets_ok: true,
      });

      return NextResponse.json({
        ok: true,
        deleted_absensi: delAbs?.length || 0,
        deleted_izin: delIz?.length || 0,
      });
    }

    // 1. Tambah Hari Libur Nasional / Cuti Bersama (Bisa 1 hari atau rentang tanggal)
    if (body.action === 'add_holiday') {
      const tanggal = (body.tanggal || '').trim();
      const tanggal_selesai = (body.tanggal_selesai || tanggal).trim();
      const keterangan = (body.keterangan || 'Hari Libur Nasional').trim().slice(0, 80);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal_selesai) || tanggal_selesai < tanggal) {
        return NextResponse.json({ ok: false, error: 'Tanggal hari libur tidak valid.' }, { status: 400 });
      }

      const dates = generateDateRange(tanggal, tanggal_selesai);
      if (dates.length === 0 || dates.length > 30) {
        return NextResponse.json({ ok: false, error: 'Rentang hari libur maksimal 30 hari.' }, { status: 400 });
      }

      const logsToInsert = dates.map((d) => ({
        aksi: 'tambah',
        tabel: 'absensi',
        sebelum: null,
        sesudah: { tanggal: d, keterangan },
        sheets_ok: true,
      }));

      const { error } = await supabase.from('admin_log').insert(logsToInsert);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, count: dates.length });
    }

    // 2. Hapus Hari Libur Nasional
    if (body.action === 'delete_holiday') {
      const tanggal = (body.tanggal || '').trim();
      if (!tanggal) {
        return NextResponse.json({ ok: false, error: 'Tanggal wajib diisi.' }, { status: 400 });
      }

      const { error } = await supabase.from('admin_log').insert({
        aksi: 'hapus',
        tabel: 'absensi',
        sebelum: { tanggal },
        sesudah: { tanggal },
        sheets_ok: true,
      });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // 2b. Hapus SP pada 1 Tanggal Tertentu (dari dalam Kartu Profil)
    if (body.action === 'reset_single_sp') {
      const nama = (body.nama || '').trim();
      const universitas = (body.universitas || '').trim();
      const tanggal = (body.tanggal || '').trim();
      const nama_key = nama.toLowerCase();
      const univ_key = universitas.toLowerCase();

      if (!nama_key || !univ_key || !tanggal) {
        return NextResponse.json({ ok: false, error: 'Data nama, universitas, dan tanggal wajib diisi.' }, { status: 400 });
      }

      const { data: row } = await supabase
        .from('absensi')
        .select('tanggal, jam_keluar, keterangan')
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key)
        .eq('tanggal', tanggal)
        .maybeSingle();

      if (!row) {
        return NextResponse.json({ ok: false, error: 'Data absensi pada tanggal tersebut tidak ditemukan.' }, { status: 404 });
      }

      const ket = String(row.keterangan || '');
      const isNullExit = !row.jam_keluar;
      const baseKet = ket.replace(/\[TAP\]/g, '').replace(/\[RESET\]/g, '').trim();
      const newKet = isNullExit
        ? (baseKet ? `${baseKet} [RESET]` : '[RESET]')
        : (baseKet || null);

      const { error: updErr } = await supabase
        .from('absensi')
        .update({ keterangan: newKet })
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key)
        .eq('tanggal', tanggal);

      if (updErr) {
        return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
      }

      await supabase.from('admin_log').insert({
        aksi: 'hapus_sp_tanggal',
        tabel: 'absensi',
        sebelum: { nama, universitas, tanggal, keterangan_lama: row.keterangan },
        sesudah: { nama, universitas, tanggal, keterangan_baru: newKet },
        sheets_ok: true,
      });

      return NextResponse.json({ ok: true });
    }

    // 3. Buka Blokir SP-3
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
        if (ket.includes('[AUTO]')) continue;
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

    // 4. Isi Otomatis Masa Lalu (Backfill Senin-Kamis dengan jam 07:15 - 16:05, melewati Libur Nasional)
    if (body.action === 'backfill_past') {
      const nama = (body.nama || '').trim();
      const universitas = (body.universitas || '').trim();
      const nama_key = nama.toLowerCase();
      const univ_key = universitas.toLowerCase();
      const todayStr = getTodayDate();

      if (!nama_key || !univ_key) {
        return NextResponse.json({ ok: false, error: 'Nama dan universitas wajib diisi.' }, { status: 400 });
      }

      const [absensiRows, izinRows, customHolidays] = await Promise.all([
        fetchAll<any>((from, to) =>
          supabase
            .from('absensi')
            .select('tanggal, keterangan, tgl_mulai, tgl_selesai')
            .eq('nama_key', nama_key)
            .eq('univ_key', univ_key)
            .order('tanggal', { ascending: true })
            .range(from, to)
        ),
        fetchAll<any>((from, to) =>
          supabase
            .from('izin')
            .select('tanggal, tgl_mulai, tgl_selesai')
            .eq('nama_key', nama_key)
            .eq('univ_key', univ_key)
            .order('tanggal', { ascending: true })
            .range(from, to)
        ),
        getCustomHolidaysMap(),
      ]);

      let tgl_mulai: string | null = null;
      let tgl_selesai: string | null = null;
      let firstRealDate: string | null = null;
      const existingDates = new Set<string>();

      for (const r of absensiRows) {
        existingDates.add(r.tanggal);
        const ket = String(r.keterangan || '');
        if (!ket.includes('[AUTO]') && (!firstRealDate || r.tanggal < firstRealDate)) {
          firstRealDate = r.tanggal;
        }
        if (r.tgl_mulai && !tgl_mulai) tgl_mulai = r.tgl_mulai;
        if (r.tgl_selesai && !tgl_selesai) tgl_selesai = r.tgl_selesai;
      }

      for (const iz of izinRows) {
        existingDates.add(iz.tanggal);
        if (!firstRealDate || iz.tanggal < firstRealDate) {
          firstRealDate = iz.tanggal;
        }
        if (iz.tgl_mulai && !tgl_mulai) tgl_mulai = iz.tgl_mulai;
        if (iz.tgl_selesai && !tgl_selesai) tgl_selesai = iz.tgl_selesai;
      }

      if (!tgl_mulai) {
        return NextResponse.json({ ok: false, error: 'Tanggal mulai magang belum diatur untuk peserta ini.' }, { status: 400 });
      }

      const cutoffDate = firstRealDate || todayStr;
      if (tgl_mulai >= cutoffDate) {
        return NextResponse.json({ ok: false, error: 'Tidak ada tanggal masa lalu sebelum penggunaan web yang perlu diisi.' }, { status: 400 });
      }

      const allDates = generateDateRange(tgl_mulai, cutoffDate);
      const rowsToInsert: any[] = [];

      for (const d of allDates) {
        if (d >= cutoffDate) continue;
        if (isWeekendOrFriday(d) || customHolidays.has(d)) continue;
        if (existingDates.has(d)) continue;

        const minMasuk = 15 + Math.floor(Math.random() * 14);
        const minKeluar = 5 + Math.floor(Math.random() * 11);
        const jam_masuk = `07:${String(minMasuk).padStart(2, '0')}`;
        const jam_keluar = `16:${String(minKeluar).padStart(2, '0')}`;

        rowsToInsert.push({
          nama,
          universitas,
          tanggal: d,
          jam_masuk,
          jam_keluar,
          lat: null,
          lng: null,
          akurasi_gps: null,
          keterangan: '[AUTO]',
          tgl_mulai,
          tgl_selesai,
          synced_to_sheets: true,
        });
      }

      if (rowsToInsert.length === 0) {
        return NextResponse.json({ ok: false, error: 'Seluruh hari kerja masa lalu sudah terisi.' }, { status: 400 });
      }

      const { error: insertErr } = await supabase.from('absensi').insert(rowsToInsert);
      if (insertErr) {
        return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
      }

      await supabase.from('admin_log').insert({
        aksi: 'backfill_auto',
        tabel: 'absensi',
        sebelum: null,
        sesudah: { nama, universitas, jumlah_hari: rowsToInsert.length, rentang: `${tgl_mulai} s/d sebelum ${cutoffDate}` },
        sheets_ok: true,
      });

      return NextResponse.json({ ok: true, inserted: rowsToInsert.length });
    }

    // 5. Batalkan Isi Otomatis (Undo khusus baris [AUTO])
    if (body.action === 'undo_backfill') {
      const nama = (body.nama || '').trim();
      const universitas = (body.universitas || '').trim();
      const nama_key = nama.toLowerCase();
      const univ_key = universitas.toLowerCase();

      if (!nama_key || !univ_key) {
        return NextResponse.json({ ok: false, error: 'Nama dan universitas wajib diisi.' }, { status: 400 });
      }

      const { data: deletedRows, error: delErr } = await supabase
        .from('absensi')
        .delete()
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key)
        .ilike('keterangan', '%[AUTO]%')
        .select('tanggal');

      if (delErr) {
        return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      }

      await supabase.from('admin_log').insert({
        aksi: 'hapus',
        tabel: 'absensi',
        sebelum: { nama, universitas, dihapus: deletedRows?.length || 0 },
        sesudah: null,
        sheets_ok: true,
      });

      return NextResponse.json({ ok: true, deleted: deletedRows?.length || 0 });
    }

    // 6. Simpan Periode Mulai & Selesai Magang
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
    return NextResponse.json({ ok: false, error: e?.message || 'Gagal memproses permintaan.' }, { status: 500 });
  }
}