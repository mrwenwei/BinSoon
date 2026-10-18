import L from "leaflet";
import type { LocationKind } from "../data/locations";
import type { BinState } from "../data/binDemo";

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
