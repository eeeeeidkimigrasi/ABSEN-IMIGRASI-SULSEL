import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cleanupInactiveParticipants } from '@/lib/auto-clean';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Jalankan pembersihan otomatis peserta inaktif > 6 bulan & log > 90 hari
    const cleanResult = await cleanupInactiveParticipants();

    // 2. Ping hitung sisa baris absensi (menjaga Supabase tetap aktif)
    const { count } = await supabase
      .from('absensi')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      ok: true,
      status: 'alive',
      total_absensi: count || 0,
      auto_deleted_participants: cleanResult.purgedCount,
      cutoff_date_6_months: cleanResult.cutoffDate,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}