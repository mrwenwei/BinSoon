import { useRef, useState } from "react";
import { locations } from "./locations";
import { binDemo, demoOrigin } from "./binDemo";

export interface Point {
  latitude: number;
  longitude: number;
}
// A disclosed demonstration rectangle, never an administrative boundary.
export const demoBounds = {
  south: 25.012,
  north: 25.048,
  west: 121.525,
  east: 121.57,
};
export const initialPoint: Point = {
  latitude: demoOrigin[0],
  longitude: demoOrigin[1],
};
export function inDemoBounds(point: Point) {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= demoBounds.south &&
    point.latitude <= demoBounds.north &&
    point.longitude >= demoBounds.west &&
    point.longitude <= demoBounds.east
  );
}
export function distanceMeters(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export const existingBins = locations.filter(
  (p) => p.kind === "bin" && !binDemo(p).removed,
);
export function nearestBin(point: Point, removedIds: string[] = []) {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  )
    return null;
  return (
    existingBins
      .filter((bin) => !removedIds.includes(bin.id))
      .map((bin) => ({ bin, distance: distanceMeters(point, bin) }))
      .sort((a, b) => a.distance - b.distance)[0] ?? null
  );
}
export function taipeiMonth(value: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}
export function remainingProposals(
  state: ParticipationState,
  now = new Date().toISOString(),
) {
  return Math.max(
    0,
    3 -
      state.proposals.filter(
        (p) => p.mine && taipeiMonth(p.createdAt) === taipeiMonth(now),
      ).length,
  );
}

export const participationStorageKey = "binsoon-b-flow-1018-v1";
export type Vote = "support" | "oppose";
export type ProposalStatus =
  "collecting" | "village" | "evaluation" | "survey" | "installed" | "declined";
export interface Proposal {
  id: string;
  name: string;
  reason: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  mine: boolean;
  support: number;
  oppose: number;
  vote: Vote | null;
  status: ProposalStatus;
  outcomeReason?: string;
  pendingName?: string;
  approvedName?: string;
  nameStatus?: "pending" | "approved" | "returned";
}
export interface NotificationPreferences {
  full: boolean;
  dumping: boolean;
  dirty: boolean;
}
export const notificationLabels: Record<keyof NotificationPreferences, string> =
  { full: "吃飽了（80% 以上）", dumping: "旁邊有堆放", dirty: "很髒" };
export const defaultNotifications: NotificationPreferences = {
  full: true,
  dumping: true,
  dirty: true,
};
export type AdoptionStatus =
  "pending" | "active" | "rejected" | "withdrawn" | "ended";
export interface Adoption {
  id: string;
  locationId: string;
  role: "居民" | "店家" | "學校" | "社區團體";
  displayName: string;
  intro: string;
  preferences: NotificationPreferences;
  status: AdoptionStatus;
  createdAt: string;
  updatedAt: string;
  reason: string;
}
export const adoptionStatusLabels: Record<AdoptionStatus, string> = {
  pending: "待審",
  active: "認養中",
  rejected: "未通過",
  withdrawn: "已撤回",
  ended: "已結束",
};
export interface ParticipationState {
  proposals: Proposal[];
  adoptions: Adoption[];
  removedBinIds: string[];
}
export function isAdopter(state: ParticipationState, locationId: string) {
  const bin = locations.find((p) => p.id === locationId && p.kind === "bin");
  return Boolean(
    bin &&
    !binDemo(bin, state.removedBinIds).removed &&
    state.adoptions.some(
      (a) => a.locationId === locationId && a.status === "active",
    ),
  );
}
export function adopterName(state: ParticipationState, locationId: string) {
  const bin = locations.find((p) => p.id === locationId && p.kind === "bin");
  if (!bin || binDemo(bin).removed || state.removedBinIds.includes(bin.id))
    return null;
  return (
    state.adoptions.find(
      (a) => a.locationId === locationId && a.status === "active",
    )?.displayName || binDemo(bin).adopter
  );
}
export function canApply(state: ParticipationState, locationId: string) {
  const bin = locations.find((p) => p.id === locationId && p.kind === "bin");
  return Boolean(
    bin &&
    !binDemo(bin).removed &&
    !state.removedBinIds.includes(bin.id) &&
    !adopterName(state, bin.id) &&
    !state.adoptions.some(
      (a) => a.locationId === bin.id && a.status === "pending",
    ),
  );
}
export const proposalStatusLabels: Record<ProposalStatus, string> = {
  collecting: "累積中",
  village: "需里長確認",
  evaluation: "送評估",
  survey: "會勘中",
  installed: "示範已設置",
  declined: "未通過",
};
function initialState(): ParticipationState {
  return {
    adoptions: [],
    removedBinIds: [],
    proposals: [
      {
        id: "xinyi",
        name: "信義路三段 × 新生南路口",
        reason: "日常通行需要隨手垃圾的去處。",
        latitude: 25.033,
        longitude: 121.5358,
        createdAt: "2026-10-18T08:00:00.000Z",
        mine: false,
        support: 46,
        oppose: 3,
        vote: null,
        status: "collecting",
      },
      {
        id: "heping",
        name: "和平東路示範提案",
        reason: "接近門檻的歷史示範提案，支持後可體驗後續評估。",
        latitude: 25.025,
        longitude: 121.54,
        createdAt: "2026-09-01T08:00:00.000Z",
        mine: true,
        support: 35,
        oppose: 24,
        vote: null,
        status: "collecting",
      },
      {
        id: "civic",
        name: "市民大道示範提案",
        reason: "有不同意見的示範提案，可投反對體驗里長確認。",
        latitude: 25.045,
        longitude: 121.55,
        createdAt: "2026-09-01T08:00:00.000Z",
        mine: false,
        support: 35,
        oppose: 24,
        vote: null,
        status: "collecting",
      },
    ],
  };
}
export function voteTotals(proposal: Proposal) {
  const support = proposal.support + Number(proposal.vote === "support");
  const oppose = proposal.oppose + Number(proposal.vote === "oppose");
  const total = support + oppose;
  return {
    support,
    oppose,
    total,
    rate: total ? support / total : null,
    remaining: Math.max(0, 60 - total),
  };
}
export type ParticipationAction =
  | { type: "vote"; id: string; vote: Vote | null }
  | {
      type: "create";
      id: string;
      name: string;
      reason: string;
      point: Point;
      confirmedNearby: boolean;
    }
  | { type: "advance"; id: string; status: ProposalStatus; reason: string }
  | { type: "name"; id: string; name: string }
  | { type: "review-name"; id: string; approve: boolean }
  | {
      type: "apply";
      id: string;
      locationId: string;
      role: Adoption["role"];
      displayName: string;
      intro: string;
      preferences: NotificationPreferences;
    }
  | {
      type: "adoption-status";
      id: string;
      status: AdoptionStatus;
      reason: string;
    }
  | { type: "notifications"; id: string; preferences: NotificationPreferences }
  | { type: "remove-bin"; locationId: string };
function validText(
  value: unknown,
  maximum: number,
  required = true,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximum &&
    (!required || value.trim().length > 0)
  );
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function validPreferences(value: unknown): value is NotificationPreferences {
  if (!value || typeof value !== "object") return false;
  const prefs = value as Record<string, unknown>;
  return [prefs.full, prefs.dumping, prefs.dirty].every(
    (p) => typeof p === "boolean",
  );
}
function validProposal(value: unknown): value is Proposal {
  if (!value || typeof value !== "object") return false;
  const p = value as Proposal;
  return (
    validText(p.id, 200) &&
    validText(p.name, 200) &&
    validText(p.reason, 500) &&
    Number.isFinite(p.latitude) &&
    Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.longitude) <= 180 &&
    typeof p.mine === "boolean" &&
    Number.isSafeInteger(p.support) &&
    p.support >= 0 &&
    Number.isSafeInteger(p.oppose) &&
    p.oppose >= 0 &&
    ["support", "oppose", null].includes(p.vote) &&
    Object.hasOwn(proposalStatusLabels, p.status) &&
    validDate(p.createdAt) &&
    (p.outcomeReason === undefined || validText(p.outcomeReason, 500, false)) &&
    (p.pendingName === undefined || validText(p.pendingName, 30)) &&
    (p.approvedName === undefined || validText(p.approvedName, 30)) &&
    (p.nameStatus === undefined ||
      ["pending", "approved", "returned"].includes(p.nameStatus)) &&
    (p.nameStatus !== "pending" || Boolean(p.pendingName)) &&
    (p.status !== "collecting" || voteTotals(p).total < 60)
  );
}
function validAdoption(value: unknown): value is Adoption {
  if (!value || typeof value !== "object") return false;
  const a = value as Adoption;
  return (
    validText(a.id, 200) &&
    locations.some((p) => p.kind === "bin" && p.id === a.locationId) &&
    ["居民", "店家", "學校", "社區團體"].includes(a.role) &&
    validText(a.displayName, 50) &&
    validText(a.intro, 120, false) &&
    Object.hasOwn(adoptionStatusLabels, a.status) &&
    validPreferences(a.preferences) &&
    validDate(a.createdAt) &&
    validDate(a.updatedAt) &&
    validText(a.reason, 500, false)
  );
}
function readState(): ParticipationState {
  try {
    const value = JSON.parse(
      localStorage.getItem(participationStorageKey) || "null",
    );
    if (
      !value ||
      !Array.isArray(value.proposals) ||
      !value.proposals.every(validProposal)
    )
      return initialState();
    const proposals: Proposal[] = value.proposals;
    const adoptions: unknown = value.adoptions ?? [];
    const removedBinIds: unknown = value.removedBinIds ?? [];
    if (
      !Array.isArray(adoptions) ||
      !adoptions.every(validAdoption) ||
      !Array.isArray(removedBinIds) ||
      !removedBinIds.every((id) =>
        locations.some((p) => p.kind === "bin" && p.id === id),
      )
    )
      return initialState();
    const open = adoptions.filter((a) =>
      ["pending", "active"].includes(a.status),
    );
    if (
      new Set(proposals.map((p) => p.id)).size !== proposals.length ||
      new Set(adoptions.map((a) => a.id)).size !== adoptions.length ||
      new Set(open.map((a) => a.locationId)).size !== open.length
    )
      return initialState();
    return {
      proposals,
      removedBinIds,
      adoptions: adoptions.map((a) =>
        binDemo(
          locations.find((p) => p.id === a.locationId)!,
          removedBinIds,
        ).removed && ["pending", "active"].includes(a.status)
          ? {
              ...a,
              status: "ended",
              reason: "桶已移除（示範）",
              preferences: { full: false, dumping: false, dirty: false },
            }
          : a,
      ),
    };
  } catch {
    /* Browsing remains possible with blocked or stale storage. */
  }
  return initialState();
}
function applyAction(
  state: ParticipationState,
  action: ParticipationAction,
): ParticipationState {
  const now = new Date().toISOString();
  if (action.type === "remove-bin") {
    if (!locations.some((p) => p.id === action.locationId && p.kind === "bin"))
      throw new Error("找不到這個桶。");
    return {
      ...state,
      removedBinIds: [...new Set([...state.removedBinIds, action.locationId])],
      adoptions: state.adoptions.map((a) =>
        a.locationId === action.locationId &&
        ["pending", "active"].includes(a.status)
          ? {
              ...a,
              status: "ended",
              reason: "桶已移除（示範）",
              updatedAt: now,
              preferences: { full: false, dumping: false, dirty: false },
            }
          : a,
      ),
    };
  }
  if (action.type === "apply") {
    if (state.adoptions.some((a) => a.id === action.id)) return state;
    if (!canApply(state, action.locationId))
      throw new Error("這個桶已有人認養、已有待審申請，或已移除。");
    if (
      !action.displayName.trim() ||
      action.displayName.trim().length > 50 ||
      action.intro.length > 120 ||
      !["居民", "店家", "學校", "社區團體"].includes(action.role)
    )
      throw new Error("請確認認養身分與公開名稱（50字內）。");
    return {
      ...state,
      adoptions: [
        ...state.adoptions,
        {
          ...action,
          displayName: action.displayName.trim(),
          intro: action.role === "店家" ? action.intro.trim() : "",
          status: "pending",
          createdAt: now,
          updatedAt: now,
          reason: "",
        },
      ],
    };
  }
  if (action.type === "adoption-status" || action.type === "notifications") {
    if (!state.adoptions.some((a) => a.id === action.id))
      throw new Error("找不到認養申請。");
    return {
      ...state,
      adoptions: state.adoptions.map((a) => {
        if (a.id !== action.id) return a;
        if (action.type === "notifications") {
          if (a.status !== "active")
            throw new Error("核准認養後才能修改通知。");
          return { ...a, preferences: action.preferences, updatedAt: now };
        }
        const allowed: Partial<Record<AdoptionStatus, AdoptionStatus[]>> = {
          pending: ["active", "rejected", "withdrawn"],
          active: ["ended"],
        };
        if (!allowed[a.status]?.includes(action.status))
          throw new Error("這筆申請已處理，請重新申請。");
        if (
          action.status === "active" &&
          (adopterName(state, a.locationId) ||
            state.removedBinIds.includes(a.locationId) ||
            binDemo(locations.find((p) => p.id === a.locationId)!).removed)
        )
          throw new Error("此桶目前無法核准認養。");
        if (action.status === "rejected" && !action.reason.trim())
          throw new Error("請填寫未通過原因。");
        return {
          ...a,
          status: action.status,
          reason: action.reason.trim(),
          updatedAt: now,
          preferences:
            action.status === "ended"
              ? { full: false, dumping: false, dirty: false }
              : a.preferences,
        };
      }),
    };
  }
  if (action.type === "create") {
    if (state.proposals.some((p) => p.id === action.id)) return state;
    if (
      !action.name.trim() ||
      action.name.trim().length > 200 ||
      !action.reason.trim() ||
      action.reason.trim().length > 500
    )
      throw new Error("請填寫位置名稱（200字內）及原因（500字內）。");
    if (!inDemoBounds(action.point))
      throw new Error("請在大安區示範範圍內選點。");
    if (!remainingProposals(state))
      throw new Error("本月已達3個新增提案上限。");
    if (
      !action.confirmedNearby &&
      state.proposals.some((p) => distanceMeters(p, action.point) <= 50)
    )
      throw new Error("請先查看附近提案並確認不同需求。");
    return {
      ...state,
      proposals: [
        ...state.proposals,
        {
          id: action.id,
          name: action.name.trim(),
          reason: action.reason.trim(),
          ...action.point,
          createdAt: new Date().toISOString(),
          mine: true,
          support: 0,
          oppose: 0,
          vote: "support",
          status: "collecting",
        },
      ],
    };
  }
  if (!state.proposals.some((p) => p.id === action.id))
    throw new Error("找不到這個提案；本機資料不會跨裝置同步。");
  return {
    ...state,
    proposals: state.proposals.map((p) => {
      if (p.id !== action.id) return p;
      if (action.type === "name") {
        if (!p.mine || p.status !== "installed" || p.nameStatus === "pending")
          throw new Error("僅原提案者可在示範設置後送出命名。");
        if (!action.name.trim() || action.name.trim().length > 30)
          throw new Error("請填寫30字內的桶名。");
        return { ...p, pendingName: action.name.trim(), nameStatus: "pending" };
      }
      if (action.type === "review-name") {
        if (p.nameStatus !== "pending" || !p.pendingName)
          throw new Error("目前沒有待審命名。");
        return {
          ...p,
          approvedName: action.approve ? p.pendingName : p.approvedName,
          nameStatus: action.approve ? "approved" : "returned",
        };
      }
      if (action.type === "advance") {
        const allowed: Partial<Record<ProposalStatus, ProposalStatus[]>> = {
          village: ["evaluation", "declined"],
          evaluation: ["survey", "declined"],
          survey: ["installed", "declined"],
        };
        if (!allowed[p.status]?.includes(action.status))
          throw new Error("請依評估與會勘順序推進。");
        if (action.status === "declined" && !action.reason.trim())
          throw new Error("請填寫未通過原因。");
        return {
          ...p,
          status: action.status,
          outcomeReason: action.reason.trim(),
        };
      }
      if (p.status !== "collecting")
        throw new Error("這輪投票已結束，不能改票或撤票。");
      const next = { ...p, vote: action.vote };
      const totals = voteTotals(next);
      if (totals.total >= 60)
        next.status = totals.rate! >= 0.6 ? "evaluation" : "village";
      return next;
    }),
  };
}
export function useParticipationStore() {
  const [state, setState] = useState(readState);
  const current = useRef(state);
  const [storageFailed, setStorageFailed] = useState(false);
  function act(action: ParticipationAction, loggedIn: boolean): string | null {
    if (!loggedIn) return "請先登入示範帳號。";
    try {
      const next = applyAction(current.current, action);
      current.current = next;
      setState(next);
      try {
        localStorage.setItem(participationStorageKey, JSON.stringify(next));
      } catch {
        setStorageFailed(true);
      }
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "操作未完成，請再試一次。";
    }
  }
  return { state, act, storageFailed };
}
