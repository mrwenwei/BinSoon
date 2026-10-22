import {
  demoCitizenSnapshot,
  demoBinById,
  updateDemoCrewCase,
  DEMO_STAFF_ID,
} from "./demoCitizen";
import { problemLabels } from "./api";
import type { LocationRecord } from "./locations";
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
  eventId?: string;
  binId?: string;
  staffId?: string;
  reportCount?: number;
  reportPhoto?: string;
  wasteType?: "general" | "recycling";
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
  ...Array.from({ length: 3 }, (_, i): CrewTask => ({
    id: `done-${i + 1}`,
    name: ["金華街口", "師大路口", "麗水街口"][i % 3] + ` #E-00${i + 1}`,
    issue: "今日清運完成",
    detail: "完成紀錄",
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
  let saved: { version?: number; tasks?: CrewTask[] } = {};
  try {
    saved = JSON.parse(localStorage.getItem(CREW_STORE) || "{}");
  } catch {
    /* Keep deterministic fixtures. */
  }
  const citizen = demoCitizenSnapshot();
  const byEvent = new Map<string, typeof citizen.reports>();
  for (const report of citizen.reports.filter(
    (r) => demoBinById(r.bin_id)?.district === "大安區",
  ))
    byEvent.set(report.event_id, [
      ...(byEvent.get(report.event_id) || []),
      report,
    ]);
  const cases: CrewTask[] = [...byEvent.entries()].map(([eventId, reports]) => {
    const report = reports[0];
    const bin = demoBinById(report.bin_id);
    const completion = citizen.crew_completions?.[eventId];
    return {
      id: `citizen-${eventId}`,
      eventId,
      binId: report.bin_id,
      wasteType: report.waste_type || "general",
      name: bin?.label || "桶位",
      issue: problemLabels[report.type],
      detail: `${report.waste_type === "recycling" ? "資源回收" : "一般垃圾"} · 市民回報 ${reports.length} 筆`,
      distance: bin?.distance_m || 0,
      minutes: 0,
      urgent: report.type === "full" || report.type === "dumping",
      offline: false,
      reportCount: reports.length,
      reportPhoto: citizen.media.find(
        (media) => media.id === report.photo_ids[0],
      )?.url,
      source: "citizen",
      status: completion
        ? "done"
        : report.work_status === "arrived"
          ? "processing"
          : "pending",
      truth:
        report.status === "approved"
          ? "yes"
          : report.status === "rejected"
            ? "no"
            : undefined,
      completedAt: completion?.completedAt,
      staffId: completion?.staffId || DEMO_STAFF_ID,
      completionPhoto: completion?.photo || undefined,
    };
  });
  return [...initial, ...cases].map((task) => {
    const row =
      saved.version === 1 && Array.isArray(saved.tasks)
        ? saved.tasks.find((r) => r.id === task.id)
        : undefined;
    const photo = (value: unknown) =>
      typeof value === "string" && value.startsWith("data:image/svg+xml,")
        ? value
        : undefined;
    return {
      ...task,
      staffId: task.staffId || DEMO_STAFF_ID,
      ...(row
        ? {
            status: task.eventId
              ? task.status
              : ["pending", "processing", "done"].includes(row.status)
                ? row.status
                : task.status,
            truth: task.eventId
              ? task.truth
              : ["yes", "no"].includes(row.truth || "")
                ? row.truth
                : task.truth,
            composition: ["street", "household", "mixed"].includes(
              row.composition || "",
            )
              ? row.composition
              : task.composition,
            completionPhoto: photo(row.completionPhoto) || task.completionPhoto,
            interiorPhoto: photo(row.interiorPhoto),
            completedAt: task.eventId
              ? task.completedAt
              : typeof row.completedAt === "string"
                ? row.completedAt
                : task.completedAt,
          }
        : {}),
    };
  });
}
export function crewTaskLocation(task: CrewTask): LocationRecord {
  const bin = task.binId && demoBinById(task.binId);
  if (bin) return bin;
  const index = initial.findIndex((item) => item.id === task.id);
  return {
    id: `demo-crew-bin-${task.id}`,
    kind: "bin",
    label: task.name,
    latitude: 25.033 + (index % 4) * 0.0006,
    longitude: 121.5358 + (index % 3) * 0.0007,
    district: "大安區",
    address: null,
    note: "清潔隊固定展示站點，非實際桶位",
    source_type: "local_demo",
    source_row: null,
    source_file: null,
    location_precision: null,
    reported_count: null,
    bin_status: null,
  };
}
export function crewRanking(district: string, selectedMonth: string) {
  const tasks = readCrewTasks();
  const citizen = demoCitizenSnapshot();
  const rows = [
    { staffId: "demo-crew-qing", name: "清潔員阿清", base: 47, likes: 126 },
    { staffId: DEMO_STAFF_ID, name: "清潔員阿順", base: 32, likes: 128 },
    { staffId: "demo-crew-an", name: "清潔員阿安", base: 38, likes: 143 },
    { staffId: "demo-crew-lin", name: "清潔員阿林", base: 31, likes: 61 },
    { staffId: "demo-crew-he", name: "清潔員阿和", base: 27, likes: 40 },
  ];
  const monthOf = (at: string) =>
    new Date(at)
      .toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })
      .slice(0, 7);
  return rows
    .map((row) => ({
      ...row,
      completed:
        (district === "大安區" && selectedMonth === "2026-10" ? row.base : 0) +
        (district === "大安區"
          ? tasks.filter(
              (t) =>
                t.staffId === row.staffId &&
                t.status === "done" &&
                t.truth !== "no" &&
                !t.offline &&
                t.completedAt &&
                monthOf(t.completedAt) === selectedMonth,
            ).length
          : 0),
      likes:
        (district === "大安區" && selectedMonth === "2026-10" ? row.likes : 0) +
        (district === "大安區"
          ? Object.values(citizen.crew_completions || {}).filter(
              (c) =>
                c.staffId === row.staffId &&
                c.likedAt &&
                monthOf(c.completedAt) === selectedMonth,
            ).length
          : 0),
    }))
    .sort((a, b) => b.completed - a.completed)
    .map((row, index, all) => ({
      ...row,
      rank: all.findIndex((other) => other.completed === row.completed) + 1,
      current: row.staffId === DEMO_STAFF_ID,
    }));
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
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${color("field")}"/><path d="M266 100h108l-12 142h-84z" fill="${color("mint")}"/><path d="M254 90h132" stroke="${color("text")}" stroke-width="12"/><text x="320" y="285" text-anchor="middle" fill="${color("text")}" font-size="22">${label}</text></svg>`,
    )
  );
}
export async function updateCrewTask(
  id: string,
  change: Partial<
    Pick<
      CrewTask,
      "status" | "truth" | "composition" | "completionPhoto" | "interiorPhoto"
    >
  >,
) {
  if (!crewSignedIn()) throw new Error("請先以清潔員登入。");
  if (!isPhoneBrowser()) throw new Error("請使用手機現場處理派工。");
  const tasks = readCrewTasks();
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("找不到此派工。");
  if (task.status === "done") throw new Error("此派工已完成，請返回清單查看。");
  const next = { ...task, ...change };
  if (next.status === "done") {
    if (
      task.status !== "processing" ||
      !next.truth ||
      !next.composition ||
      !next.completionPhoto
    )
      throw new Error("請先確認到場、回報是否屬實、垃圾組成，並產生完成照。");
    next.completedAt = new Date().toISOString();
  }
  localStorage.setItem(
    CREW_STORE,
    JSON.stringify({
      version: 1,
      tasks: tasks.map((item) => (item.id === id ? next : item)),
    }),
  );
  if (task.eventId)
    await updateDemoCrewCase(task.eventId, {
      arrived: change.status === "processing",
      truth: change.truth,
      finish: change.status === "done",
      photo: next.completionPhoto,
      composition: next.composition,
    });
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
