import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { appendIzin, updateIzinRow, deleteIzinRow } from '@/lib/sheets';
import { getTodayDate, getDayName } from '@/lib/waktu';

const rapikan = (teks: string) => teks.trim().replace(/\s+/g, ' ');

const validateDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  if (dateObj.toISOString().slice(0, 10) !== date) return false;
  return date <= getTodayDate();
};

const checkCsrf = (req: NextRequest) => {
  const origin = req.headers.get('origin');
  if (origin) {
    const url = new URL(req.url);
    if (origin !== url.origin) return false;
  }
  return true;
};

const validateLinkSurat = (link: string | null | undefined): boolean => {
  if (!link) return true;
  const trimmed = link.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com';
  } catch {
    return false;
  }
};

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (req.headers.get('content-type') !== 'application/json') return NextResponse.json({ error: 'JSON only' }, { status: 400 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 }); }

  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const tanggal = body.tanggal;
  const jenis = body.jenis?.trim();
  const keterangan = body.keterangan ? rapikan(body.keterangan).slice(0, 100) : null;
  const link_surat = body.link_surat ? body.link_surat.trim() : null;

  if (!nama || !universitas || !tanggal || !jenis || !validateDate(tanggal)) {
    return NextResponse.json({ error: 'Data tidak lengkap atau tanggal tidak valid.' }, { status: 400 });
  }

  if (!['Sakit', 'Izin', 'Lainnya'].includes(jenis)) {
    return NextResponse.json({ error: 'Jenis tidak valid.' }, { status: 400 });
  }

  if (!validateLinkSurat(link_surat)) {
    return NextResponse.json({ error: 'Link surat tidak valid.' }, { status: 400 });
  }

  const nama_key = nama.toLowerCase();
  const univ_key = universitas.toLowerCase();

  const { data: absensiConflict } = await supabase
    .from('absensi')
    .select('id')
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .eq('tanggal', tanggal)
    .maybeSingle();

  // Diizinkan tambah/edit izin walau ada absensi

  const { data: izinConflict } = await supabase
    .from('izin')
    .select('id')
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .eq('tanggal', tanggal)
    .maybeSingle();

  if (izinConflict) {
    return NextResponse.json({ error: 'Data izin untuk nama, universitas, dan tanggal tersebut sudah ada' }, { status: 409 });
  }

  const { data: insertedRow, error: insertError } = await supabase
    .from('izin')
    .insert({
      nama,
      universitas,
      tanggal,
      jenis,
      keterangan: keterangan || null,
      link_surat: link_surat || null,
      synced_to_sheets: false
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Gagal menambah data.' }, { status: 500 });
  }

  let sheets_ok = false;
  try {
    await appendIzin({
      nama,
      universitas,
      tanggal,
      hari: getDayName(tanggal),
      jenis,
      keterangan: keterangan || '',
      link_surat: link_surat || ''
    });
    sheets_ok = true;
    await supabase
      .from('izin')
      .update({ synced_to_sheets: true })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key)
      .eq('tanggal', tanggal);
  } catch {
    sheets_ok = false;
  }

  const { nama_key: n, univ_key: u, ...logSesudah } = insertedRow as any;

  await supabase.from('admin_log').insert({
    aksi: 'tambah',
    tabel: 'izin',
    sebelum: null,
    sesudah: logSesudah,
    sheets_ok
  });

  return NextResponse.json({ success: true, data: insertedRow, sheets_ok });
}

export async function PUT(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (req.headers.get('content-type') !== 'application/json') return NextResponse.json({ error: 'JSON only' }, { status: 400 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 }); }

  const oldNama = rapikan((body.old_nama ?? body.oldNama) || '');
  const oldUniv = rapikan((body.old_universitas ?? body.oldUniversitas) || '');
  const oldTanggal = body.old_tanggal ?? body.oldTanggal;

  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const tanggal = body.tanggal;
  const jenis = body.jenis?.trim();
  const keterangan = body.keterangan ? rapikan(body.keterangan).slice(0, 100) : null;
  const link_surat = body.link_surat ? body.link_surat.trim() : null;

  if (!oldNama || !oldUniv || !oldTanggal || !nama || !universitas || !tanggal || !jenis || !validateDate(tanggal)) {
    return NextResponse.json({ error: 'Data tidak lengkap atau tanggal tidak valid.' }, { status: 400 });
  }

  if (!['Sakit', 'Izin', 'Lainnya'].includes(jenis)) {
    return NextResponse.json({ error: 'Jenis tidak valid.' }, { status: 400 });
  }

  if (keterangan && keterangan.length > 100) {
    return NextResponse.json({ error: 'Keterangan maksimal 100 karakter.' }, { status: 400 });
  }

  if (!validateLinkSurat(link_surat)) {
    return NextResponse.json({ error: 'Link surat tidak valid.' }, { status: 400 });
  }

  const oldNamaKey = oldNama.toLowerCase();
  const oldUnivKey = oldUniv.toLowerCase();
  const namaKey = nama.toLowerCase();
  const univKey = universitas.toLowerCase();

  const { data: oldRow } = await supabase
    .from('izin')
    .select('*')
    .eq('nama_key', oldNamaKey)
    .eq('univ_key', oldUnivKey)
    .eq('tanggal', oldTanggal)
    .maybeSingle();

  if (!oldRow) {
    return NextResponse.json({ error: 'Data izin tidak ditemukan' }, { status: 404 });
  }

  const keyChanged = oldNamaKey !== namaKey || oldUnivKey !== univKey || oldTanggal !== tanggal;

  if (keyChanged) {
    const { data: izinConflict } = await supabase
      .from('izin')
      .select('id')
      .eq('nama_key', namaKey)
      .eq('univ_key', univKey)
      .eq('tanggal', tanggal)
      .maybeSingle();

    if (izinConflict) {
      return NextResponse.json({ error: 'Data izin untuk nama, universitas, dan tanggal tujuan sudah ada' }, { status: 409 });
    }

    const { data: absensiConflict } = await supabase
      .from('absensi')
      .select('id')
      .eq('nama_key', namaKey)
      .eq('univ_key', univKey)
      .eq('tanggal', tanggal)
      .maybeSingle();

    // Diizinkan tambah/edit izin walau ada absensi
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from('izin')
    .update({
      nama,
      universitas,
      tanggal,
      jenis,
      keterangan: keterangan || null,
      link_surat: link_surat || null
    })
    .eq('nama_key', oldNamaKey)
    .eq('univ_key', oldUnivKey)
    .eq('tanggal', oldTanggal)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: 'Gagal memperbarui data.' }, { status: 500 });
  }

  let sheets_ok = true;
  try {
    await updateIzinRow(
      { nama: oldRow.nama, universitas: oldRow.universitas, tanggal: oldRow.tanggal },
      { nama, universitas, tanggal, hari: getDayName(tanggal), jenis, keterangan: keterangan || '', link_surat: link_surat || '' }
    );
  } catch {
    sheets_ok = false;
  }

  const { nama_key: n1, univ_key: u1, ...cleanOldRow } = oldRow as any;
  const { nama_key: n2, univ_key: u2, ...cleanUpdatedRow } = updatedRow as any;

  await supabase.from('admin_log').insert({
    aksi: 'edit',
    tabel: 'izin',
    sebelum: cleanOldRow,
    sesudah: cleanUpdatedRow,
    sheets_ok
  });

  return NextResponse.json({ ok: true, sheets_ok });
}

export async function DELETE(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (req.headers.get('content-type') !== 'application/json') return NextResponse.json({ error: 'JSON only' }, { status: 400 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 }); }

  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const tanggal = body.tanggal;

  if (!nama || !universitas || !tanggal) {
    return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 });
  }

  const namaKey = nama.toLowerCase();
  const univKey = universitas.toLowerCase();

  const { data: existingRow } = await supabase
    .from('izin')
    .select('*')
    .eq('nama_key', namaKey)
    .eq('univ_key', univKey)
    .eq('tanggal', tanggal)
    .maybeSingle();

  if (!existingRow) {
    return NextResponse.json({ error: 'Data izin tidak ditemukan' }, { status: 404 });
  }

  const { error } = await supabase
    .from('izin')
    .delete()
    .eq('nama_key', namaKey)
    .eq('univ_key', univKey)
    .eq('tanggal', tanggal);

  if (error) {
    return NextResponse.json({ error: 'Gagal menghapus data.' }, { status: 500 });
  }

  let sheets_ok = true;
  try {
    await deleteIzinRow(existingRow.nama, existingRow.universitas, existingRow.tanggal);
  } catch {
    sheets_ok = false;
  }

  const { nama_key: n, univ_key: u, ...cleanExistingRow } = existingRow as any;

  await supabase.from('admin_log').insert({
    aksi: 'hapus',
    tabel: 'izin',
    sebelum: cleanExistingRow,
    sesudah: null,
    sheets_ok
  });

  return NextResponse.json({ ok: true, sheets_ok });
}

