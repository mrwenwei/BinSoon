import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import {
  addGreeneryImages,
  GREEN_TIERS,
  type GreeneryColors,
} from "./basemapGreenery";

// BinSoon 夜間作戰風底圖：OpenFreeMap 的 openmaptiles 向量圖磚，配色取自
// src/styles/tokens.css 的深色控制台 token（panel／chrome／line／teal 等）與其混色。
// MapLibre 無法讀 CSS 變數，所以在建立底圖時讀取 :root 的計算值。
const OFM = "https://tiles.openfreemap.org";

export function token(name: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim();
  return value || "transparent";
}

function rgb(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 兩個 token 依比例混色（只接受 #rrggbb）；失敗時退回第一個 token。
function mix(a: string, b: string, weight: number) {
  const x = rgb(a),
    y = rgb(b);
  if (!x || !y) return a;
  const c = x.map((v, i) => Math.round(v * (1 - weight) + y[i] * weight));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
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

// 色票延伸（來源：使用者提供的配色圖；#4ABA94 直接用 --teal，不重複定義）。
// 注意：EXT.ochre #D0542D 與 --signal #f2673a 不同，不取代訊號橘或導航橘，
// 底圖也不用它畫大面積色。
const EXT = {
  cream: "#FFEDB7", // 奶油：道路色
  umber: "#685B53", // 暖灰褐：道路外框
  charcoalTeal: "#2B3A39", // 深青炭：底、街區、公園加深
  ochre: "#D0542D", // 赭橘（目前底圖未使用）
};

// 定案配色（原 F2）：奶油道路＋暖灰褐外框，冷青灰的底與街區，公園與水域更深。
// tint = mix(teal, charcoalTeal, 0.5)，底、街區往 tint 混；公園往較飽和的青綠混。
type Tok = Record<string, string>;
const WHITE = "#ffffff";
type Spec = {
  ground: string;
  road: string;
  casing: string;
  block: string;
  park: string;
  water: string;
};
function colors(t: Tok): Spec {
  const tint = mix(t.teal, EXT.charcoalTeal, 0.5);
  const road = mix(EXT.cream, WHITE, 0.45);
  return {
    ground: mix(t.map, tint, 0.25),
    road,
    casing: mix(road, EXT.umber, 0.55),
    block: mix(t.mapBlock, tint, 0.37),
    park: mix(t.mapPark, mix(t.teal, EXT.charcoalTeal, 0.15), 0.68),
    water: mix(t.teal, EXT.charcoalTeal, 0.9), // 深色水域，亮度約 23%
  };
}

function palette() {
  const t: Tok = {
    map: token("map"),
    mapBlock: token("map-block"),
    mapPark: token("map-park"),
    mapRoad: token("map-road"),
    ink: token("text-on-light"),
    inkMuted: token("text-on-light-muted"),
    teal: token("teal"),
    tealDeep: token("teal-on-mint"),
    signal: token("signal"),
    mint: token("mint"),
  };
  const v = colors(t);
  const water = v.water;
  return {
    ground: v.ground,
    block: v.block,
    water,
    greenGround: v.park,
    // 道路外框：幹道最深，越小的路越淡（往道路色混）
    casingMajor: v.casing,
    casingMid: mix(v.casing, v.road, 0.3),
    casingMinor: mix(v.casing, v.road, 0.5),
    // 建築外框：街區色往青綠深色加深，色相與道路外框不同
    buildingEdge: mix(v.block, t.tealDeep, 0.4),
    halo: t.mapRoad,
    ink: t.ink,
    railColor: t.inkMuted,
    // 步道：街區色往道路色只混一半，比道路淡很多，不搶眼
    pathColor: mix(v.block, v.road, 0.5),
    boundary: mix(t.mapBlock, t.ink, 0.45),
    road: v.road,
    greenery: {
      ground: v.park,
      tuftDark: mix(v.park, t.tealDeep, 0.5),
      tuftLight: mix(v.park, t.mapRoad, 0.4),
      flower: t.mapRoad,
      flowerCore: t.teal,
      treeEdge: mix(t.tealDeep, t.ink, 0.3),
      treeBody: t.teal,
      treeLight: mix(t.teal, t.mapRoad, 0.4),
      water,
      waveLight: mix(water, t.mapRoad, 0.5),
      waveDark: mix(water, t.ink, 0.55),
    } satisfies GreeneryColors,
  };
}

// 建立底圖後呼叫：註冊綠地像素圖案（樣式本身引用這些圖名）。
export function registerBasemapImages(gl: MlMap) {
  addGreeneryImages(gl, palette().greenery);
}

export function binsoonBasemapStyle(): StyleSpecification {
  const c = palette();
  const roadLine = (
    id: string,
    classes: string[],
    widths: number[],
    color: string,
    minzoom = 10,
    extra = 0,
    // [起點縮放, 起點不透明度, 終點縮放, 終點不透明度]：細節淡入，避免突然跳出。
    fade?: [number, number, number, number],
  ) => ({
    id,
    type: "line" as const,
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom,
    filter: [
      "all",
      notBridgeTunnel,
      ["match", ["get", "class"], classes, true, false],
    ] as never,
    layout: { "line-cap": "round" as const, "line-join": "round" as const },
    paint: {
      "line-color": color,
      ...(fade
        ? {
            "line-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              fade[0],
              fade[1],
              fade[2],
              fade[3],
            ],
          }
        : {}),
      "line-width": [
        "interpolate",
        ["exponential", 1.4],
        ["zoom"],
        ...widths.map((v, i) => (i % 2 === 1 ? v + extra : v)),
      ] as never,
    },
  });
  // 綠地圖案分段：每段用不同「格寬」的貼磚（整數 CSS px），縮放越大格寬越大，
  // 樹花草的世界大小才不會因縮放而相對變小。maplibre zoom = Leaflet zoom - 1。
  const greenFill = (
    id: string,
    layer: string,
    filter: unknown,
    flat: string,
    kind: "green" | "wood",
  ) => {
    const base = {
      type: "fill",
      source: "openmaptiles",
      "source-layer": layer,
      ...(filter ? { filter } : {}),
    };
    const tiers: [string, number, number | undefined][] = GREEN_TIERS.map(
      (t, i) => [t.suffix, t.min, GREEN_TIERS[i + 1]?.min],
    );
    return [
      {
        ...base,
        id: `${id}-flat`,
        maxzoom: GREEN_TIERS[0].min,
        paint: { "fill-color": flat },
      },
      ...tiers.map(([suffix, min, max]) => ({
        ...base,
        id: `${id}-${suffix}`,
        minzoom: min,
        ...(max ? { maxzoom: max } : {}),
        paint: {
          "fill-pattern": `bs-${kind}-${suffix}`,
          "fill-antialias": false,
        },
      })),
    ];
  };
  return {
    version: 8,
    name: "BinSoon 夜間作戰底圖",
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
      {
        id: "landuse-block",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
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
        paint: { "fill-color": c.block, "fill-opacity": 0.55 },
      },
      ...greenFill("park", "park", null, c.greenGround, "green"),
      ...greenFill(
        "landcover-grass",
        "landcover",
        ["==", ["get", "class"], "grass"],
        c.greenGround,
        "green",
      ),
      ...greenFill(
        "landcover-wood",
        "landcover",
        ["==", ["get", "class"], "wood"],
        c.greenGround,
        "wood",
      ),
      {
        id: "water-flat",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        maxzoom: GREEN_TIERS[0].min,
        paint: { "fill-color": c.water },
      },
      ...GREEN_TIERS.map((t, i) => ({
        id: `water-${t.suffix}`,
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        minzoom: t.min,
        ...(GREEN_TIERS[i + 1] ? { maxzoom: GREEN_TIERS[i + 1].min } : {}),
        paint: {
          "fill-pattern": `bs-water-${t.suffix}`,
          "fill-antialias": false,
        },
      })),
      {
        id: "waterway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        minzoom: 12,
        filter: [
          "match",
          ["get", "class"],
          ["river", "canal"],
          true,
          ["step", ["zoom"], false, 15, true],
        ],
        paint: { "line-color": c.water, "line-width": 1.6 },
      },
      // 建築：Leaflet 16.5 起淡入（maplibre 15.5），外框到 Leaflet 17 才淡入
      {
        id: "building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 15.5,
        paint: {
          "fill-color": c.block,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15.5,
            0,
            16.5,
            1,
          ],
        },
      },
      {
        id: "building-outline",
        type: "line",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 16,
        paint: {
          "line-color": c.buildingEdge,
          "line-width": 0.8,
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 16, 0, 17, 1],
        },
      },
      {
        id: "boundary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        minzoom: 8,
        filter: [
          "all",
          ["<=", ["get", "admin_level"], 8],
          ["!=", ["get", "maritime"], 1],
        ],
        paint: {
          "line-color": c.boundary,
          "line-width": 1,
          "line-dasharray": [4, 3],
        },
      },
      // 道路分層（maplibre zoom = Leaflet − 1）。每級道路都有外框（比主線寬 1–2px，
      // 越小的路框越細越淡），外框比道路晚約 0.5 級淡入：
      // 幹道 ML7 起、外框 ML10–12；次要道路 ML11 起淡細線、外框 ML13–14.5；
      // 三級道路 ML14–15、外框 ML14.5–15.5；小巷／服務道路 ML15.5–16.5、外框 ML16–17；
      // 步道 ML16–17。
      roadLine(
        "road-path",
        ["path", "pedestrian"],
        [14, 0.6, 20, 4],
        c.pathColor,
        16,
        0,
        [16, 0, 17, 0.6],
      ),
      roadLine(
        "road-minor-casing",
        ["minor", "service", "track"],
        [12, 0.4, 14, 2, 20, 16],
        c.casingMinor,
        16,
        1.6,
        [16, 0, 17, 1],
      ),
      roadLine(
        "road-tertiary-casing",
        ["tertiary"],
        [9, 0.6, 14, 4, 20, 20],
        c.casingMid,
        14.5,
        2,
        [14.5, 0, 15.5, 1],
      ),
      roadLine(
        "road-secondary-casing",
        ["secondary"],
        [9, 0.6, 14, 4, 20, 20],
        c.casingMid,
        13,
        2.5,
        [13, 0, 14.5, 1],
      ),
      roadLine(
        "road-major-casing",
        ["primary", "trunk", "motorway"],
        [7, 0.8, 14, 6, 20, 26],
        c.casingMajor,
        10,
        3,
        [10, 0, 12, 1],
      ),
      roadLine(
        "road-minor",
        ["minor", "service", "track"],
        [12, 0.4, 14, 2, 20, 16],
        c.road,
        15.5,
        0,
        [15.5, 0, 16.5, 1],
      ),
      roadLine(
        "road-tertiary",
        ["tertiary"],
        [9, 0.6, 14, 4, 20, 20],
        c.road,
        14,
        0,
        [14, 0, 15, 1],
      ),
      roadLine(
        "road-secondary",
        ["secondary"],
        [9, 0.6, 14, 4, 20, 20],
        c.road,
        11,
        0,
        [11, 0.5, 14, 1],
      ),
      roadLine(
        "road-primary",
        ["primary", "trunk", "motorway"],
        [7, 0.8, 14, 6, 20, 26],
        c.road,
        7,
      ),
      {
        id: "rail",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 14,
        filter: ["match", ["get", "class"], ["rail", "transit"], true, false],
        paint: {
          "line-color": c.railColor,
          "line-width": 1,
          "line-dasharray": [3, 3],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
        },
      },
      // 路名：幹道 ml14 起；次要／三級道路 ml15.5 起
      {
        id: "road-name-major",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 14,
        filter: ["match", ["get", "class"], ["primary", "trunk"], true, false],
        layout: {
          "symbol-placement": "line",
          "text-field": name,
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-letter-spacing": 0.1,
          "text-padding": 8,
        },
        paint: {
          "text-color": c.ink,
          "text-halo-color": c.halo,
          "text-halo-width": 1.6,
        },
      },
      {
        id: "road-name",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 15.5,
        filter: [
          "match",
          ["get", "class"],
          ["secondary", "tertiary"],
          true,
          false,
        ],
        layout: {
          "symbol-placement": "line",
          "text-field": name,
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-letter-spacing": 0.1,
          "text-padding": 8,
        },
        paint: {
          "text-color": c.ink,
          "text-halo-color": c.halo,
          "text-halo-width": 1.6,
        },
      },
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
          "text-size": ["step", ["zoom"], 13, 14, 16],
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
