import L from "leaflet";
import type { LocationKind } from "../data/locations";

// Original inline pixel art; shared by map markers, legend and the detail panel.
export function mascotSvg(kind: LocationKind) {
  const place = kind === "place";
  return `<svg viewBox="0 0 32 36" width="32" height="36" aria-hidden="true" shape-rendering="crispEdges"><path fill="#263d37" d="M7 8h18v23H7zM4 11h3v10H4zM25 11h3v10h-3zM9 31h5v4H9zM19 31h5v4h-5z"/><path fill="${place ? "#d7bded" : "#b5d784"}" d="M9 10h14v19H9z"/><path fill="#263d37" d="M${place ? "9 3h14v3H9zM6 6h20v3H6" : "12 3h8v3h-8zM6 6h20v4H6"}z"/><path fill="#fff9df" d="M10 13h5v6h-5zM18 13h5v6h-5z"/><path fill="#263d37" d="M12 15h3v4h-3zM18 15h3v4h-3zM13 23h2v2h-2zM15 25h4v2h-4zM19 23h2v2h-2z"/><path fill="#eea990" d="M9 21h3v2H9zM21 21h3v2h-3z"/>${place ? '<path fill="#fff9df" d="M14 0h4v3h3v3h-3v3h-4V6h-3V3h3z"/>' : ""}</svg>`;
}
export function markerIcon(kind: LocationKind, selected: boolean) {
  return L.divIcon({
    className: `pixel-marker ${kind} ${selected ? "selected" : ""}`,
    html: mascotSvg(kind),
    iconSize: [40, 44],
    iconAnchor: [20, 40],
  });
}
