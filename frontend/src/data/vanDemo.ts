// Independent local demonstration ledger; never sent to the backend.
export type Shift = "morning" | "evening";
export type Booking = { id: string; date: string; shift: Shift; stop: string };
export const VAN_KEY = "binsoon-van-v1";
export const stops = [
  {
    id: "dongmen",
    name: "東門站 5 號出口",
    address: "信義路二段",
    distance: 120,
    count: 6,
    lat: 25.03358,
    lng: 121.52955,
    x: 27,
    y: 35,
  },
  {
    id: "yongkang",
    name: "永康街口",
    address: "金華街 × 永康街",
    distance: 380,
    count: 11,
    lat: 25.03032,
    lng: 121.5298,
    x: 68,
    y: 35,
  },
  {
    id: "jinhua",
    name: "金華街口",
    address: "金華街",
    distance: 460,
    count: 12,
    lat: 25.03035,
    lng: 121.5312,
    x: 55,
    y: 80,
  },
  {
    id: "lishui",
    name: "麗水街口",
    address: "金華街 × 麗水街",
    distance: 560,
    count: 10,
    lat: 25.03042,
    lng: 121.52863,
    x: 84,
    y: 80,
  },
  {
    id: "hangzhou",
    name: "杭州南路口",
    address: "杭州南路",
    distance: 240,
    count: 3,
    lat: 25.03025,
    lng: 121.52685,
    x: 44,
    y: 70,
  },
] as const;
export const shifts = {
  morning: { name: "早班", time: "6:00–7:30" },
  evening: { name: "晚班", time: "21:00–22:30" },
};
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return today(d);
}
export function availableDates() {
  return Array.from({ length: 7 }, (_, i) => addDays(today(), i + 1));
}
export function dateLabel(date: string) {
  const d = new Date(`${date}T12:00:00+08:00`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${"日一二三四五六"[d.getUTCDay()]}）`;
}
export function readBookings(): Booking[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(VAN_KEY) || "[]");
    return Array.isArray(data)
      ? data.filter(
          (b): b is Booking =>
            !!b &&
            typeof b.id === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
            b.shift in shifts &&
            stops.some((s) => s.id === b.stop),
        )
      : [];
  } catch {
    return [];
  }
}
export function writeBookings(bookings: Booking[]) {
  localStorage.setItem(VAN_KEY, JSON.stringify(bookings));
  window.dispatchEvent(new Event("van-updated"));
}
// 示範用的預設人數：以站點的 count 為基準，依日期與時段固定地上下浮動（不隨機），
// 讓各站各日各時段有「差 1–3 人」「已開站」「差很多」的變化。CrewVan 也讀這個數字。
const BASE_DELTA = [0, -3, 1, -4, 2, -2, 3, -1, 1, -5, 0, 2, -2];
export function baseCount(stop: string, date: string, shift: Shift) {
  const index = stops.findIndex((s) => s.id === stop);
  if (index < 0) return 0;
  const day = Number(date.slice(8, 10)) || 0;
  const h = day * 5 + (shift === "evening" ? 3 : 0) + index * 7;
  return Math.max(0, stops[index].count + BASE_DELTA[h % BASE_DELTA.length]);
}
export function countAt(
  bookings: Booking[],
  date: string,
  shift: Shift,
  stop: string,
) {
  return (
    baseCount(stop, date, shift) +
    bookings.filter(
      (b) => b.date === date && b.shift === shift && b.stop === stop,
    ).length
  );
}
export function routeFor(bookings: Booking[], date: string, shift: Shift) {
  const all = stops.map((s) => ({
    ...s,
    count: countAt(bookings, date, shift, s.id),
  }));
  const open = all
    .filter((s) => s.count >= 10)
    .sort(
      (a, b) =>
        ["jinhua", "yongkang", "lishui", "dongmen", "hangzhou"].indexOf(a.id) -
        ["jinhua", "yongkang", "lishui", "dongmen", "hangzhou"].indexOf(b.id),
    );
  if (!open.length)
    open.push(all.reduce((a, b) => (a.count >= b.count ? a : b)));
  return open.map((s) => {
    const merged = all.filter(
      (p) =>
        !open.includes(p) &&
        open.reduce((a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) <= Math.hypot(b.x - p.x, b.y - p.y)
            ? a
            : b,
        ).id === s.id,
    );
    return {
      ...s,
      merged,
      total: s.count + merged.reduce((n, p) => n + p.count, 0),
    };
  });
}

// 市民端「使用者位置」：沿用桶地圖的示意起點（components/api/mapShared 的 ORIGIN）。
// distance 欄位保留給舊資料，市民端改用 distanceM() 由經緯度算出（haversine）。
export const VAN_ORIGIN = { latitude: 25.033, longitude: 121.5358 };
export const vanCoordinates: Record<string, [number, number]> =
  Object.fromEntries(stops.map((s) => [s.id, [s.lat, s.lng]]));
export function distanceM(stop: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const dLat = (stop.lat - VAN_ORIGIN.latitude) * r;
  const dLng = (stop.lng - VAN_ORIGIN.longitude) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(stop.lat * r) *
      Math.cos(VAN_ORIGIN.latitude * r) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}
export function distanceText(m: number) {
  return m < 1000 ? `${m} 公尺` : `${(m / 1000).toFixed(1)} 公里`;
}
export const NEAR_M = 800;
export const OPEN_AT = 10;
export function needAt(
  bookings: Booking[],
  date: string,
  shift: Shift,
  stop: string,
) {
  return Math.max(0, OPEN_AT - countAt(bookings, date, shift, stop));
}
export function shortDate(date: string) {
  return dateLabel(date).split("（")[0];
}
export function slotNeedText(need: number) {
  return need > 0 ? `差 ${need} 人開站` : "已開站 ✓";
}
// 未來七天 × 兩個時段裡最快成團的一格（差最少人；同樣就取最早）。
export function bestSlot(bookings: Booking[], stop: string) {
  let best: { date: string; shift: Shift; need: number } | undefined;
  for (const date of availableDates())
    for (const shift of Object.keys(shifts) as Shift[]) {
      const need = needAt(bookings, date, shift, stop);
      if (!best || need < best.need) best = { date, shift, need };
    }
  return best!;
}
