
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
  const jenis = body.jenis?.trim();
  const keterangan = body.keterangan ? rapikan(body.keterangan).slice(0, 100) : null;
  const link_surat = body.link_surat ? rapikan(body.link_surat) : null;

  if (!nama || !universitas || !jenis) {
    return NextResponse.json({ ok: false, error: 'Isian belum lengkap.' }, { status: 400 });
  }
  if (nama.length > 80 || universitas.length > 80) {
    return NextResponse.json({ ok: false, error: 'Isian terlalu panjang.' }, { status: 400 });
  }
  if (!['Sakit', 'Izin', 'Lainnya'].includes(jenis)) {
    return NextResponse.json({ ok: false, error: 'Jenis izin tidak valid.' }, { status: 400 });
  }

  if (link_surat) {
    if (link_surat.length > 300) {
      return NextResponse.json({ ok: false, error: 'Link surat maksimal 300 karakter.' }, { status: 400 });
    }
    if (/\s/.test(link_surat) || /["']/.test(link_surat)) {
      return NextResponse.json({ ok: false, error: 'Link surat tidak boleh mengandung spasi atau tanda kutip.' }, { status: 400 });
    }
    if (!link_surat.startsWith('https://drive.google.com/') && !link_surat.startsWith('https://docs.google.com/')) {
      return NextResponse.json({ ok: false, error: 'Link surat harus diawali https://drive.google.com/ atau https://docs.google.com/.' }, { status: 400 });
    }
  }

  const tanggal = getTodayDate();
  const hari = getDayName(tanggal);
  const nama_key = nama.toLowerCase().trim();
  const univ_key = universitas.toLowerCase().trim();

  // 1. Cek sudah hadir hari ini
  const { count: hadirCount } = await supabase
    .from('absensi')
    .select('*', { count: 'exact', head: true })
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .eq('tanggal', tanggal);

  // Diizinkan izin walau sudah hadir

  // 2. Cek sudah izin hari ini
  const { count: izinCount } = await supabase
    .from('izin')
    .select('*', { count: 'exact', head: true })
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .eq('tanggal', tanggal);

  if (izinCount && izinCount > 0) {
    return NextResponse.json({ status: 'sudah_izin' });
  }

  // 3. Cek nama baru (di absensi DAN izin)
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

  // 4. Insert ke tabel izin
  const { error: dbError } = await supabase
    .from('izin')
    .upsert(
      {
        nama,
        universitas,
        tanggal,
        jenis,
        keterangan,
        link_surat,
        synced_to_sheets: false,
      },
      { onConflict: 'nama_key,univ_key,tanggal' }
    );

  if (dbError) {
    console.error('Supabase error (izin):', dbError);
    return NextResponse.json({ ok: false, error: 'Gagal menyimpan izin, coba lagi.' }, { status: 500 });
  }

  try {
    await appendIzin({
      nama,
      universitas,
      tanggal,
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
      .eq('tanggal', tanggal);
  } catch (sheetsError) {
    console.error('Sheets sync failed (izin):', sheetsError);
  }

  return NextResponse.json({ ok: true, nama, tanggal, jenis });
}