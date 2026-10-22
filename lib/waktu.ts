/**
 * Helper untuk mendapatkan tanggal dan bulan dalam zona Asia/Makassar (WITA, UTC+8).
 */

const TIME_ZONE = 'Asia/Makassar';

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD (WITA).
 */
export function getTodayDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // "2026-10-22"
}

/**
 * Mengembalikan bulan dan tahun dalam format YYYY-MM (WITA).
 */
export function getThisMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  return parts; // "2026-10"
}