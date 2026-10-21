import { isPhoneBrowser } from "./phone";
export const CREW_STORE = "binsoon-crew-demo-v1";
export const CREW_SESSION = "binsoon-crew-demo-session";
export const CREW_UPDATED = "binsoon-crew-demo-updated";
export type CrewStatus = "pending" | "processing" | "done";
export type CrewMode = "walk" | "scooter" | "car";
export type CrewTask = {
  id: string;
  name: string;
  issue: string;
  detail: string;
  distance: number;
  minutes: number;
  urgent: boolean;
  offline: boolean;
  source: "citizen" | "sensor";
  status: CrewStatus;
  truth?: "yes" | "no";
  composition?: "street" | "household" | "mixed";
  completionPhoto?: string;
  interiorPhoto?: string;
  completedAt?: string;
};
const initial: CrewTask[] = [
  {
    id: "A-012",
    name: "新生南路一段 #A-012",
    issue: "即刻處理 · 滿溢 92%＋桶旁堆放",
    detail: "民眾回報 1 張照片 · 距離 280 公尺",
    distance: 280,
    minutes: 2,
    urgent: true,
    offline: false,
    source: "citizen",
    status: "pending",
  },
  {
    id: "A-018",
    name: "大安森林公園 3 號門",
    issue: "滿溢 96%",
    detail: "感測器自動派工 · 距離 450 公尺",
    distance: 450,
    minutes: 15,
    urgent: false,
    offline: false,
    source: "sensor",
    status: "pending",
  },
  {
    id: "B-031",
    name: "信義路三段 #B-031",
    issue: "滿溢 82%",
    detail: "感測器自動派工 · 距離 600 公尺",
    distance: 600,
    minutes: 31,
    urgent: false,
    offline: false,
    source: "sensor",
    status: "pending",
  },
  {
    id: "C-004",
    name: "和平東路 #C-004",
    issue: "稽查點 · 容量暴增",
    detail: "10 分鐘內從 20% 跳到 75%，疑似整袋家用垃圾",
    distance: 720,
    minutes: 48,
    urgent: false,
    offline: false,
    source: "sensor",
    status: "pending",
  },
  {
    id: "D-021",
    name: "建國南路 #D-021",
    issue: "讀值異常 · 請到場確認",
    detail: "感測器 24 小時停在 41%，暫不列入評分",
    distance: 900,
    minutes: 60,
    urgent: false,
    offline: true,
    source: "sensor",
    status: "pending",
  },
  {
    id: "A-006",
    name: "永康街口 #A-006",
    issue: "桶旁堆放",
    detail: "已確認到場 · 處理中",
    distance: 400,
    minutes: 22,
    urgent: false,
    offline: false,
    source: "citizen",
    status: "processing",
  },
  ...Array.from({ length: 9 }, (_, i): CrewTask => ({
    id: `done-${i + 1}`,
    name: ["金華街口", "師大路口", "麗水街口"][i % 3] + ` #E-00${i + 1}`,
    issue: "今日清運完成",
    detail: "模擬完成紀錄",
    distance: 0,
    minutes: 65 + i * 12,
    urgent: false,
    offline: false,
    source: "sensor",
    status: "done",
    truth: "yes",
    composition: "street",
    completedAt: "2026-10-21T08:00:00Z",
  })),
];
export function crewSignedIn() {
  try {
    return sessionStorage.getItem(CREW_SESSION) === "yes";
  } catch {
    return false;
  }
}
export function setCrewSignedIn(value: boolean) {
  if (value) sessionStorage.setItem(CREW_SESSION, "yes");
  else sessionStorage.removeItem(CREW_SESSION);
  window.dispatchEvent(new Event(CREW_UPDATED));
}
export function readCrewTasks(): CrewTask[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CREW_STORE) || "null");
    if (saved?.version === 1 && Array.isArray(saved.tasks)) {
      return initial.map((task) => {
        const row = saved.tasks.find((item: CrewTask) => item.id === task.id);
        if (!row || !["pending", "processing", "done"].includes(row.status))
          return { ...task };
        const photo = (value: unknown) =>
          typeof value === "string" && value.startsWith("data:image/svg+xml,")
            ? value
            : undefined;
        return {
          ...task,
          status: row.status,
          truth: ["yes", "no"].includes(row.truth) ? row.truth : undefined,
          composition: ["street", "household", "mixed"].includes(
            row.composition,
          )
            ? row.composition
            : undefined,
          completionPhoto: photo(row.completionPhoto),
          interiorPhoto: photo(row.interiorPhoto),
          completedAt:
            typeof row.completedAt === "string" ? row.completedAt : undefined,
        };
      });
    }
  } catch {
    /* Malformed demo data uses the fixture, never a backend fallback. */
  }
  return structuredClone(initial);
}
export function crewPhoto(kind: "report" | "completion" | "interior") {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string) => style.getPropertyValue(`--${name}`).trim();
  const label = {
    report: "民眾回報的現場照片",
    completion: "清運完成照",
    interior: "桶內照片",
  }[kind];
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${color("field")}"/><path d="M266 100h108l-12 142h-84z" fill="${color("mint")}"/><path d="M254 90h132" stroke="${color("text")}" stroke-width="12"/><text x="320" y="285" text-anchor="middle" fill="${color("text")}" font-size="22">${label}</text><text x="320" y="328" text-anchor="middle" fill="${color("text-muted")}" font-size="19">DEMO · 模擬照片，非現場證據</text></svg>`,
    )
  );
}
export function updateCrewTask(
  id: string,
  change: Partial<
    Pick<
      CrewTask,
      "status" | "truth" | "composition" | "completionPhoto" | "interiorPhoto"
    >
  >,
) {
  if (!crewSignedIn()) throw new Error("請先以模擬清潔員登入。");
  if (!isPhoneBrowser()) throw new Error("請使用手機現場處理派工。");
  const tasks = readCrewTasks();
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("找不到此模擬派工。");
  if (task.status === "done") throw new Error("此派工已完成，請返回清單查看。");
  const next = { ...task, ...change };
  if (next.status === "done") {
    if (
      task.status !== "processing" ||
      !next.truth ||
      !next.composition ||
      !next.completionPhoto
    )
      throw new Error(
        "請先確認到場、回報是否屬實、垃圾組成，並產生模擬完成照。",
      );
    next.completedAt = new Date().toISOString();
  }
  localStorage.setItem(
    CREW_STORE,
    JSON.stringify({
      version: 1,
      tasks: tasks.map((item) => (item.id === id ? next : item)),
    }),
  );
  window.dispatchEvent(new Event(CREW_UPDATED));
}
export const crewModes: Record<
  CrewMode,
  { label: string; minutes: number; distance: string; points: string }
> = {
  walk: {
    label: "步行",
    minutes: 35,
    distance: "2.1",
    points: "95,285 145,285 145,205 145,65 255,65 255,205",
  },
  scooter: {
    label: "機車",
    minutes: 12,
    distance: "2.4",
    points: "95,285 65,285 65,205 145,205 145,65 255,65 255,205",
  },
  car: {
    label: "汽車",
    minutes: 18,
    distance: "2.8",
    points: "95,285 65,285 65,205 145,205 145,65 255,65 300,65 300,205 255,205",
  },
};
