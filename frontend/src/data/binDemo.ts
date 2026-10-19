import type { OperationalState } from "./workOrders";
import type { LocationRecord } from "./locations";

import {
  stateFromCapacity,
  stationState,
  stateLabels,
  wasteTypes,
  type BinState,
  type WasteType,
} from "./binState";
export { stateLabels, type BinState, type WasteType };

export type BinFilter = "all" | "new" | "hungry";
export const binFilters: { id: BinFilter; label: string }[] = [
  { id: "all", label: "全部桶況" },
  { id: "new", label: "新設的桶" },
  { id: "hungry", label: "只看餓了的" },
];

// 一般垃圾槽沿用原本的單一讀值（對齊後端 legacy_assumed_general），回收槽另存一把 key。
export function readingKey(
  locationId: string,
  wasteType: WasteType = "general",
) {
  return wasteType === "general" ? locationId : `${locationId}:${wasteType}`;
}
export interface DemoCompartment {
  wasteType: WasteType;
  state: BinState;
  capacity: number | null;
  repairing: boolean;
}

// A separate presentation layer: never write simulated fields into the source snapshot.
// 每個公布桶點位都是「一般垃圾＋資源回收」兩個示意子桶（demo_assumption），
// 不改變 811 筆位置紀錄或 681 個公布桶位置的筆數。
export function binDemo(
  location: LocationRecord,
  removedIds: string[] = [],
  operations?: OperationalState,
) {
  const seed = [...location.id].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const removed = seed % 19 === 0 || removedIds.includes(location.id);
  const newAge = seed % 41;
  const repairingType = (wasteType: WasteType) =>
    Boolean(
      operations?.tasks.some(
        (t) =>
          t.locationId === location.id &&
          (t.wasteType || "general") === wasteType &&
          t.type === "broken" &&
          !["completed", "dismissed"].includes(t.status) &&
          t.arrivedAt,
      ),
    );
  const generalReading = operations?.readings[readingKey(location.id)];
  const recyclingReading =
    operations?.readings[readingKey(location.id, "recycling")];
  const seedCapacity = ([26, 62, 94, null] as const)[seed % 4];
  const generalCapacity = generalReading
    ? generalReading.capacity
    : seedCapacity;
  // 回收槽的示意值跟著一般槽的基礎狀態走，讓點位整體狀態與舊的單桶示意一致：
  // 一般槽滿則回收也滿、一般槽沒讀值則回收也沒讀值，一般槽餓了時回收各自取值。
  const generalBase = stateFromCapacity(generalCapacity);
  const recyclingCapacity = recyclingReading
    ? recyclingReading.capacity
    : generalBase === "full"
      ? 80 + (seed % 17)
      : generalBase === "offline"
        ? null
        : [12, 38, 71, 88, 55][(seed * 7) % 5];
  const compartments: DemoCompartment[] = wasteTypes.map((wasteType) => {
    const repairing = repairingType(wasteType);
    const reading = wasteType === "general" ? generalReading : recyclingReading;
    const derived =
      wasteType === "general" ? generalCapacity : recyclingCapacity;
    // 有讀值就照實顯示；撤除或維修中且沒有讀值時不推估滿度。
    const capacity = reading
      ? reading.capacity
      : removed || repairing
        ? null
        : derived;
    return {
      wasteType,
      repairing,
      capacity,
      state: removed || repairing ? "offline" : stateFromCapacity(capacity),
    };
  });
  const repairing = compartments.some((c) => c.repairing);
  const state = stationState(compartments);
  const reading = generalReading;
  return {
    state,
    compartments,
    repairing,
    reading,
    // capacity 指一般垃圾槽（與後端預設 waste_type=general 相同）。
    capacity: compartments[0].capacity,
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
export function matchesBinFilter(
  location: LocationRecord,
  filter: BinFilter,
  removedIds: string[] = [],
  operations?: OperationalState,
) {
  if (filter === "all") return true;
  if (location.kind !== "bin") return false;
  const demo = binDemo(location, removedIds, operations);
  if (filter === "new") return demo.isNew;
  // 「只看餓了的」＝至少一桶還能丟（三態下餓了即可以丟）。
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

// 不指定種類時看整個點位（任一桶能丟）；指定 waste_type 時只看那一槽。
export function isUsableBin(
  location: LocationRecord,
  operations?: OperationalState,
  removedIds: string[] = [],
  wasteType?: WasteType,
) {
  if (location.kind !== "bin") return false;
  const demo = binDemo(location, removedIds, operations);
  if (demo.removed) return false;
  if (!wasteType) return demo.state === "hungry";
  return (
    demo.compartments.find((c) => c.wasteType === wasteType)?.state === "hungry"
  );
}
export function walkingMinutes(location: LocationRecord) {
  return Math.max(1, Math.ceil((demoDistance(location) * 1.3) / 75));
}
export function lifecycleLabel(
  location: LocationRecord,
  removedIds: string[] = [],
) {
  const demo = binDemo(location, removedIds);
  return demo.removed
    ? `撤除 ${demo.removedAge} 天 · 保留 7 天`
    : demo.isNew
      ? `新設 ${demo.newAge} 天 · 標示 30 天`
      : "";
}
