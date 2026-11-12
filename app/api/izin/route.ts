import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { appendIzin } from '@/lib/sheets';
import { getTodayDate, getDayName } from '@/lib/waktu';

const ipHits = new Map<string, { count: number; resetAt: number }>();

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

  while (cur <= end && dates.length < 60) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' }, { status: 429 });
  }

  let body: {
    nama?: string;
    universitas?: string;
    jenis?: string;
    keterangan?: string;
    link_surat?: string;
    konfirmasi_baru?: boolean;
    tgl_mulai?: string;
    tgl_selesai?: string;
    izin_mulai?: string;
    izin_selesai?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body JSON tidak valid.' }, { status: 400 });
  }

  const rapikan = (teks: string) => teks.trim().replace(/\s+/g, ' ');

  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const jenis = body.jenis || 'Sakit';
  const keterangan = body.keterangan ? rapikan(body.keterangan).slice(0, 100) : null;
  const link_surat = body.link_surat ? body.link_surat.trim().slice(0, 300) : null;
  const todayStr = getTodayDate();

  const izin_mulai = (body.izin_mulai || todayStr).trim();
  const izin_selesai = (body.izin_selesai || izin_mulai).trim();

  if (!nama || !universitas) {
    return NextResponse.json({ ok: false, error: 'Nama dan universitas wajib diisi.' }, { status: 400 });
  }
  if (!['Sakit', 'Izin', 'Lainnya'].includes(jenis)) {
    return NextResponse.json({ ok: false, error: 'Jenis izin tidak valid.' }, { status: 400 });
  }
  if (izin_selesai < izin_mulai) {
    return NextResponse.json({ ok: false, error: 'Tanggal selesai izin tidak boleh lebih awal dari tanggal mulai.' }, { status: 400 });
  }

  const allRangeDates = generateDateRange(izin_mulai, izin_selesai);
  if (allRangeDates.length === 0) {
    return NextResponse.json({ ok: false, error: 'Format tanggal izin tidak valid.' }, { status: 400 });
  }
  if (allRangeDates.length > 30) {
    return NextResponse.json({ ok: false, error: 'Rentang izin maksimal 30 hari sekaligus.' }, { status: 400 });
  }

  // Jika lebih dari 1 hari, otomatis hanya ambil hari kerja (Senin-Kamis). Jika 1 hari saja, tetap proses tanggal tersebut.
  const targetDates =
    allRangeDates.length === 1
      ? allRangeDates
      : allRangeDates.filter((d) => !isWeekendOrFriday(d));

  if (targetDates.length === 0) {
    return NextResponse.json({ ok: false, error: 'Rentang tanggal yang dipilih seluruhnya jatuh pada hari libur (Jumat–Minggu).' }, { status: 400 });
  }

  const nama_key = nama.toLowerCase();
  const univ_key = universitas.toLowerCase();

  const { count: absensiAny } = await supabase
    .from('absensi')
    .select('*', { count: 'exact', head: true })
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key);

  const { count: izinAny } = await supabase
    .from('izin')
    .select('*', { count: 'exact', head: true })
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key);

  if ((!absensiAny || absensiAny === 0) && (!izinAny || izinAny === 0)) {
    if (!body.konfirmasi_baru) {
      return NextResponse.json({ status: 'nama_baru' });
    }
    const tgl_mulai = body.tgl_mulai?.trim();
    const tgl_selesai = body.tgl_selesai?.trim();
    if (!tgl_mulai || !tgl_selesai || tgl_selesai < tgl_mulai) {
      return NextResponse.json({ ok: false, error: 'Tanggal mulai dan selesai magang wajib diisi dengan benar.' }, { status: 400 });
    }
    await supabase
      .from('peserta')
      .upsert({ nama, universitas, nama_key, univ_key, tgl_mulai, tgl_selesai }, { onConflict: 'nama_key,univ_key' });
  }

  let savedMulai = body.tgl_mulai || null;
  let savedSelesai = body.tgl_selesai || null;
  if (!savedMulai || !savedSelesai) {
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

  const rowsToUpsert = targetDates.map((d) => ({
    nama,
    universitas,
    tanggal: d,
    jenis,
    keterangan,
    link_surat,
    tgl_mulai: savedMulai,
    tgl_selesai: savedSelesai,
    synced_to_sheets: false,
  }));

  const { error: dbError } = await supabase
    .from('izin')
    .upsert(rowsToUpsert, { onConflict: 'nama_key,univ_key,tanggal' });

  if (dbError) {
    console.error('Supabase error (izin):', dbError);
    return NextResponse.json({ ok: false, error: 'Gagal menyimpan izin, coba lagi.' }, { status: 500 });
  }

  for (const d of targetDates) {
    const hari = getDayName(d);
    try {
      await appendIzin({
        nama,
        universitas,
        tanggal: d,
        hari,
        jenis,
        keterangan: keterangan || '',
        link_surat: link_surat || '',
      });
      await supabase
        .from('izin')
        .update({ synced_to_sheets: true })
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key)
        .eq('tanggal', d);
    } catch (sheetsError) {
      console.error('Sheets sync failed (izin):', sheetsError);
    }
  }

  const labelTanggal =
    targetDates.length === 1
      ? targetDates[0]
      : `${izin_mulai} s/d ${izin_selesai} (${targetDates.length} hari kerja)`;

  return NextResponse.json({ ok: true, nama, tanggal: labelTanggal, jenis, total_hari: targetDates.length });
}