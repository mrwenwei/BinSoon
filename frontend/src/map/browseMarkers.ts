import L from "leaflet";
import type { LocationRecord } from "../data/locations";
import type { WasteType } from "../data/waste";
import { apiBinState, apiCompartments } from "../data/api";
import type { BinState } from "../data/binState";
import { markerIcon } from "./marker";

// 地圖瀏覽模式的標記：桶的顏色看「所選種類」那一槽（不是整個點位），
// 場所代表點改成地標旗子，建議點是虛線方框＋。

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
    html: `${selected ? '<span class="marker-crosshair" aria-hidden="true"></span>' : ""}<span class="marker-body">${landmarkSvg}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 40],
  });
}

export function proposedIcon(selected: boolean, support?: number) {
  return L.divIcon({
    className: `mx-proposed ${selected ? "selected" : ""}`,
    html: `<span aria-hidden="true">＋</span>${support != null && Number.isFinite(support) && support >= 0 ? `<small class="proposal-marker-votes" aria-hidden="true">支持 ${Math.floor(support)}</small>` : ""}`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function browseMarkerIcon(
  location: LocationRecord,
  selected: boolean,
  wasteType: WasteType,
  support?: number,
) {
  if (location.kind === "place") return landmarkIcon(selected);
  if (isProposed(location)) return proposedIcon(selected, support);
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
  );
}

export function browseMarkerLabel(location: LocationRecord) {
  return `${location.kind === "place" ? "地標" : isProposed(location) ? "建議點" : "垃圾桶"}：${location.label}`;
}
