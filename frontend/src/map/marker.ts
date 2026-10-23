import type { OperationalState } from "../data/workOrders";
import L from "leaflet";
import type { LocationKind, LocationRecord } from "../data/locations";
import { binDemo } from "../data/binDemo";
import type { BinState } from "../data/binState";
import { apiStationState } from "../data/api";
import { mascotSvg } from "../components/mascotSvg";
import { stateVisual } from "../components/binVisual";
import { binBotSvg, removedBinSvg } from "./binBot";
import { botBarsHtml, type BotBar } from "./botBars";

// 選中底盤（配色 v4，底盤 ③ 像素風實心底座）：角色腳下的扁橢圓，每格約 2px（格數＝底盤寬÷2，
// 由 LocationMap 依縮放級距傳入：2 倍 36、縮放 16–17 28、1 倍 21、地標 21）；外圈一格
// --route-casing、內部 --signal、中間一圈同心白環（像靶心）、下半內部疊 --marker-shadow
// （顏色在 CSS 的 .marker-base 裡給）。底盤與十字線由 LocationMap 放在另一層（shadowPane），在所有標記下面。
const baseCache = new Map<number, string>();
export function selectedBaseHtml(cells = 30) {
  const cached = baseCache.get(cells);
  if (cached) return cached;
  const cw = cells;
  const ch = Math.max(4, Math.round(cw / 3));
  const rx = cw / 2;
  const ry = ch / 2;
  const inside = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < cw &&
    y < ch &&
    ((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2 <= 1;
  // 同心白環：正規化半徑落在這個區間的內部格子。
  const ring = (x: number, y: number) => {
    const r = Math.sqrt(
      ((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2,
    );
    return r >= 0.42 && r <= 0.72;
  };
  let edge = "";
  let fill = "";
  let shade = "";
  let white = "";
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      if (!inside(x, y)) continue;
      const cell = `M${x} ${y}h1v1h-1z`;
      if (
        !inside(x - 1, y) ||
        !inside(x + 1, y) ||
        !inside(x, y - 1) ||
        !inside(x, y + 1)
      )
        edge += cell;
      else if (ring(x, y)) white += cell;
      else {
        fill += cell;
        if (y + 0.5 > ry + 0.5) shade += cell;
      }
    }
  const html = `<span class="marker-base" aria-hidden="true"><svg viewBox="0 0 ${cw} ${ch}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"><path class="base-fill" d="${fill}"/><path class="base-shade" d="${shade}"/><path class="base-ring" d="${white}"/><path class="base-edge" d="${edge}"/></svg></span>`;
  baseCache.set(cells, html);
  return html;
}
// 選中底盤圖層的內容：底盤＋十字定位線（交點＝底盤中心＝腳底）。
export function selectedBaseLayerHtml(cells: number) {
  return `${selectedBaseHtml(cells)}<span class="marker-crosshair" aria-hidden="true"></span>`;
}

// 一個點位只放一個標記（不加 ♻ 或數字徽章）。桶是垃圾桶機器人（binBot.ts），
// 整隻顏色與表情是整個點的狀態；撤除只剩虛線外框＋中間的「撤」；場所代表點仍是BinU。
export function markerIcon(
  kind: LocationKind,
  selected: boolean,
  state: BinState = "hungry",
  lifecycle?: "new" | "removed",
  bars?: BotBar[],
) {
  // 選中：腳下底盤與十字定位線由 LocationMap 另外畫在所有標記下面（selectedBaseLayerHtml）。
  if (kind !== "bin")
    return L.divIcon({
      className: `pixel-marker ${kind} place ${selected ? "selected" : ""}`,
      html: `<span class="marker-body">${mascotSvg(kind, state)}</span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 40],
    });
  const removed = lifecycle === "removed";
  const body = removed
    ? `${removedBinSvg()}<span class="marker-removed-label">撤</span>`
    : `${binBotSvg(state)}${bars ? botBarsHtml(bars) : ""}`;
  return L.divIcon({
    className: `pixel-marker bin bot-marker ${removed ? "removed" : stateVisual[state].className} ${selected ? "selected" : ""}`,
    html: `<span class="marker-body">${body}</span>${lifecycle === "new" ? '<span class="marker-lifecycle new">新</span>' : ""}`,
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
