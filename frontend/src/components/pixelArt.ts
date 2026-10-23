import { BOT_HEART_COLOR } from "../map/binBot";

// 認領流程 v3 的像素小圖（跟垃圾桶機器人同一套像素網格，用程式畫，不另外貼圖）：
// 愛心＝認領的統一符號、代幣＝點數。字串版給 Leaflet 標記與 React 元件（Pixel.tsx）共用。

const cell = (x: number, y: number) => `M${x} ${y}h1v1h-1z`;

// 內部格子＋外圍 1 格 K 外框（上下左右四鄰），只用整數倍放大。
function outlinedSvg(
  grid: string[],
  colors: Record<string, string>,
  scale: number,
  className: string,
) {
  const w = grid[0].length + 2;
  const h = grid.length + 2;
  const cells = new Map<string, string>();
  grid.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== ".") cells.set(`${c + 1},${r + 1}`, ch);
    }),
  );
  const paths: Record<string, string> = {};
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let ch = cells.get(`${x},${y}`);
      if (
        !ch &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => cells.has(`${x + dx},${y + dy}`))
      )
        ch = "K";
      if (ch) paths[ch] = (paths[ch] ?? "") + cell(x, y);
    }
  return `<svg class="${className}" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" aria-hidden="true">${Object.entries(
    paths,
  )
    .map(([ch, d]) => `<path style="fill:${colors[ch]}" d="${d}"/>`)
    .join("")}</svg>`;
}

// 愛心：內部 7×6 格（左上一格 --mascot-eye 高光）＋外框＝9×8 格；×2＝18×16、×3＝27×24。
const HEART = [
  ".HH.HH.",
  "HWHHHHH",
  "HHHHHHH",
  ".HHHHH.",
  "..HHH..",
  "...H...",
];
const heartCache = new Map<number, string>();
export function pixelHeartSvg(scale: 2 | 3 = 2) {
  let svg = heartCache.get(scale);
  if (!svg) {
    svg = outlinedSvg(
      HEART,
      {
        K: "var(--text-on-light)",
        H: BOT_HEART_COLOR,
        W: "var(--mascot-eye)",
      },
      scale,
      "px-heart",
    );
    heartCache.set(scale, svg);
  }
  return svg;
}

// 代幣：10×10 格圓形、每格 2px＝20×20。外框 --text-on-light、身體 --coin、
// 左上高光 --mascot-eye、右下陰影與中間 2×4 格刻紋（投幣口）是 --coin 混深色。
let coinCache = "";
export function coinSvg() {
  if (coinCache) return coinCache;
  const n = 10;
  const r = 4.75;
  const inside = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < n &&
    y < n &&
    (x + 0.5 - 5) ** 2 + (y + 0.5 - 5) ** 2 <= r * r;
  const p = { K: "", F: "", H: "", S: "" };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!inside(x, y)) continue;
      const c = cell(x, y);
      if (
        !inside(x - 1, y) ||
        !inside(x + 1, y) ||
        !inside(x, y - 1) ||
        !inside(x, y + 1)
      )
        p.K += c;
      else if (x >= 4 && x <= 5 && y >= 3 && y <= 6) p.S += c;
      else if (x + y <= 4) p.H += c;
      else if (x + y >= 13) p.S += c;
      else p.F += c;
    }
  coinCache = `<svg class="px-coin" viewBox="0 0 10 10" width="20" height="20" shape-rendering="crispEdges" aria-hidden="true"><path style="fill:var(--coin)" d="${p.F}"/><path style="fill:color-mix(in srgb, var(--coin) 70%, var(--text-on-light))" d="${p.S}"/><path style="fill:var(--mascot-eye)" d="${p.H}"/><path style="fill:var(--text-on-light)" d="${p.K}"/></svg>`;
  return coinCache;
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// 地圖上的名字最多 6 字，超過加「…」（介面裡放全名）。
export function mapTagName(name: string) {
  const chars = [...name];
  return chars.length > 6 ? `${chars.slice(0, 6).join("")}…` : name;
}

// 地圖標記腳下的名牌（愛心＋名字）。縮放 15 以下、沒選中時由 CSS 收成只剩愛心。
export function nameTagHtml(name: string) {
  return `<span class="name-tag map-tag" aria-hidden="true"><span class="name-tag-heart">${pixelHeartSvg(2)}</span><span class="name-tag-text">${escapeHtml(mapTagName(name))}</span></span>`;
}

// 聚合的代表桶：裡面有你的 BinU 時，腳下只掛一顆愛心（沒有牌框）。
export function heartOnlyHtml() {
  return `<span class="name-tag map-tag heart-only" aria-hidden="true"><span class="name-tag-heart">${pixelHeartSvg(2)}</span></span>`;
}
