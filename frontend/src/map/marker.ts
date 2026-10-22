import type { OperationalState } from "../data/workOrders";
import L from "leaflet";
import type { LocationKind, LocationRecord } from "../data/locations";
import { binDemo } from "../data/binDemo";
import type { BinState } from "../data/binState";
import { apiStationState } from "../data/api";
import { mascotSvg } from "../components/mascotSvg";
import { stateVisual } from "../components/binVisual";
import { binBotSvg, removedBinSvg } from "./binBot";

// 一個點位只放一個標記（不加 ♻ 或數字徽章）。桶是垃圾桶機器人（binBot.ts），
// 整隻顏色與表情是整個點的狀態；撤除只剩虛線外框＋中間的「撤」；場所代表點仍是BinU。
export function markerIcon(
  kind: LocationKind,
  selected: boolean,
  state: BinState = "hungry",
  lifecycle?: "new" | "removed",
) {
  const crosshair = selected
    ? '<span class="marker-crosshair" aria-hidden="true"></span>'
    : "";
  if (kind !== "bin")
    return L.divIcon({
      className: `pixel-marker ${kind} place ${selected ? "selected" : ""}`,
      html: `${crosshair}<span class="marker-body">${mascotSvg(kind, state)}</span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 40],
    });
  const removed = lifecycle === "removed";
  const body = removed
    ? `${removedBinSvg()}<span class="marker-removed-label">撤</span>`
    : binBotSvg(state);
  return L.divIcon({
    className: `pixel-marker bin bot-marker ${removed ? "removed" : stateVisual[state].className} ${selected ? "selected" : ""}`,
    html: `${crosshair}<span class="marker-body">${body}</span>${lifecycle === "new" ? '<span class="marker-lifecycle new">新</span>' : ""}`,
    iconSize: [52, 52],
    iconAnchor: [26, 50],
  });
}

export function locationMarkerIcon(
  location: LocationRecord,
  selected: boolean,
  removedIds?: string[],
  operations?: OperationalState,
) {
  if (location.kind !== "bin") return markerIcon(location.kind, selected);
  if (location.bin_status !== undefined || !operations) {
    const status = location.bin_status;
    return markerIcon(
      location.kind,
      selected,
      apiStationState(status, location.compartments),
      status?.operational_status === "removed"
        ? "removed"
        : status?.is_new
          ? "new"
          : undefined,
    );
  }
  const demo = binDemo(location, removedIds, operations);
  return markerIcon(
    location.kind,
    selected,
    demo.state,
    demo.removed ? "removed" : demo.isNew ? "new" : undefined,
  );
}
