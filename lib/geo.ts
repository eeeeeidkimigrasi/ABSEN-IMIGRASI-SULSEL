/**
 * Rumus Haversine: jarak antara dua titik koordinat dalam meter.
 * @param lat1 latitude titik 1
 * @param lng1 longitude titik 1
 * @param lat2 latitude titik 2
 * @param lng2 longitude titik 2
 * @returns jarak dalam meter (float)
 */
export function jarakMeter(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Bumi radius dalam meter
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}