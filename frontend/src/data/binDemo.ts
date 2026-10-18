import type { LocationRecord } from "./locations";

export type BinState = "hungry" | "half" | "full" | "unknown";
export type BinFilter = "all" | "vehicle" | "dog" | "event" | "hungry";
export const stateLabels: Record<BinState, string> = {
  hungry: "餓了",
  half: "半飽",
  full: "吃飽了",
  unknown: "狀態未知",
};
export const binFilters: { id: BinFilter; label: string }[] = [
  { id: "all", label: "全部桶況" },
  { id: "vehicle", label: "車上垃圾可丟" },
  { id: "dog", label: "可丟狗便便" },
  { id: "event", label: "活動限定" },
  { id: "hungry", label: "只看餓了的" },
];

// A separate presentation layer: never write simulated fields into the source snapshot.
export function binDemo(location: LocationRecord) {
  const seed = [...location.id].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const state = (["hungry", "half", "full", "unknown"] as const)[seed % 4];
  return {
    state,
    capacity: { hungry: 26, half: 62, full: 94, unknown: null }[state],
    dog: seed % 2 === 0,
    vehicle: seed % 3 === 0,
    event: seed % 5 === 0,
    adopter: ["巷口日常咖啡", "綠生活小隊", "暖暖早餐店"][seed % 3],
    code: `TP-${String(location.source_row).padStart(3, "0")}`,
  };
}
export function matchesBinFilter(location: LocationRecord, filter: BinFilter) {
  if (filter === "all") return true;
  if (location.kind !== "bin") return false;
  const demo = binDemo(location);
  return filter === "hungry" ? demo.state === "hungry" : demo[filter];
}

// A fixed, disclosed demo starting point at Daan Park; never the user's location.
export function demoDistance(location: LocationRecord) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((location.latitude - 25.033) * rad) / 2) ** 2 +
    Math.cos(25.033 * rad) *
      Math.cos(location.latitude * rad) *
      Math.sin(((location.longitude - 121.5358) * rad) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
export function distanceLabel(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} 公里`
    : `${meters} 公尺`;
}
