import { getTodayDate, getNowTime } from './waktu';

/**
 * Aturan "Tidak Absen Pulang" (TAP) yang dipakai bersama oleh API peserta dan admin.
 *
 * Satu baris absensi dihitung sebagai pelanggaran bila:
 * 1. keterangannya bertanda [TAP], atau
 * 2. jam keluar masih kosong DAN hari sudah lewat, atau
 * 3. jam keluar masih kosong DAN hari ini sudah melewati batas jam pulang (WITA).
 */

export const TAP_TAG = '[TAP]';

const DEFAULT_BATAS_JAM_PULANG = '17:00';

/** Batas jam pulang (HH:mm, WITA). Bisa diatur lewat env BATAS_JAM_PULANG. */
export function getBatasJamPulang(): string {
  const v = (process.env.BATAS_JAM_PULANG || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : DEFAULT_BATAS_JAM_PULANG;
}

export type SpContext = { today: string; nowTime: string; batas: string };

export function getSpContext(): SpContext {
  return { today: getTodayDate(), nowTime: getNowTime(), batas: getBatasJamPulang() };
}

export function hasTapTag(ket: unknown): boolean {
  return typeof ket === 'string' && ket.includes(TAP_TAG);
}

export function stripTapTag(ket: unknown): string {
  return typeof ket === 'string' ? ket.split(TAP_TAG).join('').trim() : '';
}

export function isTidakAbsenPulang(
  row: { tanggal: string; jam_keluar?: string | null; keterangan?: string | null },
  ctx: SpContext,
  opts: { hariIniMelewatiBatas?: boolean } = {}
): boolean {
  const { hariIniMelewatiBatas = true } = opts;
  if (hasTapTag(row.keterangan)) return true;
  if (row.jam_keluar) return false;
  if (row.tanggal < ctx.today) return true;
  return hariIniMelewatiBatas && row.tanggal === ctx.today && ctx.nowTime >= ctx.batas;
}
