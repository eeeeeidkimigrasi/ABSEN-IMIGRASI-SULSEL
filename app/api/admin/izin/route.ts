import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { appendIzin, updateIzinRow, deleteIzinRow } from '@/lib/sheets';
import { getDayName } from '@/lib/waktu';

const rapikan = (teks: string) => teks.trim().replace(/\s+/g, ' ');

const isValidDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return dateObj.toISOString().slice(0, 10) === date;
};

function isWeekendOrFriday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 5 || day === 6;
}

function generateDateRange(startStr: string, endStr: string): string[] {
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
  const tanggal = (body.tanggal || '').trim();
  const tanggal_selesai = (body.tanggal_selesai || tanggal).trim();
  const jenis = (body.jenis || 'Sakit').trim();
  const keterangan = body.keterangan ? rapikan(String(body.keterangan)).slice(0, 100) : null;
  const link_surat = body.link_surat ? String(body.link_surat).trim().slice(0, 300) : null;

  if (!nama || !universitas || !tanggal || !isValidDate(tanggal) || !isValidDate(tanggal_selesai) || tanggal_selesai < tanggal) {
    return NextResponse.json({ error: 'Data nama, universitas, atau rentang tanggal izin tidak valid.' }, { status: 400 });
  }

  const allDates = generateDateRange(tanggal, tanggal_selesai);
  if (allDates.length === 0 || allDates.length > 45) {
    return NextResponse.json({ error: 'Rentang izin maksimal 45 hari.' }, { status: 400 });
  }

  const targetDates = allDates.length === 1 ? allDates : allDates.filter((d) => !isWeekendOrFriday(d));
  if (targetDates.length === 0) {
    return NextResponse.json({ error: 'Seluruh tanggal yang dipilih jatuh pada hari libur (Jumat-Minggu).' }, { status: 400 });
  }

  const nama_key = nama.toLowerCase();
  const univ_key = universitas.toLowerCase();

  let savedMulai: string | null = null;
  let savedSelesai: string | null = null;
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

  const { error } = await supabase
    .from('izin')
    .upsert(rowsToUpsert, { onConflict: 'nama_key,univ_key,tanggal' });

  if (error) {
    console.error('Insert izin admin error:', error);
    return NextResponse.json({ error: `Gagal menambah izin: ${error.message}` }, { status: 500 });
  }

  let sheets_ok = true;
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
    } catch (err) {
      console.error('Sheets appendIzin error:', err);
      sheets_ok = false;
    }
  }

  await supabase.from('admin_log').insert({
    aksi: 'tambah',
    tabel: 'izin',
    sebelum: null,
    sesudah: { nama, universitas, rentang: `${tanggal} s/d ${tanggal_selesai}`, jumlah_hari: targetDates.length, jenis, keterangan, link_surat },
    sheets_ok,
  });

  return NextResponse.json({ ok: true, sheets_ok, count: targetDates.length });
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
  const oldTanggalList: string[] = Array.isArray(body.oldTanggalList) && body.oldTanggalList.length > 0
    ? body.oldTanggalList
    : (oldTanggal ? [oldTanggal] : []);

  const nama = rapikan(body.nama || '');
  const universitas = rapikan(body.universitas || '');
  const tanggal = (body.tanggal || '').trim();
  const tanggal_selesai = (body.tanggal_selesai || tanggal).trim();
  const jenis = (body.jenis || 'Sakit').trim();
  const keterangan = body.keterangan ? rapikan(String(body.keterangan)).slice(0, 100) : null;
  const link_surat = body.link_surat ? String(body.link_surat).trim().slice(0, 300) : null;

  if (!oldNama || !oldUniv || oldTanggalList.length === 0 || !nama || !universitas || !tanggal || !isValidDate(tanggal) || !isValidDate(tanggal_selesai) || tanggal_selesai < tanggal) {
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  }

  const old_nama_key = oldNama.toLowerCase();
  const old_univ_key = oldUniv.toLowerCase();
  const new_nama_key = nama.toLowerCase();
  const new_univ_key = universitas.toLowerCase();

  // Jika hanya 1 tanggal dan tanggal tidak berubah jadi rentang
  if (oldTanggalList.length === 1 && tanggal === tanggal_selesai) {
    const { data: oldRow } = await supabase
      .from('izin')
      .select('*')
      .eq('nama_key', old_nama_key)
      .eq('univ_key', old_univ_key)
      .eq('tanggal', oldTanggalList[0])
      .maybeSingle();

    if (!oldRow) {
      return NextResponse.json({ error: 'Data izin lama tidak ditemukan.' }, { status: 404 });
    }

    const { error } = await supabase
      .from('izin')
      .update({
        nama,
        universitas,
        tanggal,
        jenis,
        keterangan,
        link_surat,
        synced_to_sheets: false,
      })
      .eq('nama_key', old_nama_key)
      .eq('univ_key', old_univ_key)
      .eq('tanggal', oldTanggalList[0]);

    if (error) {
      return NextResponse.json({ error: `Gagal memperbarui izin: ${error.message}` }, { status: 500 });
    }

    const hari = getDayName(tanggal);
    let sheets_ok = true;
    try {
      await updateIzinRow(
        { nama: oldRow.nama, universitas: oldRow.universitas, tanggal: oldRow.tanggal },
        { nama, universitas, tanggal, hari, jenis, keterangan, link_surat }
      );
      await supabase
        .from('izin')
        .update({ synced_to_sheets: true })
        .eq('nama_key', new_nama_key)
        .eq('univ_key', new_univ_key)
        .eq('tanggal', tanggal);
    } catch (err) {
      console.error('Sheets updateIzinRow error:', err);
      sheets_ok = false;
    }

    await supabase.from('admin_log').insert({
      aksi: 'edit',
      tabel: 'izin',
      sebelum: cleanLogRow(oldRow),
      sesudah: { nama, universitas, tanggal, jenis, keterangan, link_surat },
      sheets_ok,
    });

    return NextResponse.json({ ok: true, sheets_ok });
  }

  // Jika mengubah grup izin rentang beberapa hari
  const allDates = generateDateRange(tanggal, tanggal_selesai);
  const targetDates = allDates.length === 1 ? allDates : allDates.filter((d) => !isWeekendOrFriday(d));
  if (targetDates.length === 0) {
    return NextResponse.json({ error: 'Seluruh tanggal yang dipilih jatuh pada hari libur (Jumat-Minggu).' }, { status: 400 });
  }

  const { data: oldRows } = await supabase
    .from('izin')
    .select('*')
    .eq('nama_key', old_nama_key)
    .eq('univ_key', old_univ_key)
    .in('tanggal', oldTanggalList);

  const savedMulai = oldRows?.[0]?.tgl_mulai || null;
  const savedSelesai = oldRows?.[0]?.tgl_selesai || null;

  await supabase
    .from('izin')
    .delete()
    .eq('nama_key', old_nama_key)
    .eq('univ_key', old_univ_key)
    .in('tanggal', oldTanggalList);

  const rowsToInsert = targetDates.map((d) => ({
    nama,
    universitas,
    tanggal: d,
    jenis,
    keterangan,
    link_surat,
    tgl_mulai: savedMulai,
    tgl_selesai: savedSelesai,
    synced_to_sheets: true,
  }));

  const { error: insErr } = await supabase
    .from('izin')
    .upsert(rowsToInsert, { onConflict: 'nama_key,univ_key,tanggal' });

  if (insErr) {
    return NextResponse.json({ error: `Gagal memperbarui rentang izin: ${insErr.message}` }, { status: 500 });
  }

  await supabase.from('admin_log').insert({
    aksi: 'edit_rentang',
    tabel: 'izin',
    sebelum: { nama: oldNama, universitas: oldUniv, tanggal_lama: oldTanggalList },
    sesudah: { nama, universitas, rentang_baru: `${tanggal} s/d ${tanggal_selesai}`, jumlah_hari: targetDates.length, jenis, keterangan },
    sheets_ok: true,
  });

  return NextResponse.json({ ok: true, sheets_ok: true });
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
  const tanggalList: string[] = Array.isArray(body.tanggal_list) && body.tanggal_list.length > 0
    ? body.tanggal_list
    : (tanggal ? [tanggal] : []);

  if (!nama || !universitas || tanggalList.length === 0) {
    return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 });
  }

  const nama_key = nama.toLowerCase();
  const univ_key = universitas.toLowerCase();

  const { data: oldRows } = await supabase
    .from('izin')
    .select('*')
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .in('tanggal', tanggalList);

  if (!oldRows || oldRows.length === 0) {
    return NextResponse.json({ error: 'Data izin tidak ditemukan.' }, { status: 404 });
  }

  const { error } = await supabase
    .from('izin')
    .delete()
    .eq('nama_key', nama_key)
    .eq('univ_key', univ_key)
    .in('tanggal', tanggalList);

  if (error) {
    console.error('Delete izin admin error:', error);
    return NextResponse.json({ error: `Gagal menghapus izin: ${error.message}` }, { status: 500 });
  }

  let sheets_ok = true;
  for (const r of oldRows) {
    try {
      await deleteIzinRow(r.nama, r.universitas, r.tanggal);
    } catch (err) {
      console.error('Sheets deleteIzinRow error:', err);
      sheets_ok = false;
    }
  }

  await supabase.from('admin_log').insert({
    aksi: 'hapus',
    tabel: 'izin',
    sebelum: oldRows.length === 1 ? cleanLogRow(oldRows[0]) : { nama, universitas, dihapus_tanggal: tanggalList },
    sesudah: null,
    sheets_ok,
  });

  return NextResponse.json({ ok: true, sheets_ok });
}