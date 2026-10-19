import type { OperationalState } from "../data/workOrders";
import L from "leaflet";
import type { LocationKind, LocationRecord } from "../data/locations";
import { binDemo } from "../data/binDemo";
import type { BinState } from "../data/binState";
import { apiStationState } from "../data/api";
import { mascotSvg } from "../components/mascotSvg";
import { stateVisual } from "../components/binVisual";

// 一個點位只放一隻電子雞（不加 ♻ 或數字徽章），身體顏色是整個點的狀態。
export function markerIcon(
  kind: LocationKind,
  selected: boolean,
  state: BinState = "hungry",
  lifecycle?: "new" | "removed",
) {
  const visual = kind === "bin" ? stateVisual[state].className : "place";
  return L.divIcon({
    className: `pixel-marker ${kind} ${visual} ${selected ? "selected" : ""}`,
    html: `${selected ? '<span class="marker-crosshair" aria-hidden="true"></span>' : ""}<span class="marker-body">${mascotSvg(kind, state)}</span>${lifecycle ? `<span class="marker-lifecycle ${lifecycle}">${lifecycle === "new" ? "新" : "撤"}</span>` : ""}`,
    iconSize: [44, 44],
    iconAnchor: [22, 40],
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
