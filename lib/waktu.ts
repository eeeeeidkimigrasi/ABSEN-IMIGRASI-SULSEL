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

/**
 * Mengembalikan nama hari dalam bahasa Indonesia dari tanggal YYYY-MM-DD (WITA).
 * Contoh: "Senin", "Selasa", dst.
 */
export function getDayName(tanggal: string): string {
  const [year, month, day] = tanggal.split('-').map(Number);
  // Date month is 0-indexed
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIME_ZONE,
    weekday: 'long',
  }).format(date);
}