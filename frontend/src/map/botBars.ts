import type { LocationRecord } from "../data/locations";
import { apiBinState, apiCompartments } from "../data/api";
import { wasteTypes, type BinState, type WasteType } from "../data/binState";
import { WASTE_ICON_ATTRS, wasteIconInnerHtml } from "../components/Icon";
import { stateVisual } from "../components/binVisual";

// 高縮放時機器人頭上的兩條滿度血條：上＝一般垃圾、下＝資源回收（與雙桶卡片同序）。
// 條色取 stateVisual（餓了青綠、吃飽了橘），失聯是虛線空槽、不填色。
// 辨識不只靠顏色：固定上下順序，左側 Lucide 圖示，
// 文字則放在標記的 aria-label／title（botBarsLabel）。
export const BOT_BARS_MIN_ZOOM = 18;
const CELLS = 20; // 條內 20 格 × 2px ＝ 40px，約與機器人蓋子同寬

export type BotBar = {
  waste: WasteType;
  state: BinState;
  pct: number | null;
};

const ORDER = wasteTypes; // 固定順序：一般垃圾在上、資源回收在下

// 左側圖示＝Lucide trash-2（一般垃圾）／recycle（資源回收），資料與 React 的 WasteIcon 共用
// （components/Icon.tsx）。18px 下 stroke-width 2 約 1.5px 偏細，提高到 2.25（約 1.7px）。
function iconSvg(waste: WasteType) {
  const a = WASTE_ICON_ATTRS;
  return `<svg class="bot-bar-icon" width="18" height="18" viewBox="${a.viewBox}" fill="${a.fill}" stroke="var(--text-on-light)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${wasteIconInnerHtml(waste)}</svg>`;
}
const NAMES: Record<WasteType, string> = {
  general: "一般垃圾",
  recycling: "資源回收",
};

// 只有兩槽都有資料、且沒撤除的桶點位才有血條。
export function botBars(location: LocationRecord): BotBar[] | undefined {
  if (location.kind !== "bin") return undefined;
  if (location.bin_status?.operational_status === "removed") return undefined;
  const parts = apiCompartments(location.bin_status, location.compartments);
  const bars = ORDER.map((waste) => {
    const part = parts.find((c) => c.waste_type === waste);
    return part
      ? {
          waste,
          state: apiBinState(part),
          pct: part.fill_level_pct ?? null,
        }
      : undefined;
  });
  return bars.every(Boolean) ? (bars as BotBar[]) : undefined;
}

export function botBarsLabel(bars: BotBar[]) {
  return bars
    .map(
      (b) =>
        `${NAMES[b.waste]} ${b.state === "offline" || b.pct === null ? "無讀值" : `${Math.round(b.pct)}%`}`,
    )
    .join("、");
}

export function botBarsHtml(bars: BotBar[]) {
  const rows = bars
    .map((b) => {
      const live = b.state !== "offline" && b.pct !== null;
      const cells = live
        ? Math.min(
            CELLS,
            Math.max(1, Math.round((Math.max(0, b.pct!) / 100) * CELLS)),
          )
        : 0;
      const fill = live
        ? `<span class="bot-bar-fill" style="width:${cells * 2}px;background:${stateVisual[b.state].body}"></span>`
        : "";
      return `<span class="bot-bar-row ${b.waste}${live ? "" : " offline"}">${iconSvg(b.waste)}<span class="bot-bar-track">${fill}</span></span>`;
    })
    .join("");
  return `<span class="bot-bars" aria-hidden="true">${rows}</span>`;
}
