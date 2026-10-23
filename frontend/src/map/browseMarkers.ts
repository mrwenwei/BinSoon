import L from "leaflet";
import type { LocationRecord } from "../data/locations";
import type { WasteType } from "../data/waste";
import { apiBinState, apiCompartments } from "../data/api";
import type { BinState } from "../data/binState";
import { markerIcon } from "./marker";
import { botBars, botBarsLabel } from "./botBars";
import { proposedBinSvg } from "./binBot";
import { voteMarkerLabel } from "../data/voteTally";

// 地圖瀏覽模式的標記：桶的顏色看「所選種類」那一槽（不是整個點位），
// 場所代表點改成地標旗子，建議點是垃圾桶機器人同形狀的虛線外框＋（M3）。

export function isProposed(location: LocationRecord) {
  return (
    location.kind === "bin" &&
    (location as { placement_status?: string | null }).placement_status ===
      "proposed"
  );
}

// 所選種類那一槽的三態；舊回應沒有 compartments 時退回 bin_status（後端已依 waste_type 回傳）。
export function wasteState(
  location: LocationRecord,
  wasteType: WasteType,
): BinState {
  const part = apiCompartments(location.bin_status, location.compartments).find(
    (c) => c.waste_type === wasteType,
  );
  return apiBinState(part ?? location.bin_status);
}

export function usableFor(location: LocationRecord, wasteType: WasteType) {
  return (
    location.kind === "bin" &&
    !isProposed(location) &&
    wasteState(location, wasteType) === "hungry"
  );
}

// 地標：像素旗子，淺色底板讓深色面板與灰綠地圖上都看得清楚。
export const landmarkSvg =
  '<svg viewBox="0 0 28 32" width="28" height="32" aria-hidden="true" shape-rendering="crispEdges"><path fill="var(--mascot-eye)" d="M5 2h20v15H10v10h4v4H3v-4h2z"/><path fill="var(--text-on-light)" d="M6 3h3v25H6zM9 3h15v13H9zM4 28h9v2H4z"/><path fill="var(--place)" d="M11 5h11v9H11z"/></svg>';

export function landmarkIcon(selected: boolean) {
  return L.divIcon({
    className: `pixel-marker mx-landmark ${selected ? "selected" : ""}`,
    // 底盤對齊錨點（實際位置），不對齊偏左的旗杆。
    html: `<span class="marker-body">${landmarkSvg}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 40],
  });
}

// 建議點（M3）：機器人同形狀的深青綠虛線外框、框內淡底、中間「＋」，
// 下方小牌寫支持率（「支持 95%」／「還沒人投」／關票後的結果）。框 52×52、腳底中心對準位置。
export type ProposalTally = {
  support: number;
  oppose: number;
  status?: string;
};
export function proposedIcon(selected: boolean, tally?: ProposalTally) {
  const label = tally
    ? voteMarkerLabel(tally.support, tally.oppose, tally.status)
    : null;
  return L.divIcon({
    className: `pixel-marker mx-proposed ${selected ? "selected" : ""}`,
    html: `<span class="marker-body">${proposedBinSvg()}<span class="mx-proposed-plus" aria-hidden="true">＋</span></span>${label ? `<small class="proposal-marker-votes" aria-hidden="true">${label}</small>` : ""}`,
    iconSize: [52, 52],
    iconAnchor: [26, 50],
  });
}

export function browseMarkerIcon(
  location: LocationRecord,
  selected: boolean,
  wasteType: WasteType,
  tally?: ProposalTally,
) {
  if (location.kind === "place") return landmarkIcon(selected);
  if (isProposed(location)) return proposedIcon(selected, tally);
  const status = location.bin_status;
  return markerIcon(
    "bin",
    selected,
    wasteState(location, wasteType),
    status?.operational_status === "removed"
      ? "removed"
      : status?.is_new
        ? "new"
        : undefined,
    botBars(location),
  );
}

export function browseMarkerLabel(location: LocationRecord) {
  return `${location.kind === "place" ? "地標" : isProposed(location) ? "建議點" : "垃圾桶"}：${location.label}`;
}

// 兩槽滿度文字（「一般垃圾 18%、資源回收 66%」，無讀值寫「無讀值」）：放在標記的
// aria-description 與 title，不動 aria-label（名稱維持穩定）。
export function browseMarkerDescription(location: LocationRecord) {
  if (isProposed(location)) {
    const tally = (location as { proposalTally?: ProposalTally }).proposalTally;
    return tally
      ? voteMarkerLabel(tally.support, tally.oppose, tally.status)
      : undefined;
  }
  const bars = botBars(location);
  return bars ? botBarsLabel(bars) : undefined;
}
