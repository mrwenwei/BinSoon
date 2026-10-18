import L from "leaflet";
import type { LocationKind } from "../data/locations";

import { mascotSvg } from "../components/mascotSvg";

export function markerIcon(kind: LocationKind, selected: boolean) {
  return L.divIcon({
    className: `pixel-marker ${kind} ${selected ? "selected" : ""}`,
    html: mascotSvg(kind),
    iconSize: [40, 44],
    iconAnchor: [20, 40],
  });
}
