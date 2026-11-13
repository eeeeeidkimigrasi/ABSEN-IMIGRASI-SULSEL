import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTodayDate } from '@/lib/waktu';

const ipHits = new Map();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
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

  while (cur <= end && dates.length < 45) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

async function getCustomHolidaysSet() {
  const { data } = await supabase
    .from('admin_log')
    .select('id, aksi, sesudah')
    .eq('tabel', 'hari_libur')
    .order('id', { ascending: true });

  const set = new Set();
  for (const row of data || []) {
    const info = row.sesudah as any;
    if (row.aksi === 'tambah_libur' && info?.tanggal) {
      set.add(String(info.tanggal));
    } else if (row.aksi === 'hapus_libur' && info?.tanggal) {
      set.delete(String(info.tanggal));
    }
  }
  return set;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body JSON tidak valid.' }, { status: 400 });
  }

  function rapikan(teks: string): string {
    return teks.trim().replace(/\s+/g, ' ');
  }

  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const jenis = body.jenis?.trim();
  const rawKet = body.keterangan
    ? rapikan(String(body.keterangan)).replace(/\[GRP:[a-zA-Z0-9_-]+\]/g, '').trim().slice(0, 85)
    : '';
  const link_surat = body.link_surat ? rapikan(body.link_surat) : null;
  const tgl_mulai = body.tgl_mulai ? String(body.tgl_mulai).trim() : null;
  const tgl_selesai = body.tgl_selesai ? String(body.tgl_selesai).trim() : null;

  const todayStr = getTodayDate();
  const izin_mulai = body.izin_mulai && /^\d{4}-\d{2}-\d{2}$/.test(body.izin_mulai) ? body.izin_mulai : todayStr;
  const izin_selesai = body.izin_selesai && /^\d{4}-\d{2}-\d{2}$/.test(body.izin_selesai) ? body.izin_selesai : izin_mulai;

  if (!nama || !universitas || !jenis) {
    return NextResponse.json({ ok: false, error: 'Isian belum lengkap.' }, { status: 400 });
  }
  if (nama.length > 80 || universitas.length > 80) {
    return NextResponse.json({ ok: false, error: 'Isian terlalu panjang.' }, { status: 400 });
  }
  if (!['Sakit', 'Izin', 'Lainnya'].includes(jenis)) {
    return NextResponse.json({ ok: false, error: 'Jenis izin tidak valid.' }, { status: 400 });
  }
  if (izin_selesai < izin_mulai) {
    return NextResponse.json({ ok: false, error: 'Tanggal selesai izin tidak boleh lebih awal dari tanggal mulai.' }, { status: 400 });
  }

  const allDates = generateDateRange(izin_mulai, izin_selesai);
  if (allDates.length === 0 || allDates.length > 30) {
    return NextResponse.json({ ok: false, error: 'Rentang izin maksimal 30 hari dalam satu pengajuan.' }, { status: 400 });
  }

  const customHolidays = await getCustomHolidaysSet();

  const targetDates =
    allDates.length === 1
      ? allDates
      : allDates.filter((d) => !isWeekendOrFriday(d) && !customHolidays.has(d));

  if (targetDates.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Seluruh tanggal yang dipilih jatuh pada hari libur (Jumat–Minggu / Libur Nasional).' },
      { status: 400 }
    );
  }

  if (link_surat) {
    if (link_surat.length > 300) {
      return NextResponse.json({ ok: false, error: 'Link surat maksimal 300 karakter.' }, { status: 400 });
    }
    if (/\s/.test(link_surat) || /["']/.test(link_surat)) {
      return NextResponse.json({ ok: false, error: 'Link surat tidak boleh mengandung spasi atau tanda kutip.' }, { status: 400 });
    }
    if (!link_surat.startsWith('https://drive.google.com/') && !link_surat.startsWith('https://docs.google.com/')) {
      return NextResponse.json(
        { ok: false, error: 'Link surat harus diawali https://drive.google.com/ atau https://docs.google.com/.' },
        { status: 400 }
      );
    }
  }

  const nama_key = nama.toLowerCase().trim();
  const univ_key = universitas.toLowerCase().trim();

  // 1. Jika izin 1 hari untuk hari ini, cek apakah sudah hadir atau sudah izin
  if (targetDates.length === 1 && targetDates[0] === todayStr) {
    const { count: hadirCount } = await supabase
      .from('absensi')
      .select('*', { count: 'exact', head: true })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key)
      .eq('tanggal', todayStr);

    if (hadirCount && hadirCount > 0) {
      return NextResponse.json({ status: 'sudah_hadir' });
    }

    const { count: izinCount } = await supabase
      .from('izin')
      .select('*', { count: 'exact', head: true })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key)
      .eq('tanggal', todayStr);

    if (izinCount && izinCount > 0) {
      return NextResponse.json({ status: 'sudah_izin' });
    }
  }

  // 2. Cek apakah peserta baru secara paralel
  const [{ count: absensiAny }, { count: izinAny }] = await Promise.all([
    supabase
      .from('absensi')
      .select('*', { count: 'exact', head: true })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key),
    supabase
      .from('izin')
      .select('*', { count: 'exact', head: true })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key),
  ]);

  const isNew = (!absensiAny || absensiAny === 0) && (!izinAny || izinAny === 0);

  if (isNew && !body.konfirmasi_baru) {
    return NextResponse.json({ status: 'nama_baru' });
  }

  if (isNew && (!tgl_mulai || !tgl_selesai || tgl_selesai < tgl_mulai)) {
    return NextResponse.json(
      { ok: false, error: 'Peserta baru wajib mengisi tanggal mulai dan selesai magang dengan benar.' },
      { status: 400 }
    );
  }

  let savedMulai = tgl_mulai;
  let savedSelesai = tgl_selesai;
  if (!isNew && (!savedMulai || !savedSelesai)) {
    const { data: sampleRow } = await supabase
      .from('absensi')
      .select('tgl_mulai, tgl_selesai')
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key)
      .not('tgl_mulai', 'is', null)
      .limit(1)
      .maybeSingle();
    if (sampleRow) {
      savedMulai = sampleRow.tgl_mulai;
      savedSelesai = sampleRow.tgl_selesai;
    }
  }

  // 3. Sematkan penanda grup [GRP:...] jika lebih dari 1 hari kerja agar langsung tergabung jadi 1 baris di tabel Admin
  const groupTag = targetDates.length > 1 ? `[GRP:${Date.now().toString(36)}]` : '';
  const storedKeterangan = groupTag ? `${rawKet} ${groupTag}`.trim() : rawKet || null;

  const rowsToUpsert = targetDates.map((d) => ({
    nama,
    universitas,
    tanggal: d,
    jenis,
    keterangan: storedKeterangan,
    link_surat,
    tgl_mulai: savedMulai,
    tgl_selesai: savedSelesai,
    synced_to_sheets: true,
  }));

  const { error: insertError } = await supabase
    .from('izin')
    .upsert(rowsToUpsert, { onConflict: 'nama_key,univ_key,tanggal' });

  if (insertError) {
    return NextResponse.json({ ok: false, error: 'Gagal menyimpan data izin ke database.' }, { status: 500 });
  }

  const labelRentang =
    targetDates.length === 1
      ? targetDates[0]
      : `${izin_mulai} s/d ${izin_selesai} (${targetDates.length} hari kerja)`;

  return NextResponse.json({
    ok: true,
    nama,
    tanggal: labelRentang,
    jenis,
    count: targetDates.length,
  });
}