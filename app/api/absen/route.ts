import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { appendAbsen } from '@/lib/sheets';
import { jarakMeter } from '@/lib/geo';
import { getTodayDate, getDayName } from '@/lib/waktu';

const OFFICE_LAT = Number(process.env.OFFICE_LAT);
const OFFICE_LNG = Number(process.env.OFFICE_LNG);
const RADIUS_METER = Number(process.env.RADIUS_METER || 150);

if (isNaN(OFFICE_LAT) || isNaN(OFFICE_LNG)) {
  throw new Error('OFFICE_LAT and OFFICE_LNG must be set');
}

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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Terlalu banyak permintaan, coba lagi nanti.' }, { status: 429 });
  }

  let body: {
    nama?: string;
    universitas?: string;
    jam_masuk?: string;
    jam_keluar?: string;
    lat?: number;
    lng?: number;
    akurasi_gps?: number;
    konfirmasi_baru?: boolean;
    keterangan?: string;
  };

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
  const jam_masuk = body.jam_masuk?.trim();
  const jam_keluar = body.jam_keluar?.trim();
  const lat = body.lat;
  const lng = body.lng;
  const akurasi_gps = body.akurasi_gps;
  const keterangan = body.keterangan ? rapikan(body.keterangan).slice(0, 100) : null;

  if (!nama || !universitas || !jam_masuk || !jam_keluar) {
    return NextResponse.json({ ok: false, error: 'Isian belum lengkap.' }, { status: 400 });
  }
  if (nama.length > 80 || universitas.length > 80) {
    return NextResponse.json({ ok: false, error: 'Isian terlalu panjang.' }, { status: 400 });
  }
  if (lat == null || lng == null) {
    return NextResponse.json({ ok: false, error: 'Lokasi tidak terbaca.' }, { status: 400 });
  }

  const jarak = jarakMeter(lat, lng, OFFICE_LAT, OFFICE_LNG);
  if (jarak > RADIUS_METER) {
    return NextResponse.json(
      { ok: false, error: `Lokasi Anda di luar area kantor (${Math.round(jarak)} m).` },
      { status: 403 }
    );
  }

  const tanggal = getTodayDate();
  const hari = getDayName(tanggal);

  const existingToday = await supabase
    .from('absensi')
    .select('jam_keluar', { count: 'exact', head: true })
    .eq('nama_key', nama.toLowerCase().trim())
    .eq('univ_key', universitas.toLowerCase().trim())
    .eq('tanggal', tanggal);

  if (existingToday.count && existingToday.count > 0) {
    const row = await supabase
      .from('absensi')
      .select('jam_keluar')
      .eq('nama_key', nama.toLowerCase().trim())
      .eq('univ_key', universitas.toLowerCase().trim())
      .eq('tanggal', tanggal)
      .single();
    return NextResponse.json({ status: 'sudah_absen', jam_keluar: row.data?.jam_keluar || '' });
  }

  const existing = await supabase
    .from('absensi')
    .select('nama_key', { count: 'exact', head: true })
    .eq('nama_key', nama.toLowerCase().trim())
    .eq('univ_key', universitas.toLowerCase().trim());

  if (existing.count === 0 && !body.konfirmasi_baru) {
    return NextResponse.json({ status: 'nama_baru' });
  }

  const { error: dbError } = await supabase
    .from('absensi')
    .upsert(
      {
        nama,
        universitas,
        tanggal,
        jam_masuk,
        jam_keluar,
        lat,
        lng,
        akurasi_gps,
        keterangan,
        synced_to_sheets: false,
      },
      { onConflict: 'nama_key,univ_key,tanggal' }
    );

  if (dbError) {
    console.error('Supabase error:', dbError);
    return NextResponse.json({ ok: false, error: 'Gagal menyimpan, coba lagi.' }, { status: 500 });
  }

  try {
    await appendAbsen({ nama, universitas, tanggal, hari, jam_masuk, jam_keluar, keterangan });
    await supabase
      .from('absensi')
      .update({ synced_to_sheets: true })
      .eq('nama_key', nama.toLowerCase().trim())
      .eq('univ_key', universitas.toLowerCase().trim())
      .eq('tanggal', tanggal);
  } catch (sheetsError) {
    console.error('Sheets sync failed:', sheetsError);
  }

  return NextResponse.json({ ok: true, nama, tanggal, jam_masuk, jam_keluar });
}