import type { LocationKind } from "../data/locations";
import type { BinState } from "../data/binState";
import { stateVisual } from "./binVisual";

// 32×36 像素電子雞（設計系統 MapMarker）：外框 text-on-light、眼白 mascot-eye、
// 腮紅 mascot-blush；身體顏色依桶況，場所代表點是 place 身體加星星。
export function mascotSvg(kind: LocationKind, state: BinState = "hungry") {
  const place = kind === "place";
  const body = place ? "var(--place)" : stateVisual[state].body;
  return `<svg viewBox="0 0 32 36" width="32" height="36" aria-hidden="true" shape-rendering="crispEdges"><path fill="var(--text-on-light)" d="M7 8h18v23H7zM4 11h3v10H4zM25 11h3v10h-3zM9 31h5v4H9zM19 31h5v4h-5z"/><path fill="${body}" d="M9 10h14v19H9z"/><path fill="var(--text-on-light)" d="M${place ? "9 3h14v3H9zM6 6h20v3H6" : "12 3h8v3h-8zM6 6h20v4H6"}z"/><path fill="var(--mascot-eye)" d="M10 13h5v6h-5zM18 13h5v6h-5z"/><path fill="var(--text-on-light)" d="M12 15h3v4h-3zM18 15h3v4h-3zM13 23h2v2h-2zM15 25h4v2h-4zM19 23h2v2h-2z"/>${place ? '<path fill="var(--mascot-eye)" d="M14 0h4v3h3v3h-3v3h-4V6h-3V3h3z"/>' : '<path fill="var(--mascot-blush)" d="M9 21h3v2H9zM21 21h3v2h-3z"/>'}</svg>`;
}
