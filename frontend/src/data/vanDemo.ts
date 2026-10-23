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
    x: 27,
    y: 35,
  },
  {
    id: "yongkang",
    name: "永康街口",
    address: "金華街 × 永康街",
    distance: 380,
    count: 11,
    x: 68,
    y: 35,
  },
  {
    id: "jinhua",
    name: "金華街口",
    address: "金華街",
    distance: 460,
    count: 12,
    x: 55,
    y: 80,
  },
  {
    id: "lishui",
    name: "麗水街口",
    address: "金華街 × 麗水街",
    distance: 560,
    count: 10,
    x: 84,
    y: 80,
  },
  {
    id: "hangzhou",
    name: "杭州南路口",
    address: "杭州南路",
    distance: 240,
    count: 3,
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
export function countAt(
  bookings: Booking[],
  date: string,
  shift: Shift,
  stop: string,
) {
  return (
    (stops.find((s) => s.id === stop)?.count || 0) +
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
