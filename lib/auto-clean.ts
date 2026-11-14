import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetch-all';

const INACTIVE_DAYS_LIMIT = 180; // 6 Bulan

function getCutoffDateWita(daysAgo: number): string {
  const wita = new Date(Date.now() + 8 * 3600 * 1000);
  wita.setUTCDate(wita.getUTCDate() - daysAgo);
  return wita.toISOString().slice(0, 10);
}

export async function cleanupInactiveParticipants() {
  const cutoffDate = getCutoffDateWita(INACTIVE_DAYS_LIMIT);

  // 1. Ambil tanggal terakhir per peserta dari tabel absensi & izin
  const [absRows, izRows] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('absensi')
        .select('nama, universitas, nama_key, univ_key, tanggal')
        .order('tanggal', { ascending: false })
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from('izin')
        .select('nama, universitas, nama_key, univ_key, tanggal')
        .order('tanggal', { ascending: false })
        .range(from, to)
    ),
  ]);

  const lastActiveMap = new Map();

  for (const r of [...(absRows as any[]), ...(izRows as any[])]) {
    if (!r.nama_key || !r.univ_key || !r.tanggal) continue;
    const key = `${r.nama_key}|${r.univ_key}`;
    const existing = lastActiveMap.get(key);
    if (!existing || r.tanggal > existing.lastDate) {
      lastActiveMap.set(key, {
        nama: r.nama,
        universitas: r.universitas,
        nama_key: r.nama_key,
        univ_key: r.univ_key,
        lastDate: r.tanggal,
      });
    }
  }

  // 2. Cari peserta yang aktivitas terakhirnya lebih lama dari 6 bulan lalu (lastDate < cutoffDate)
  const expiredList = Array.from(lastActiveMap.values()).filter(
    (p: any) => p.lastDate < cutoffDate
  );

  let purgedCount = 0;

  for (const exp of expiredList) {
    await Promise.all([
      supabase.from('absensi').delete().eq('nama_key', exp.nama_key).eq('univ_key', exp.univ_key),
      supabase.from('izin').delete().eq('nama_key', exp.nama_key).eq('univ_key', exp.univ_key),
    ]);

    try {
      await supabase.from('peserta').delete().eq('nama_key', exp.nama_key).eq('univ_key', exp.univ_key);
    } catch {}

    await supabase.from('admin_log').insert({
      aksi: 'hapus',
      tabel: 'absensi',
      sebelum: {
        nama: exp.nama,
        universitas: exp.universitas,
        terakhir_aktif: exp.lastDate,
        alasan: 'Otomatis dihapus karena tidak aktif > 6 bulan',
      },
      sesudah: null,
      sheets_ok: true,
    });

    purgedCount++;
  }

  // 3. Bersihkan log perubahan biasa yang lebih tua dari 90 hari (kecuali hari_libur)
  const ninetyDaysAgoIso = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  await supabase
    .from('admin_log')
    .delete()
    .not('sesudah', 'is', null)
    .lt('waktu', ninetyDaysAgoIso);

  return { cutoffDate, purgedCount };
}