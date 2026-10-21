import L from "leaflet";
import type { BinState } from "../data/binState";
import { stateVisual } from "../components/binVisual";
import { binBotSvg } from "./binBot";

// 垃圾桶機器人的聚合規則（2026-10-21 定案「會疊就聚合」）：
// 不管縮放多少，畫面上會疊在一起的桶合成一隻代表的垃圾桶，右上角數字＝桶數；
// 縮放 15 以下角色縮成 1 倍（26px），16 以上 2 倍（52px）；18 以上全部展開。
export const BOT_SMALL_MAX_ZOOM = 15;
export const BOT_SPREAD_ZOOM = 18;
const RADIUS = { small: 40, large: 48 };

export type BotItem = { point: L.Point; state: BinState };
export type BotGroup<T extends BotItem> = { x: number; y: number; items: T[] };

// 貪婪法：離某群中心小於半徑就併進去，群中心跟著平均移動。
export function groupOverlapping<T extends BotItem>(
  items: T[],
  zoom: number,
): BotGroup<T>[] {
  if (zoom >= BOT_SPREAD_ZOOM)
    return items.map((item) => ({
      x: item.point.x,
      y: item.point.y,
      items: [item],
    }));
  const radius = zoom <= BOT_SMALL_MAX_ZOOM ? RADIUS.small : RADIUS.large;
  const groups: BotGroup<T>[] = [];
  for (const item of items) {
    const group = groups.find(
      (g) => Math.hypot(g.x - item.point.x, g.y - item.point.y) < radius,
    );
    if (!group) {
      groups.push({ x: item.point.x, y: item.point.y, items: [item] });
      continue;
    }
    group.items.push(item);
    group.x += (item.point.x - group.x) / group.items.length;
    group.y += (item.point.y - group.y) / group.items.length;
  }
  return groups;
}

// 代表的狀態取最好的：有任何一個能丟就是餓了，否則有滿的就是吃飽了，都沒有才失聯。
const RANK: BinState[] = ["hungry", "full", "offline"];
export function bestState(states: BinState[]): BinState {
  return RANK.find((state) => states.includes(state)) ?? "offline";
}

export function stateFromIconClass(className = ""): BinState | undefined {
  return RANK.find((state) => className.includes(stateVisual[state].className));
}

export function clusterIcon(state: BinState, count: number) {
  return L.divIcon({
    className: `pixel-marker bin bot-marker bot-cluster ${stateVisual[state].className}`,
    html: `<span class="marker-body">${binBotSvg(state)}<span class="marker-count">${count}</span></span>`,
    iconSize: [52, 52],
    iconAnchor: [26, 50],
  });
}
