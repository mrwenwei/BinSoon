// 步行導航用的路線幾何：累計距離、依距離取點、切成「走過／剩下」兩段。
// 座標順序一律 [latitude, longitude]（與 Leaflet 相同）。
export type LatLng = [number, number];

const EARTH_RADIUS = 6371008.8;
function haversine(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** cum[i] = 從第 0 點走到第 i 點的公尺數。 */
export function cumulativeMeters(points: LatLng[]): number[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++)
    cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  return cum;
}

/** 走了 meters 公尺後的位置；segment 是所在線段的起點索引。超出範圍會夾住。 */
export function pointAlong(
  points: LatLng[],
  cum: number[],
  meters: number,
): { point: LatLng; segment: number } {
  const total = cum[cum.length - 1] || 0;
  const d = Math.min(Math.max(meters, 0), total);
  let segment = 0;
  while (segment < points.length - 2 && cum[segment + 1] < d) segment++;
  const span = cum[segment + 1] - cum[segment];
  const t = span > 0 ? (d - cum[segment]) / span : 0;
  const a = points[segment];
  const b = points[segment + 1] || a;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    segment,
  };
}

export function splitRoute(
  points: LatLng[],
  cum: number[],
  meters: number,
): { walked: LatLng[]; remaining: LatLng[]; here: LatLng } {
  if (points.length < 2 || meters <= 0)
    return { walked: [], remaining: points, here: points[0] };
  const { point, segment } = pointAlong(points, cum, meters);
  return {
    walked: [...points.slice(0, segment + 1), point],
    remaining: [point, ...points.slice(segment + 1)],
    here: point,
  };
}
