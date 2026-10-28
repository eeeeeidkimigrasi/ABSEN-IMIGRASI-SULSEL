import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { appendAbsen, deleteIzinRow, updateJamKeluarRow } from '@/lib/sheets';
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
    mode?: 'hadir' | 'pulang';
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

  const mode = body.mode || 'hadir';
  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const lat = body.lat;
  const lng = body.lng;
  const akurasi_gps = body.akurasi_gps;
  const keterangan = body.keterangan ? rapikan(body.keterangan).slice(0, 100) : null;
  const tanggal = getTodayDate();
  const nama_key = nama.toLowerCase().trim();
  const univ_key = universitas.toLowerCase().trim();

  if (!nama || !universitas) {
    return NextResponse.json({ ok: false, error: 'Nama dan universitas wajib diisi.' }, { status: 400 });
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

  if (mode === 'hadir') {
    const jam_masuk = body.jam_masuk?.trim();
    if (!jam_masuk) {
      return NextResponse.json({ ok: false, error: 'Jam masuk wajib diisi.' }, { status: 400 });
    }

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

    if ((!absensiAny || absensiAny === 0) && (!izinAny || izinAny === 0) && !body.konfirmasi_baru) {
      return NextResponse.json({ status: 'nama_baru' });
    }

    const { error: dbError } = await supabase
      .from('absensi')
      .insert({
        nama,
        universitas,
        tanggal,
        jam_masuk,
        jam_keluar: null,
        lat,
        lng,
        akurasi_gps,
        keterangan,
        synced_to_sheets: false,
      });

    if (dbError) {
      if (dbError.code === '23505') {
        const { data: row } = await supabase
          .from('absensi')
          .select('jam_masuk')
          .eq('nama_key', nama_key)
          .eq('univ_key', univ_key)
          .eq('tanggal', tanggal)
          .single();
        return NextResponse.json({ status: 'sudah_hadir_hari_ini', jam_masuk: row?.jam_masuk || '' });
      }
      console.error('Supabase error hadir:', dbError);
      return NextResponse.json({ ok: false, error: 'Gagal menyimpan, coba lagi.' }, { status: 500 });
    }

    const hari = getDayName(tanggal);
    try {
      await appendAbsen({ nama, universitas, tanggal, hari, jam_masuk, jam_keluar: '', keterangan });
      await supabase
        .from('absensi')
        .update({ synced_to_sheets: true })
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key)
        .eq('tanggal', tanggal);

      // Izin hari ini tetap dipertahankan
    } catch (e) {
      console.error('Sheets sync failed:', e);
    }

    return NextResponse.json({ ok: true, status: 'sukses_hadir', nama, tanggal, jam_masuk });
  } else if (mode === 'pulang') {
    const jam_keluar = body.jam_keluar?.trim();
    if (!jam_keluar) {
      return NextResponse.json({ ok: false, error: 'Jam keluar wajib diisi.' }, { status: 400 });
    }

    const { data: row, error: fetchError } = await supabase
      .from('absensi')
      .select('jam_masuk, jam_keluar')
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key)
      .eq('tanggal', tanggal)
      .maybeSingle();

    if (fetchError) {
      console.error('Supabase fetch error pulang:', fetchError);
      return NextResponse.json({ ok: false, error: 'Gagal memproses, coba lagi.' }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ status: 'belum_hadir' });
    }

    if (row.jam_keluar) {
      return NextResponse.json({ status: 'sudah_pulang', jam_keluar: row.jam_keluar });
    }

    if (jam_keluar < String(row.jam_masuk).slice(0, 5)) {
      return NextResponse.json({ status: 'jam_tidak_valid' });
    }

    const { error: updateError } = await supabase
      .from('absensi')
      .update({
        jam_keluar,
        keterangan,
        synced_to_sheets: false,
      })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key)
      .eq('tanggal', tanggal);

    if (updateError) {
      console.error('Supabase update error pulang:', updateError);
      return NextResponse.json({ ok: false, error: 'Gagal update jam pulang.' }, { status: 500 });
    }

    try {
      await updateJamKeluarRow({ nama, universitas, tanggal, jam_keluar, keterangan });
      await supabase
        .from('absensi')
        .update({ synced_to_sheets: true })
        .eq('nama_key', nama_key)
        .eq('univ_key', univ_key)
        .eq('tanggal', tanggal);
    } catch (e) {
      console.error('Sheets update jam keluar failed:', e);
    }

    return NextResponse.json({ ok: true, status: 'sukses_pulang', nama, tanggal, jam_keluar });
  }

  return NextResponse.json({ ok: false, error: 'Mode tidak valid.' }, { status: 400 });
}
