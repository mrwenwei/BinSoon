import type { LocationRecord } from "./locations";

export type BinState = "hungry" | "half" | "full" | "unknown";
export type BinFilter = "all" | "new" | "can-fit" | "hungry";
export const stateLabels: Record<BinState, string> = {
  hungry: "餓了",
  half: "半飽",
  full: "吃飽了",
  unknown: "狀態未知",
};
export const binFilters: { id: BinFilter; label: string }[] = [
  { id: "all", label: "全部桶況" },
  { id: "new", label: "新設的桶" },
  { id: "can-fit", label: "還能裝的桶" },
  { id: "hungry", label: "只看餓了的" },
];

// A separate presentation layer: never write simulated fields into the source snapshot.
export function binDemo(location: LocationRecord) {
  const seed = [...location.id].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const removed = seed % 19 === 0;
  const newAge = seed % 41;
  const state = removed
    ? "unknown"
    : (["hungry", "half", "full", "unknown"] as const)[seed % 4];
  return {
    state,
    capacity: { hungry: 26, half: 62, full: 94, unknown: null }[state],
    removed,
    // Ages are frozen demo scenarios, not dates from the published inventory.
    removedAge: removed ? seed % 7 : null,
    newAge,
    isNew: !removed && newAge < 30,
    adopter:
      seed % 4 === 0
        ? null
        : ["巷口日常咖啡", "綠生活小隊", "暖暖早餐店"][seed % 3],
    code: `TP-${String(location.source_row).padStart(3, "0")}`,
  };
}
export function matchesBinFilter(location: LocationRecord, filter: BinFilter) {
  if (filter === "all") return true;
  if (location.kind !== "bin") return false;
  const demo = binDemo(location);
  if (filter === "new") return demo.isNew;
  if (filter === "can-fit") return isUsableBin(location);
  return !demo.removed && demo.state === "hungry";
}

export const demoOrigin: [number, number] = [25.033, 121.5358];

// A fixed, disclosed demo starting point at Daan Park; never the user's location.
export function demoDistance(location: LocationRecord) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((location.latitude - demoOrigin[0]) * rad) / 2) ** 2 +
    Math.cos(demoOrigin[0] * rad) *
      Math.cos(location.latitude * rad) *
      Math.sin(((location.longitude - demoOrigin[1]) * rad) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
export function distanceLabel(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} 公里`
    : `${meters} 公尺`;
}

export function isUsableBin(location: LocationRecord) {
  if (location.kind !== "bin") return false;
  const demo = binDemo(location);
  return !demo.removed && ["hungry", "half"].includes(demo.state);
}
export function walkingMinutes(location: LocationRecord) {
  return Math.max(1, Math.ceil((demoDistance(location) * 1.3) / 75));
}
export function lifecycleLabel(location: LocationRecord) {
  const demo = binDemo(location);
  return demo.removed
    ? `撤除 ${demo.removedAge} 天 · 保留 7 天`
    : demo.isNew
      ? `新設 ${demo.newAge} 天 · 標示 30 天`
      : "";
}
