import type { StyleSpecification } from "maplibre-gl";

// BinSoon 灰綠底圖：OpenFreeMap 的 openmaptiles 向量圖磚，配色全部取自
// src/styles/tokens.css 的 map／map-block／map-park／map-road 等 token。
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
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
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

export function binsoonBasemapStyle(): StyleSpecification {
  const map = token("map");
  const block = token("map-block");
  const park = token("map-park");
  const road = token("map-road");
  const ink = token("text-on-light");
  const inkMuted = token("text-on-light-muted");
  const water = mix(park, token("teal-on-mint"), 0.28);
  const roadEdge = mix(block, ink, 0.1);
  const roadLine = (
    id: string,
    classes: string[],
    widths: number[],
    color = road,
    minzoom = 10,
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
      "line-width": [
        "interpolate",
        ["exponential", 1.4],
        ["zoom"],
        ...widths,
      ] as never,
    },
  });
  return {
    version: 8,
    name: "BinSoon 灰綠底圖",
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      openmaptiles: { type: "vector", url: `${OFM}/planet` },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": map },
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
        paint: { "fill-color": block, "fill-opacity": 0.7 },
      },
      {
        id: "park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: { "fill-color": park },
      },
      {
        id: "landcover-green",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["grass", "wood"], true, false],
        paint: { "fill-color": park, "fill-opacity": 0.8 },
      },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": water },
      },
      {
        id: "waterway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        paint: { "line-color": water, "line-width": 1.2 },
      },
      {
        id: "building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: { "fill-color": block, "fill-outline-color": roadEdge },
      },
      roadLine("road-path", ["path", "pedestrian"], [14, 0.6, 20, 5], road, 14),
      roadLine(
        "road-minor",
        ["minor", "service", "track"],
        [12, 0.4, 14, 2, 20, 16],
      ),
      roadLine(
        "road-secondary",
        ["secondary", "tertiary"],
        [9, 0.6, 14, 4, 20, 20],
      ),
      roadLine(
        "road-primary",
        ["primary", "trunk", "motorway"],
        [7, 0.8, 14, 6, 20, 26],
      ),
      {
        id: "rail",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["match", ["get", "class"], ["rail", "transit"], true, false],
        paint: {
          "line-color": roadEdge,
          "line-width": 1,
          "line-dasharray": [3, 3],
        },
      },
      {
        id: "road-name",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 15,
        filter: [
          "match",
          ["get", "class"],
          ["primary", "secondary", "tertiary", "trunk"],
          true,
          false,
        ],
        layout: {
          "symbol-placement": "line",
          "text-field": name,
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-letter-spacing": 0.1,
        },
        paint: {
          "text-color": inkMuted,
          "text-halo-color": road,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "place-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        minzoom: 11,
        filter: [
          "match",
          ["get", "class"],
          ["suburb", "town", "city"],
          true,
          false,
        ],
        layout: {
          "text-field": name,
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-letter-spacing": 0.15,
          "text-max-width": 8,
        },
        paint: {
          "text-color": ink,
          "text-halo-color": map,
          "text-halo-width": 1.4,
        },
      },
    ],
  };
}
