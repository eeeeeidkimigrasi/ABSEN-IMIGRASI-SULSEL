import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { appendAbsen, updateAbsenRow, deleteAbsenRows } from '@/lib/sheets';
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

const cleanLogRow = (row: any) => {
  if (!row) return null;
  const copy = { ...row };
  delete copy.nama_key;
  delete copy.univ_key;
  return copy;
};

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
  }

  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const tanggal = body.tanggal?.trim();
  const jam_masuk = body.jam_masuk?.trim();
  const jam_keluar = body.jam_keluar?.trim() || null;
  const keterangan = body.keterangan ? rapikan(body.keterangan).slice(0, 100) : null;

  if (!nama || !universitas || !tanggal || !jam_masuk || !validateDate(tanggal) || (jam_keluar !== null && jam_keluar < jam_masuk)) {
    return NextResponse.json({ error: 'Data tidak valid atau tanggal di masa depan.' }, { status: 400 });
  }

  const nama_key = nama.toLowerCase();
  const univ_key = universitas.toLowerCase();

  const { data: izin } = await supabase
    .from('izin')
    .select('tanggal')
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .eq('tanggal', tanggal);

  // Diizinkan tambah/edit absensi walau ada izin

  const { error } = await supabase.from('absensi').insert({
    nama,
    universitas,
    tanggal,
    jam_masuk,
    jam_keluar,
    lat: null,
    lng: null,
    akurasi_gps: null,
    keterangan,
    synced_to_sheets: false,
  });

  if (error) {
    console.error('Insert absensi admin error:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Data absensi untuk nama, universitas, dan tanggal tersebut sudah ada.' }, { status: 409 });
    }
    return NextResponse.json({ error: `Gagal menambah data: ${error.message}` }, { status: 500 });
  }

  const hari = getDayName(tanggal);
  let sheets_ok = true;
  try {
    await appendAbsen({ nama, universitas, tanggal, hari, jam_masuk, jam_keluar, keterangan });
    await supabase
      .from('absensi')
      .update({ synced_to_sheets: true })
      .eq('nama_key', nama_key)
      .eq('univ_key', univ_key)
      .eq('tanggal', tanggal);
  } catch (err) {
    console.error('Sheets appendAbsen error:', err);
    sheets_ok = false;
  }

  await supabase.from('admin_log').insert({
    aksi: 'tambah',
    tabel: 'absensi',
    sebelum: null,
    sesudah: { nama, universitas, tanggal, jam_masuk, jam_keluar, keterangan },
    sheets_ok,
  });

  return NextResponse.json({ ok: true, sheets_ok });
}

export async function PUT(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
  }

  const oldNama = rapikan(body.oldNama ?? body.old_nama ?? '');
  const oldUniv = rapikan(body.oldUniv ?? body.oldUniversitas ?? body.old_universitas ?? '');
  const oldTanggal = (body.oldTanggal ?? body.old_tanggal ?? '').trim();

  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const tanggal = body.tanggal?.trim();
  const jam_masuk = body.jam_masuk?.trim();
  const jam_keluar = body.jam_keluar?.trim() || null;
  const keterangan = body.keterangan ? rapikan(body.keterangan).slice(0, 100) : null;

  if (!oldNama || !oldUniv || !oldTanggal || !nama || !universitas || !tanggal || !jam_masuk || !validateDate(tanggal) || (jam_keluar !== null && jam_keluar < jam_masuk)) {
    return NextResponse.json({ error: 'Data tidak valid atau tanggal di masa depan.' }, { status: 400 });
  }

  const old_nama_key = oldNama.toLowerCase();
  const old_univ_key = oldUniv.toLowerCase();
  const new_nama_key = nama.toLowerCase();
  const new_univ_key = universitas.toLowerCase();

  const { data: izin } = await supabase
    .from('izin')
    .select('tanggal')
    .eq('nama_key', new_nama_key)
    .eq('univ_key', new_univ_key)
    .eq('tanggal', tanggal);

  // Diizinkan tambah/edit absensi walau ada izin

  const { data: oldRow } = await supabase
    .from('absensi')
    .select('*')
    .eq('nama_key', old_nama_key)
    .eq('univ_key', old_univ_key)
    .eq('tanggal', oldTanggal)
    .maybeSingle();

  if (!oldRow) {
    return NextResponse.json({ error: 'Data lama tidak ditemukan.' }, { status: 404 });
  }

  const { error } = await supabase
    .from('absensi')
    .update({
      nama,
      universitas,
      tanggal,
      jam_masuk,
      jam_keluar,
      keterangan,
      synced_to_sheets: false,
    })
    .eq('nama_key', old_nama_key)
    .eq('univ_key', old_univ_key)
    .eq('tanggal', oldTanggal);

  if (error) {
    console.error('Update absensi admin error:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Konflik kunci dengan data absensi lain.' }, { status: 409 });
    }
    return NextResponse.json({ error: `Gagal memperbarui data: ${error.message}` }, { status: 500 });
  }

  const hari = getDayName(tanggal);
  let sheets_ok = true;
  try {
    await updateAbsenRow(
      { nama: oldRow.nama, universitas: oldRow.universitas, tanggal: oldRow.tanggal },
      { nama, universitas, tanggal, hari, jam_masuk, jam_keluar, keterangan: keterangan || '' }
    );
    await supabase
      .from('absensi')
      .update({ synced_to_sheets: true })
      .eq('nama_key', new_nama_key)
      .eq('univ_key', new_univ_key)
      .eq('tanggal', tanggal);
  } catch (err) {
    console.error('Sheets updateAbsenRow error:', err);
    sheets_ok = false;
  }

  await supabase.from('admin_log').insert({
    aksi: 'edit',
    tabel: 'absensi',
    sebelum: cleanLogRow(oldRow),
    sesudah: { nama, universitas, tanggal, jam_masuk, jam_keluar, keterangan },
    sheets_ok,
  });

  return NextResponse.json({ ok: true, sheets_ok });
}

export async function DELETE(req: NextRequest) {
  if (!checkCsrf(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { searchParams } = req.nextUrl;
  const nama = rapikan(body.nama || searchParams.get('nama') || '');
  const universitas = rapikan(body.universitas || searchParams.get('universitas') || '');
  const tanggal = (body.tanggal || searchParams.get('tanggal') || '').trim();

  if (!nama || !universitas || !tanggal) {
    return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 });
  }

  const nama_key = nama.toLowerCase();
  const univ_key = universitas.toLowerCase();

  const { data: oldRow } = await supabase
    .from('absensi')
    .select('*')
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .eq('tanggal', tanggal)
    .maybeSingle();

  if (!oldRow) {
    return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 });
  }

  const { error } = await supabase
    .from('absensi')
    .delete()
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .eq('tanggal', tanggal);

  if (error) {
    console.error('Delete absensi admin error:', error);
    return NextResponse.json({ error: `Gagal menghapus data: ${error.message}` }, { status: 500 });
  }

  let sheets_ok = true;
  try {
    await deleteAbsenRows(oldRow.nama, oldRow.universitas, oldRow.tanggal);
  } catch (err) {
    console.error('Sheets deleteAbsenRows error:', err);
    sheets_ok = false;
  }

  await supabase.from('admin_log').insert({
    aksi: 'hapus',
    tabel: 'absensi',
    sebelum: cleanLogRow(oldRow),
    sesudah: null,
    sheets_ok,
  });

  return NextResponse.json({ ok: true, sheets_ok });
}