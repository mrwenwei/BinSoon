import type { Map as MlMap, StyleSpecification } from "maplibre-gl";

// 像素插畫風底圖（本機實驗，try/pixel-skin；只給 MapPage 用）。
// 同一組 OpenFreeMap openmaptiles 向量圖磚，只換樣式：米色磚紋地面、柔綠點紋草地、
// 淺紫灰道路＋白色虛線中線、白色半透明圓角路名牌。不改既有 basemapStyle.ts。
// 顏色讀地圖容器上的 CSS 變數（styles.css 的 .px-map 區塊，--px-*），
// 所以要調色或還原只改 CSS。MapLibre 不能讀 CSS 變數，建立底圖時讀計算值。
const OFM = "https://tiles.openfreemap.org";

function read(scope: Element, name: string, fallback: string) {
  const value = getComputedStyle(scope).getPropertyValue(`--${name}`).trim();
  return value || fallback;
}

function palette(scope: Element) {
  const v = (name: string, fallback: string) =>
    read(scope, `px-${name}`, fallback);
  return {
    ground: v("ground", "#f4e1cb"),
    brick: v("brick-line", "#ead1b4"),
    brickLight: v("brick-light", "#f8eadb"),
    block: v("block", "#efd8bf"),
    building: v("building", "#ecd2b6"),
    buildingEdge: v("building-edge", "#d9b993"),
    buildingShadow: v("building-shadow", "#e0c3a2"),
    grass: v("grass", "#bfe2a2"),
    grassDot: v("grass-dot", "#9fd07f"),
    grassLight: v("grass-light", "#d6efbf"),
    wood: v("wood", "#a9d68c"),
    water: v("water", "#acd6ee"),
    waterLight: v("water-light", "#e4f3fb"),
    road: v("road", "#d4cde3"),
    roadEdge: v("road-edge", "#b9b0cd"),
    roadDash: v("road-dash", "#ffffff"),
    path: v("path", "#e8d3ba"),
    rail: v("rail", "#9a90b0"),
    ink: v("ink", "#2f2a3d"),
    labelBg: v("label-bg", "rgba(255,255,255,0.82)"),
    halo: v("label-halo", "#ffffff"),
  };
}

// 2 CSS px 一格的像素貼磚；dpr 取整數，維持銳利。
function canvasTile(cols: number, rows: number, cell = 2) {
  const dpr = Math.min(
    2,
    Math.max(1, Math.round(window.devicePixelRatio || 1)),
  );
  const unit = cell * dpr;
  const canvas = document.createElement("canvas");
  canvas.width = cols * unit;
  canvas.height = rows * unit;
  const ctx = canvas.getContext("2d")!;
  const dot = (x: number, y: number, color: string, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * unit, y * unit, w * unit, h * unit);
  };
  const done = () => ({
    image: ctx.getImageData(0, 0, canvas.width, canvas.height),
    pixelRatio: dpr,
  });
  return { ctx, dot, done, canvas, unit, dpr };
}

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

// 磚紋：每塊磚 8×4 格、1 格灰縫，隔列錯半塊；少量亮點讓地面不死板。
function brick(c: ReturnType<typeof palette>) {
  const W = 16,
    H = 8;
  const t = canvasTile(W, H);
  t.dot(0, 0, c.ground, W, H);
  for (let x = 0; x < W; x++) {
    t.dot(x, 0, c.brick);
    t.dot(x, 4, c.brick);
  }
  for (let y = 1; y < 4; y++) {
    t.dot(0, y, c.brick);
    t.dot(8, y, c.brick);
    t.dot(4, y + 4, c.brick);
    t.dot(12, y + 4, c.brick);
  }
  t.dot(2, 2, c.brickLight);
  t.dot(14, 6, c.brickLight);
  return t.done();
}

// 點狀草地：規則格點上微抖動的深綠點＋零星亮點。
function grass(ground: string, dark: string, light: string, seed: number) {
  const S = 24;
  const t = canvasTile(S, S);
  const rand = rng(seed);
  t.dot(0, 0, ground, S, S);
  for (let gy = 0; gy < S; gy += 6)
    for (let gx = 0; gx < S; gx += 6) {
      const x = (gx + Math.floor(rand() * 4) + (gy % 12 ? 3 : 0)) % S;
      const y = (gy + Math.floor(rand() * 4)) % S;
      t.dot(x, y, dark);
      if (rand() > 0.55) t.dot((x + 1) % S, y, dark);
      if (rand() > 0.6) t.dot((x + 3) % S, (y + 2) % S, light);
    }
  return t.done();
}

function water(ground: string, light: string) {
  const S = 24;
  const t = canvasTile(S, S);
  t.dot(0, 0, ground, S, S);
  t.dot(3, 4, light, 3, 1);
  t.dot(15, 10, light, 3, 1);
  t.dot(7, 17, light, 3, 1);
  t.dot(19, 21, light, 2, 1);
  return t.done();
}

// 路名牌：白色半透明圓角（像素階梯角），可拉伸，交給 icon-text-fit 包住文字。
function labelPill(fill: string) {
  const S = 12;
  const t = canvasTile(S, S);
  t.ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
  t.dot(2, 0, fill, S - 4, 1);
  t.dot(1, 1, fill, S - 2, 1);
  t.dot(0, 2, fill, S, S - 4);
  t.dot(1, S - 2, fill, S - 2, 1);
  t.dot(2, S - 1, fill, S - 4, 1);
  const { image, pixelRatio } = t.done();
  const u = t.unit;
  return {
    image,
    pixelRatio,
    stretchX: [[4 * u, 8 * u]] as [number, number][],
    stretchY: [[4 * u, 8 * u]] as [number, number][],
    content: [3 * u, 2 * u, 9 * u, 10 * u] as [number, number, number, number],
  };
}

export function registerPixelBasemapImages(gl: MlMap, scope: Element) {
  const c = palette(scope);
  const add = (
    id: string,
    built: { image: ImageData; pixelRatio: number } & Record<string, unknown>,
  ) => {
    if (gl.hasImage(id)) return;
    const { image, ...options } = built;
    gl.addImage(id, image, options as Parameters<MlMap["addImage"]>[2]);
  };
  add("px-brick", brick(c));
  add("px-grass", grass(c.grass, c.grassDot, c.grassLight, 23));
  add("px-wood", grass(c.wood, c.grassDot, c.grassLight, 41));
  add("px-water", water(c.water, c.waterLight));
  add("px-label", labelPill(c.labelBg));
}

const name = [
  "coalesce",
  ["get", "name:zh-Hant"],
  ["get", "name:zh"],
  ["get", "name"],
] as unknown as string;

const notBridgeTunnel = [
  "match",
  ["get", "brunnel"],
  ["bridge", "tunnel"],
  false,
  true,
] as const;

export function pixelBasemapStyle(scope: Element): StyleSpecification {
  const c = palette(scope);
  const width = (stops: number[], scale = 1) =>
    [
      "interpolate",
      ["exponential", 1.6],
      ["zoom"],
      ...stops.map((v, i) => (i % 2 ? v * scale : v)),
    ] as never;
  const classes = (list: string[]) =>
    [
      "all",
      notBridgeTunnel,
      ["match", ["get", "class"], list, true, false],
    ] as never;
  const road = (
    id: string,
    list: string[],
    stops: number[],
    color: string,
    minzoom: number,
    scale = 1,
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom,
    filter: classes(list),
    layout: { "line-cap": "butt", "line-join": "round" },
    paint: { "line-color": color, "line-width": width(stops, scale), ...extra },
  });
  const MAJOR = ["primary", "trunk", "motorway"];
  const MID = ["secondary", "tertiary"];
  const MINOR = ["minor", "service", "track"];
  const majorW = [8, 1.2, 13, 6, 16, 18, 19, 44];
  const midW = [10, 0.8, 13, 3.5, 16, 13, 19, 34];
  const minorW = [13, 0.6, 15, 3, 17, 9, 19, 22];
  const label = (id: string, list: string[], minzoom: number) => ({
    id,
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "transportation_name",
    minzoom,
    filter: ["match", ["get", "class"], list, true, false],
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": 420,
      "text-field": name,
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-rotation-alignment": "viewport",
      "text-pitch-alignment": "viewport",
      "text-max-angle": 30,
      "text-padding": 10,
      "icon-image": "px-label",
      "icon-text-fit": "both",
      "icon-text-fit-padding": [3, 7, 3, 7],
      "icon-rotation-alignment": "viewport",
      "icon-pitch-alignment": "viewport",
    },
    paint: { "text-color": c.ink },
  });
  return {
    version: 8,
    name: "BinSoon 像素插畫底圖（實驗）",
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      openmaptiles: { type: "vector", url: `${OFM}/planet` },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": c.ground },
      },
      // 磚紋只在近看時出現；遠看是平滑米色，避免整片雜訊。
      {
        id: "background-brick",
        type: "background",
        minzoom: 13,
        paint: {
          "background-pattern": "px-brick",
          "background-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            0,
            14,
            1,
          ],
        },
      },
      {
        id: "landuse-block",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        maxzoom: 14,
        filter: [
          "match",
          ["get", "class"],
          [
            "residential",
            "commercial",
            "retail",
            "industrial",
            "school",
            "hospital",
          ],
          true,
          false,
        ],
        paint: { "fill-color": c.block, "fill-opacity": 0.6 },
      },
      {
        id: "park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: { "fill-pattern": "px-grass", "fill-antialias": false },
      },
      {
        id: "landcover-grass",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "grass"],
        paint: { "fill-pattern": "px-grass", "fill-antialias": false },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        paint: { "fill-pattern": "px-wood", "fill-antialias": false },
      },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-pattern": "px-water", "fill-antialias": false },
      },
      {
        id: "waterway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        minzoom: 12,
        paint: { "line-color": c.water, "line-width": 2 },
      },
      // 建築：硬邊投影（往右下平移、不模糊）＋本體＋1px 外框。
      {
        id: "building-shadow",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 15,
        paint: {
          "fill-color": c.buildingShadow,
          "fill-translate": [2, 3],
          "fill-antialias": false,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, 1],
        },
      },
      {
        id: "building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 15,
        paint: {
          "fill-color": c.building,
          "fill-outline-color": c.buildingEdge,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, 1],
        },
      },
      road("road-path", ["path", "pedestrian"], [15, 1, 19, 6], c.path, 15, 1, {
        "line-dasharray": [1, 1],
      }),
      // 外框（深一階淺紫灰）→ 本體 → 白色虛線中線
      road("road-minor-casing", MINOR, minorW, c.roadEdge, 14, 1.35),
      road("road-mid-casing", MID, midW, c.roadEdge, 11, 1.3),
      road("road-major-casing", MAJOR, majorW, c.roadEdge, 8, 1.25),
      road("road-minor", MINOR, minorW, c.road, 14),
      road("road-mid", MID, midW, c.road, 10),
      road("road-major", MAJOR, majorW, c.road, 7),
      road("road-mid-dash", MID, [13, 0.6, 16, 1.5, 19, 3], c.roadDash, 14, 1, {
        "line-dasharray": [3, 3],
      }),
      road(
        "road-major-dash",
        MAJOR,
        [12, 0.8, 16, 2, 19, 4],
        c.roadDash,
        12.5,
        1,
        { "line-dasharray": [4, 3] },
      ),
      {
        id: "rail",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 14,
        filter: ["match", ["get", "class"], ["rail", "transit"], true, false],
        paint: {
          "line-color": c.rail,
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      },
      label("road-name-major", ["primary", "trunk"], 13.5),
      label("road-name", ["secondary", "tertiary"], 15),
      {
        id: "place-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        minzoom: 9,
        filter: [
          "step",
          ["zoom"],
          ["match", ["get", "class"], ["city", "town"], true, false],
          11,
          ["match", ["get", "class"], ["city", "town", "suburb"], true, false],
          15,
          [
            "match",
            ["get", "class"],
            ["city", "town", "suburb", "quarter", "neighbourhood"],
            true,
            false,
          ],
        ],
        layout: {
          "text-field": name,
          "text-font": ["Noto Sans Bold"],
          "text-size": ["step", ["zoom"], 13, 14, 15],
          "text-letter-spacing": 0.12,
          "text-max-width": 8,
          "text-padding": 10,
        },
        paint: {
          "text-color": c.ink,
          "text-halo-color": c.halo,
          "text-halo-width": 2,
        },
      },
    ] as never,
  };
}
