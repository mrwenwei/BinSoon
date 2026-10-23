// 一般垃圾／資源回收圖示：取自 Lucide（https://lucide.dev，lucide-static v0.468.0），授權 ISC
// （Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT);
// all other copyright (c) for Lucide are held by Lucide Contributors 2022）。授權全文見 README「圖示致謝」。
// general＝trash-2、recycling＝recycle，元素與座標原樣保留（trash-2 的兩條 <line> 也照原樣）。
// 24×24、fill=none、stroke=currentColor、stroke-width 2、round cap/join（見 WASTE_ICON_ATTRS）；
// 小尺寸處由 CSS／字串屬性把 stroke-width 提到 2.25。不要套 shape-rendering（平滑線條用預設）。
// React 元件（WasteType.tsx 的 WasteIcon）與地圖標記的 HTML 字串（map/botBars.ts）共用這份資料。
export type WasteIconElement = readonly [
  "path" | "line",
  Readonly<Record<string, string>>,
];
export const WASTE_ICON_ATTRS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;
export const WASTE_ICON_ELEMENTS: Record<
  "general" | "recycling",
  readonly WasteIconElement[]
> = {
  general: [
    ["path", { d: "M3 6h18" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }],
    ["line", { x1: "10", x2: "10", y1: "11", y2: "17" }],
    ["line", { x1: "14", x2: "14", y1: "11", y2: "17" }],
  ],
  recycling: [
    [
      "path",
      {
        d: "M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5",
      },
    ],
    [
      "path",
      {
        d: "M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12",
      },
    ],
    ["path", { d: "m14 16-3 3 3 3" }],
    ["path", { d: "M8.293 13.596 7.196 9.5 3.1 10.598" }],
    [
      "path",
      {
        d: "m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843",
      },
    ],
    ["path", { d: "m13.378 9.633 4.096 1.098 1.097-4.096" }],
  ],
};
// 給 HTML 字串用（地圖標記）：回傳 <path>／<line> 元素字串。
export function wasteIconInnerHtml(type: "general" | "recycling") {
  return WASTE_ICON_ELEMENTS[type]
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([k, v]) => `${k}="${v}"`)
          .join(" ")}/>`,
    )
    .join("");
}

const paths = {
  truck:
    "M3 5h12v12H3V5Zm12 5h4l3 4v3h-7M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  car: "M5 17H3v-6l2-6h14l2 6v6h-2M3 11h18M7 17h10M5 17v3m14-3v3M6 14h2m8 0h2",
  scooter:
    "M4 17a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm12 0a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM7 17l4-8h5l3 8M11 9H6m10 0-1-5h-3m-2 13h6",
  route: "M5 21V8a3 3 0 0 1 3-3h10m-4 4 4-4-4-4M5 15h9a4 4 0 0 0 4-4",
  sun: "M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41",
  moon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",
  chevron: "m7 10 5 5 5-5",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  search: "M21 21l-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z",
  heart: "M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 1 9 8 15 7-6 12-11 8-15Z",
  camera: "M3 7h5l2-3h4l2 3h5v14H3V7Zm13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  check: "m5 12 4 4L19 6",
  user: "M20 21v-3a8 8 0 0 0-16 0v3m12-15a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  report: "M12 3 2 21h20L12 3Zm0 6v5m0 3v1",
  gift: "M3 8h18v5H3V8Zm2 5v8h14v-8M12 8v13m0-13C4 8 5 1 9 3l3 5Zm0 0c8 0 7-7 3-5l-3 5Z",
  close: "m6 6 12 12M18 6 6 18",
  // Lucide share（lucide-static，ISC）：方框開口＋向上箭頭，三段合成一條 path。
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
  // toast 類型圖示（Lucide circle-check／info）與「⋯」更多動作。
  done: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M9 12l2 2 4-4",
  info: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 16v-4M12 8h.01",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  // 認領步驟「遇到這些狀況就回報」的狀況圖示（Lucide 線條風格：滿了、很髒、旁邊有人亂丟、壞掉）。
  full: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 10h8M8 14h8M8 18h8",
  dirty:
    "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05zM12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",
  dumping: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0",
  broken:
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
