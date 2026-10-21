import type { Map as MlMap } from "maplibre-gl";

// 綠地像素圖案：用 canvas 一次畫出可重複貼磚的 pattern，交給 MapLibre 原生
// fill-pattern 繪製（GPU 貼圖，沒有 DOM 節點）。草、花、樹以固定種子的亂數
// 散佈在 64×64 的磚上，所以每次載入相同、看起來不規則但沒有明顯格線。
// 顏色全部由呼叫端傳入（色票 token 的明暗變體）。
export type GreeneryColors = {
  ground: string; // 綠地底色
  tuftDark: string;
  tuftLight: string;
  flower: string;
  flowerCore: string;
  treeEdge: string;
  treeBody: string;
  treeLight: string;
  water: string; // 水域底色
  waveLight: string; // 波紋亮點（薄荷變體）
  waveDark: string; // 波紋暗點（青綠變體）
};

const TILE = 64; // 以「像素格」計；每格 2 CSS px

// 縮放分段（maplibre zoom）：min 起算，cell 是每個像素格的 CSS px（整數倍，
// 維持銳利像素風）；detail 決定花與樹的數量。格寬 2→3 跟著縮放放大，
// 放大到 Leaflet 17（maplibre 16）為止；18 以上沿用同一組，圖案太大會失真、和道路不搭。
export const GREEN_TIERS = [
  { suffix: "a", min: 14, cell: 2, detail: 0 },
  { suffix: "b", min: 15, cell: 2, detail: 1 },
  { suffix: "c", min: 16, cell: 3, detail: 1 },
] as const;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sprite = string[];
const TUFT: Sprite = ["d.d", "dld", ".l."];
const SPECK: Sprite = ["l"];
const FLOWER: Sprite = [".f.", "fcf", ".f.", ".d."];
const WAVE: Sprite = ["w..w.", ".ww.w"];
const RIPPLE: Sprite = ["x.x", ".x."];
const TREE: Sprite = [
  "..ooo..",
  ".ommmo.",
  "ommhmmo",
  "ommmmmo",
  ".ommmo.",
  "..ooo..",
  "...o...",
];

function draw(
  colors: GreeneryColors,
  counts: {
    tuft?: number;
    speck?: number;
    flower?: number;
    tree?: number;
    wave?: number;
    ripple?: number;
  },
  ground: string,
  seed: number,
  cell: number,
) {
  const dpr = Math.min(
    2,
    Math.max(1, Math.round(window.devicePixelRatio || 1)),
  );
  const unit = cell * dpr;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE * unit;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const palette: Record<string, string> = {
    d: colors.tuftDark,
    l: colors.tuftLight,
    f: colors.flower,
    c: colors.flowerCore,
    o: colors.treeEdge,
    m: colors.treeBody,
    h: colors.treeLight,
    w: colors.waveLight,
    x: colors.waveDark,
  };
  const rand = rng(seed);
  const placed: [number, number][] = [];
  const stamp = (sprite: Sprite, gap: number) => {
    for (let tries = 0; tries < 12; tries++) {
      const x = Math.floor(rand() * TILE);
      const y = Math.floor(rand() * TILE);
      if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < gap)) continue;
      placed.push([x, y]);
      sprite.forEach((row, j) =>
        [...row].forEach((ch, i) => {
          if (ch === ".") return;
          ctx.fillStyle = palette[ch];
          // 取模讓靠邊的圖案繞到另一側，磚接縫不會斷掉
          ctx.fillRect(
            ((x + i) % TILE) * unit,
            ((y + j) % TILE) * unit,
            unit,
            unit,
          );
        }),
      );
      return;
    }
  };
  for (let i = 0; i < (counts.wave ?? 0); i++) stamp(WAVE, 6);
  for (let i = 0; i < (counts.ripple ?? 0); i++) stamp(RIPPLE, 4);
  for (let i = 0; i < (counts.tree ?? 0); i++) stamp(TREE, 14);
  for (let i = 0; i < (counts.flower ?? 0); i++) stamp(FLOWER, 7);
  for (let i = 0; i < (counts.tuft ?? 0); i++) stamp(TUFT, 5);
  for (let i = 0; i < (counts.speck ?? 0); i++) stamp(SPECK, 3);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { image: data, pixelRatio: dpr };
}

// 每段兩組（草地、林地）；detail 0 只有草與零星樹，1 加花並增加樹。
export function addGreeneryImages(gl: MlMap, colors: GreeneryColors) {
  for (const kind of ["green", "wood"] as const) {
    for (const tier of GREEN_TIERS) {
      const id = `bs-${kind}-${tier.suffix}`;
      if (gl.hasImage(id)) continue;
      const wood = kind === "wood";
      const counts = tier.detail
        ? wood
          ? { tuft: 8, speck: 10, flower: 2, tree: 12 }
          : { tuft: 30, speck: 30, flower: 12, tree: 4 }
        : wood
          ? { tuft: 4, speck: 6, flower: 0, tree: 8 }
          : { tuft: 12, speck: 14, flower: 2, tree: 2 };
      const { image, pixelRatio } = draw(
        colors,
        counts,
        colors.ground,
        wood ? 41 : 23,
        tier.cell,
      );
      gl.addImage(id, image, { pixelRatio });
    }
  }
  // 水域：同樣的分段與格寬，低縮放（a 段）只有零星波紋，之後加密。
  for (const tier of GREEN_TIERS) {
    const id = `bs-water-${tier.suffix}`;
    if (gl.hasImage(id)) continue;
    const counts = tier.detail
      ? { wave: 34, ripple: 30 }
      : { wave: 12, ripple: 12 };
    const { image, pixelRatio } = draw(
      colors,
      counts,
      colors.water,
      53,
      tier.cell,
    );
    gl.addImage(id, image, { pixelRatio });
  }
}
