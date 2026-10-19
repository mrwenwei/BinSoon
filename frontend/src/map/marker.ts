import type { OperationalState } from "../data/workOrders";
import L from "leaflet";
import type { LocationKind, LocationRecord } from "../data/locations";
import { binDemo, type BinState } from "../data/binDemo";

import { mascotSvg } from "../components/mascotSvg";

export function markerIcon(
  kind: LocationKind,
  selected: boolean,
  state?: BinState,
  lifecycle?: "new" | "removed",
) {
  return L.divIcon({
    className: `pixel-marker ${kind} ${state || ""} ${selected ? "selected" : ""}`,
    html: `${mascotSvg(kind)}${lifecycle ? `<span class="marker-lifecycle ${lifecycle}">${lifecycle === "new" ? "新" : "撤"}</span>` : ""}`,
    iconSize: [40, 44],
    iconAnchor: [20, 40],
  });
}

export function locationMarkerIcon(
  location: LocationRecord,
  selected: boolean,
  removedIds?: string[],
  operations?: OperationalState,
) {
  if (location.kind !== "bin") return markerIcon(location.kind, selected);
  const demo = binDemo(location, removedIds, operations);
  return markerIcon(
    location.kind,
    selected,
    demo.state,
    demo.removed ? "removed" : demo.isNew ? "new" : undefined,
  );
}
