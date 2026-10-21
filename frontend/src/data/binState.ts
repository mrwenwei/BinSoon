// 前端桶況的單一定義（設計系統三態）。後端 API 仍回四態 fill_status，
// 對照集中在 src/data/api.ts 的 apiBinState()，這裡不認識 half／unknown。
export type BinState = "hungry" | "full" | "offline";
export const binStates: BinState[] = ["hungry", "full", "offline"];
export const stateLabels: Record<BinState, string> = {
  hungry: "餓了",
  full: "吃飽了",
  offline: "失聯",
};
// 餓了 0–79%、吃飽了 80% 以上；沒有讀值就是失聯。
export const FULL_AT = 80;
export function stateFromCapacity(
  capacity: number | null | undefined,
): BinState {
  if (capacity === null || capacity === undefined) return "offline";
  return capacity >= FULL_AT ? "full" : "hungry";
}

// 與後端 waste_type 對齊；每個公布桶點位都有兩槽（demo_assumption），場所點沒有桶槽。
export type WasteType = "general" | "recycling";
export const wasteTypes: WasteType[] = ["general", "recycling"];
// 全站固定順序：任何同時列出兩種垃圾的地方都「先一般垃圾、再資源回收」
// （左右並排左＝一般垃圾、上下排列上＝一般垃圾）。順序只認 wasteTypes，
// API 回傳順序與物件鍵序不可信，渲染前一律用 sortByWaste 排。
export function sortByWaste<T extends { waste_type?: WasteType | null }>(
  items: T[],
): T[] {
  const rank = (t?: WasteType | null) => wasteTypes.indexOf(t ?? "general");
  return [...items].sort((a, b) => rank(a.waste_type) - rank(b.waste_type));
}
export const wasteLabels: Record<WasteType, string> = {
  general: "一般垃圾",
  recycling: "資源回收",
};

// 點位整體狀態：只要有一桶能丟就是餓了；沒有能丟的桶、但至少一桶有讀值且吃飽了
// 就是吃飽了；全部沒有讀值才是失聯。
export function stationState(compartments: { state: BinState }[]): BinState {
  if (compartments.some((c) => c.state === "hungry")) return "hungry";
  if (compartments.some((c) => c.state === "full")) return "full";
  return "offline";
}
export function usableCount(compartments: { state: BinState }[]) {
  return compartments.filter((c) => c.state === "hungry").length;
}
