import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { appendAbsen } from '@/lib/sheets';
import { getDayName } from '@/lib/waktu';

const CRON_SECRET = process.env.CRON_SECRET!;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Retry sync ke Google Sheets
  const { data: pending, error: selectError } = await supabase
    .from('absensi')
    .select('nama, universitas, tanggal, jam_masuk, jam_keluar, keterangan')
    .eq('synced_to_sheets', false)
    .order('waktu_kirim', { ascending: true })
    .limit(100);

  if (selectError) {
    console.error('Cron select error:', selectError);
    return NextResponse.json({ ok: false, error: 'DB select failed' }, { status: 500 });
  }

  let synced = 0;
  if (pending) {
    for (const row of pending) {
      try {
        const hari = getDayName(row.tanggal);
        await appendAbsen({
          nama: row.nama,
          universitas: row.universitas,
          tanggal: row.tanggal,
          hari,
          jam_masuk: row.jam_masuk,
          jam_keluar: row.jam_keluar,
          keterangan: row.keterangan,
        });
        await supabase
          .from('absensi')
          .update({ synced_to_sheets: true })
          .eq('nama_key', row.nama.toLowerCase().trim())
          .eq('univ_key', row.universitas.toLowerCase().trim())
          .eq('tanggal', row.tanggal);
        synced++;
      } catch (e) {
        console.error('Retry sync failed for', row, e);
      }
    }
  }

  // 2. Keepalive Supabase (query ringan)
  try {
    await supabase.from('absensi').select('nama_key').limit(1);
  } catch (e) {
    console.error('Keepalive failed:', e);
  }

  return NextResponse.json({ ok: true, synced });
}