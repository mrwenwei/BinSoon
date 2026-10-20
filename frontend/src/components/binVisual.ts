import type { BinState } from "../data/binState";

// 桶況 → 視覺的唯一對照（色票 token、是否要虛線外框、CSS class）。
// 要調整桶況的顏色或樣式時只改這裡與 styles.css 的 .state-* 規則。
export const stateVisual: Record<
  BinState,
  { body: string; dashed: boolean; className: string }
> = {
  hungry: {
    body: "var(--status-hungry)",
    dashed: false,
    className: "state-hungry",
  },
  full: { body: "var(--status-full)", dashed: false, className: "state-full" },
  // 失聯的灰和青綠亮度接近，一定要加虛線外框，不能只靠顏色。
  offline: {
    body: "var(--status-offline)",
    dashed: true,
    className: "state-offline",
  },
};
