import L from "leaflet";
import type { LocationKind } from "../data/locations";
import type { BinState } from "../data/binDemo";

import { mascotSvg } from "../components/mascotSvg";

export function markerIcon(
  kind: LocationKind,
  selected: boolean,
  state?: BinState,
) {
  return L.divIcon({
    className: `pixel-marker ${kind} ${state || ""} ${selected ? "selected" : ""}`,
    html: mascotSvg(kind),
    iconSize: [40, 44],
    iconAnchor: [20, 40],
  });
}
