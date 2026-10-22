import type { BinState } from "../data/binState";

// 地圖標記角色「垃圾桶機器人」：24×23 像素圖，3/4 視角露出右側面，顯示放大 2 倍。
// 外型與配色取自設計稿（docs/DESIGN_SYSTEM.md MapMarker），臉放大成 14×7 螢幕。
// 平常顯示靜態表情（.bot-idle）；hover／鍵盤焦點／選中時才播放動態（.bot-anim，
// 換幀規則在 styles.css 的 .bin-bot）。撤除不畫角色，只畫同形狀的虛線外框。

// K 外框、T 蓋子頂面、W 頂面反光、S 蓋子／箱身側面亮、F 蓋子前緣、R 螢幕外框、
// N 螢幕、U 箱口下緣、B 箱身正面、D 箱身側面暗、G 燈號
const SPRITE = [
  "...KKKKKKKKKKKKKKKKKKKK.",
  "..KTTTTTTTTTTTTTTTTTTTSK",
  ".KTTTTTWWWWWWWWWTTTTTSSK",
  "KTTTTTTTTTTTTTTTTTTTSSSK",
  "KTTTTTTTTTTTTTTTTTTTKSSK",
  "KTTWWWWTTTTTTTTTTTTTKSKK",
  "KFFFFFFFFFFFFFFFFFFFKKSK",
  ".KKKKKKKKKKKKKKKKKKKKSSK",
  ".KRKNNNNNNNNNNNNNNKRKSSK",
  ".KRKNNNNNNNNNNNNNNKRKSSK",
  ".KRKNNNNNNNNNNNNNNKRKSSK",
  ".KRKNNNNNNNNNNNNNNKRKSSK",
  ".KRKNNNNNNNNNNNNNNKRKSSK",
  ".KRKNNNNNNNNNNNNNNKRKSSK",
  ".KRKKNNNNNNNNNNNNKKRKSDK",
  ".KRRRKKKKKKKKKKKKRRRKDDK",
  ".KRUUUUUUUUUUUUUUUURKDDK",
  ".KKKKKKKKKKKKKKKKKKKKDDK",
  ".KBBBBBBBBBBBBBBBBBBKDDK",
  ".KBBBBBBBBBBBBGGBBBBKDK.",
  ".KBBBBBBBBBBBBBBBBBBKK..",
  "..KBBBBBBBBBBBBBBBBKK...",
  "...KKKKKKKKKKKKKKKK.....",
];

// 臉畫在螢幕（第 8–14 列、第 4–17 欄，14×7）。E 眼／嘴、P 腮紅、Q 眼淚、M 舌頭。
// happy／sleep／sad 是靜態臉，其餘是動態用的變化（吃東西時才出現嘴巴）。
const FACE_X = 4;
const FACE_Y = 8;
const FACES = {
  happy: [
    "..............",
    "..EEE....EEE..",
    ".E...E..E...E.",
    ".E...E..E...E.",
    "PP..........PP",
    "..............",
    "..............",
  ],
  sleep: [
    "..............",
    "..............",
    ".E...E..E...E.",
    "..EEE....EEE..",
    "..............",
    "..............",
    "..............",
  ],
  sad: [
    "..............",
    "..EEEE..EEEE..",
    "..E..E..E..E..",
    "..E..E..E..E..",
    "..EEEE..EEEE..",
    "..Q........Q..",
    "..............",
  ],
  sad2: [
    "..............",
    "..EEEE..EEEE..",
    "..E..E..E..E..",
    "..E..E..E..E..",
    "..EEEE..EEEE..",
    "..Q........Q..",
    "..Q........Q..",
  ],
  sadBlink: [
    "..............",
    "..............",
    "..............",
    "..EEEE..EEEE..",
    "..............",
    "..Q........Q..",
    "..Q........Q..",
  ],
  eatOpen: [
    "..............",
    "..EEE....EEE..",
    ".E...E..E...E.",
    ".E...E..E...E.",
    "PP...EEEE...PP",
    ".....EMME.....",
    "......EE......",
  ],
  eatClosed: [
    "..............",
    "..EEE....EEE..",
    ".E...E..E...E.",
    ".E...E..E...E.",
    "PP..........PP",
    "PP...EEEE...PP",
    "..............",
  ],
  eatBlink: [
    "..............",
    "..............",
    ".EEEEE..EEEEE.",
    "..............",
    "PP..........PP",
    "PP...EEEE...PP",
    "..............",
  ],
};
type Face = keyof typeof FACES;

// 特效與道具（Y 星星、H 愛心、Z 睡覺、C／c 零食、paw 小爪子用角色本身的顏色）
const ITEMS = {
  spark1: ["Y"],
  sparkle: [".Y.", "YYY", ".Y."],
  heart: [".H.H.", "HHHHH", ".HHH.", "..H.."],
  z: ["ZZZZ", "..Z.", ".Z..", "ZZZZ"],
  Z: ["ZZZZZ", "...Z.", "..Z..", ".Z...", "ZZZZZ"],
  drop: ["Q", "Q"],
  drop1: ["Q"],
  crumb: ["C"],
  food0: [".CC.", "CcCC", "CCcC", ".CC."],
  food1: [".C.", "cCC", "CcC", ".C."],
  food2: ["C", "C"],
  paw: [".KKK.", "KTTTK", "KBBBK", ".KKK."],
};
type Item = keyof typeof ITEMS;

// 整隻跟著桶況換色（設計稿取色）；失聯的燈號熄燈。
const SKINS: Record<BinState, Record<string, string>> = {
  hungry: {
    T: "#90dcc0",
    W: "#e4f8f0",
    S: "#309070",
    F: "#4cbc94",
    R: "#4cbc94",
    U: "#3ca484",
    B: "#309070",
    D: "#1c6850",
    G: "#fff8e0",
  },
  full: {
    T: "#fcb898",
    W: "#ffe8dc",
    S: "#c44c24",
    F: "#e8683c",
    R: "#f4683c",
    U: "#d8542c",
    B: "#c8481c",
    D: "#a4381c",
    G: "#fff8e0",
  },
  offline: {
    T: "#dce4e0",
    W: "#f8f8f8",
    S: "#94a098",
    F: "#b0b8b4",
    R: "#bcc4c0",
    U: "#a4aca8",
    B: "#8c9890",
    D: "#707874",
    G: "#4f5552",
  },
};
const COMMON: Record<string, string> = {
  K: "var(--text-on-light)",
  N: "#242828",
  E: "var(--mascot-eye)",
  P: "var(--mascot-blush)",
  Q: "#90d4f0",
  M: "#f08a8a",
  Y: "#f5c842",
  H: "#f2708a",
  Z: "#4a4f8c",
  C: "#d9a35b",
  c: "#7a4a1e",
  sh: "var(--marker-shadow)",
};

type Frame = {
  face: Face;
  dx?: number;
  dy?: number;
  items?: [Item, number, number][];
};

const HAPPY: Frame[] = [
  { face: "happy", items: [["spark1", -2, 4]] },
  {
    face: "happy",
    dy: -1,
    items: [
      ["sparkle", -4, 1],
      ["spark1", 26, 6],
    ],
  },
  {
    face: "happy",
    dy: -3,
    items: [
      ["sparkle", -4, 1],
      ["sparkle", 24, -4],
      ["heart", -7, 8],
    ],
  },
  {
    face: "happy",
    dy: -1,
    items: [
      ["spark1", -3, 2],
      ["sparkle", 24, -4],
      ["heart", -7, 4],
    ],
  },
  {
    face: "happy",
    items: [
      ["spark1", 26, -2],
      ["heart", -7, 0],
    ],
  },
  {
    face: "happy",
    items: [
      ["sparkle", 24, -4],
      ["spark1", -3, 2],
    ],
  },
];
const EAT: Frame[] = [
  {
    face: "happy",
    items: [
      ["paw", -3, 15],
      ["food0", -2, 11],
    ],
  },
  {
    face: "eatOpen",
    items: [
      ["paw", 2, 15],
      ["food0", 5, 12],
    ],
  },
  {
    face: "eatClosed",
    dy: 1,
    items: [
      ["paw", 2, 15],
      ["food1", 6, 12],
      ["crumb", 10, 16],
      ["crumb", 12, 17],
    ],
  },
  {
    face: "eatOpen",
    items: [
      ["paw", 2, 15],
      ["food1", 6, 12],
      ["crumb", 10, 19],
      ["crumb", 12, 21],
    ],
  },
  {
    face: "eatClosed",
    dy: 1,
    items: [
      ["paw", 2, 15],
      ["food2", 8, 13],
      ["crumb", 11, 16],
      ["crumb", 12, 24],
    ],
  },
  {
    face: "eatClosed",
    items: [
      ["paw", 2, 15],
      ["crumb", 11, 20],
    ],
  },
  {
    face: "eatBlink",
    dy: 1,
    items: [
      ["paw", 0, 15],
      ["spark1", -3, 6],
    ],
  },
  {
    face: "happy",
    items: [
      ["paw", -3, 15],
      ["spark1", -4, 3],
    ],
  },
];
// 餓了：開心跳一下再吃兩輪；吃飽了：打瞌睡；失聯：發抖甩眼淚。
const ANIMS: Record<BinState, { frameMs: number; frames: Frame[] }> = {
  hungry: { frameMs: 130, frames: [...HAPPY, ...EAT, ...EAT] },
  full: {
    frameMs: 200,
    frames: [
      { face: "sleep", items: [["z", 19, -5]] },
      { face: "sleep", items: [["z", 19, -6]] },
      {
        face: "sleep",
        items: [
          ["z", 18, -7],
          ["Z", 23, -4],
        ],
      },
      { face: "sleep", dy: 1, items: [["Z", 23, -5]] },
      { face: "sleep", dy: 1, items: [["Z", 23, -6]] },
      { face: "sleep", items: [["z", 19, -5]] },
      {
        face: "sleep",
        items: [
          ["z", 19, -6],
          ["Z", 23, -4],
        ],
      },
      { face: "sleep", items: [["Z", 23, -6]] },
    ],
  },
  offline: {
    frameMs: 140,
    frames: [
      { face: "sad" },
      {
        face: "sad2",
        dx: -1,
        items: [
          ["drop", 2, 10],
          ["drop", 24, 10],
        ],
      },
      {
        face: "sad2",
        dx: 1,
        items: [
          ["drop", 0, 13],
          ["drop", 26, 13],
        ],
      },
      {
        face: "sadBlink",
        items: [
          ["drop1", -3, 16],
          ["drop1", 28, 16],
        ],
      },
      { face: "sad", dx: -1 },
      {
        face: "sad2",
        dx: 1,
        items: [
          ["drop", 2, 10],
          ["drop", 24, 10],
        ],
      },
      {
        face: "sad2",
        items: [
          ["drop", 0, 13],
          ["drop", 26, 13],
        ],
      },
      {
        face: "sad",
        items: [
          ["drop1", -3, 16],
          ["drop1", 28, 16],
        ],
      },
    ],
  },
};
const IDLE: Record<BinState, Frame> = {
  hungry: { face: "happy" },
  full: { face: "sleep", items: [["z", 19, -5]] },
  offline: { face: "sad" },
};

// 標記框：角色左側留 1 格、上方留 2 格，26×26 格＝52×52px；特效可畫出框外。
const BOX = "-1 -2 26 26";

function compose(frame: Frame, colors: Record<string, string>) {
  const cells = new Map<string, string>();
  const put = (x: number, y: number, ch: string) => {
    if (ch !== ".") cells.set(`${x},${y}`, ch);
  };
  for (let x = 2; x <= 20; x++) put(x, 23, "sh");
  const dx = frame.dx ?? 0;
  const dy = frame.dy ?? 0;
  SPRITE.forEach((row, r) =>
    [...row].forEach((ch, c) => put(c + dx, r + dy, ch)),
  );
  FACES[frame.face].forEach((row, r) =>
    [...row].forEach((ch, c) => put(FACE_X + c + dx, FACE_Y + r + dy, ch)),
  );
  for (const [name, x, y] of frame.items ?? [])
    ITEMS[name].forEach((row, r) =>
      [...row].forEach((ch, c) => put(x + c, y + r, ch)),
    );
  const paths: Record<string, string> = {};
  for (const [key, ch] of cells) {
    const [x, y] = key.split(",");
    paths[ch] = (paths[ch] ?? "") + `M${x} ${y}h1v1h-1z`;
  }
  return Object.entries(paths)
    .map(([ch, d]) => `<path fill="${colors[ch]}" d="${d}"/>`)
    .join("");
}

const cache = new Map<string, string>();

export function binBotSvg(state: BinState, animated = true) {
  const key = `${state}/${animated}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const colors = { ...COMMON, ...SKINS[state] };
  if (!animated) {
    const svg = `<svg class="bin-bot bot-${state}" viewBox="${BOX}" shape-rendering="crispEdges" aria-hidden="true"><g class="bot-idle">${compose(IDLE[state], colors)}</g></svg>`;
    cache.set(key, svg);
    return svg;
  }
  const { frameMs, frames } = ANIMS[state];
  const anim = frames
    .map(
      (f, i) => `<g class="bot-fr" style="--i:${i}">${compose(f, colors)}</g>`,
    )
    .join("");
  const svg = `<svg class="bin-bot bot-${state}" style="--bot-frame:${frameMs}ms;--bot-cycle:${frameMs * frames.length}ms;--bot-kf:bot-f${frames.length}" viewBox="${BOX}" shape-rendering="crispEdges" aria-hidden="true"><g class="bot-idle">${compose(IDLE[state], colors)}</g><g class="bot-anim">${anim}</g></svg>`;
  cache.set(key, svg);
  return svg;
}

// 撤除：現場已經沒有桶，只畫角色外圍的虛線（2 格實、2 格空），「撤」字由 marker.ts 放在中間。
let removedSvg = "";
export function removedBinSvg() {
  if (removedSvg) return removedSvg;
  const filled = (r: number, c: number) => (SPRITE[r]?.[c] ?? ".") !== ".";
  let d = "";
  SPRITE.forEach((row, r) =>
    [...row].forEach((_, c) => {
      if (!filled(r, c)) return;
      const edge =
        !filled(r - 1, c) ||
        !filled(r + 1, c) ||
        !filled(r, c - 1) ||
        !filled(r, c + 1);
      if (edge && (r + c) % 4 < 2) d += `M${c} ${r}h1v1h-1z`;
    }),
  );
  removedSvg = `<svg class="bin-bot-removed" viewBox="${BOX}" shape-rendering="crispEdges" aria-hidden="true"><path fill="var(--text-on-light-muted)" d="${d}"/></svg>`;
  return removedSvg;
}
