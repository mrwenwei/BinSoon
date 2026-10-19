import { usePersistentState } from "./persistentStore";
import { emptyOperations, type OperationalState } from "./workOrders";
import { locations } from "./locations";
import {
  reportAward,
  reportIsFinal,
  reportTypes,
  type DemoReport,
} from "./reports";
import { findReward, type Redemption, type Reward } from "./rewards";

// v1 remains untouched: its stamp album and 230-point rules are not this ledger.
export const legacyDemoStorageKey = "binsoon-a-flow-1018-v2";
export const demoStorageKey = "binsoon-demo-1019-v3";
export interface DemoState extends OperationalState {
  loggedIn: boolean;
  likes: string[];
  reports: DemoReport[];
  redemptions: Redemption[];
}
export const initialState: DemoState = {
  ...emptyOperations(),
  loggedIn: false,
  likes: [],
  reports: [],
  redemptions: [],
};
const binIds = new Set(
  locations.filter((item) => item.kind === "bin").map((item) => item.id),
);
const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
function isReport(value: unknown): value is DemoReport {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.locationId === "string" &&
    binIds.has(item.locationId) &&
    reportTypes.some((type) => type.id === item.type) &&
    typeof item.description === "string" &&
    item.description.length <= 500 &&
    validDate(item.createdAt) &&
    ["pending", "processing", "approved", "rejected"].includes(
      String(item.status),
    ) &&
    typeof item.adopter === "boolean" &&
    typeof item.firstReporter === "boolean" &&
    (item.photo === undefined || typeof item.photo === "boolean") &&
    (item.reporter === undefined ||
      ["member", "fixture"].includes(String(item.reporter))) &&
    (item.rejectionReason === undefined ||
      (typeof item.rejectionReason === "string" &&
        item.rejectionReason.length <= 500)) &&
    (item.eventId === undefined ||
      (typeof item.eventId === "string" && item.eventId.length > 0)) &&
    (item.quick === undefined || typeof item.quick === "boolean") &&
    (item.acceptedAt === undefined || validDate(item.acceptedAt)) &&
    (item.reviewedAt === undefined || validDate(item.reviewedAt)) &&
    (!["approved", "rejected"].includes(String(item.status)) ||
      validDate(item.reviewedAt))
  );
}
function isRedemption(value: unknown): value is Redemption {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const reward =
    typeof item.rewardId === "string" ? findReward(item.rewardId) : undefined;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    Boolean(reward) &&
    item.cost === reward?.cost &&
    validDate(item.createdAt)
  );
}
function readLegacyState(): DemoState {
  try {
    const value = JSON.parse(
      localStorage.getItem(legacyDemoStorageKey) || "null",
    );
    if (
      value &&
      typeof value.loggedIn === "boolean" &&
      Array.isArray(value.likes) &&
      value.likes.every(
        (id: unknown) => typeof id === "string" && binIds.has(id),
      ) &&
      Array.isArray(value.reports) &&
      value.reports.every(isReport) &&
      Array.isArray(value.redemptions) &&
      value.redemptions.every(isRedemption)
    ) {
      const state: DemoState = {
        ...emptyOperations(),
        loggedIn: value.loggedIn,
        likes: [...new Set<string>(value.likes)],
        reports: value.reports.map((report: DemoReport) => ({
          ...report,
          eventId: report.eventId || report.id,
        })),
        redemptions: value.redemptions,
      };
      if (
        new Set(
          state.reports
            .filter((report) => !reportIsFinal(report))
            .map((report) => `${report.locationId}/${report.type}`),
        ).size ===
          state.reports.filter((report) => !reportIsFinal(report)).length &&
        new Set(state.reports.map((report) => report.id)).size ===
          state.reports.length &&
        new Set(state.redemptions.map((item) => item.id)).size ===
          state.redemptions.length &&
        availablePoints(state) >= 0 &&
        state.redemptions.every(
          (item) => rewardStock(state, findReward(item.rewardId)!) >= 0,
        )
      )
        return state;
    }
  } catch {
    /* Blocked or stale storage must not prevent browsing. */
  }
  if (localStorage.getItem(legacyDemoStorageKey) !== null)
    throw new Error("舊帳本格式無法載入；來源已保留，未覆寫。");
  return initialState;
}
export function loadDemoState(): DemoState {
  const raw = localStorage.getItem(demoStorageKey);
  if (raw !== null) {
    const value = JSON.parse(raw) as DemoState;
    if (
      !value ||
      !Array.isArray(value.tasks) ||
      !Array.isArray(value.reports) ||
      !value.reports.every(isReport) ||
      !Array.isArray(value.redemptions) ||
      !value.redemptions.every(isRedemption) ||
      !Array.isArray(value.likes) ||
      !Array.isArray(value.completionLikes) ||
      typeof value.staffLoggedIn !== "boolean" ||
      typeof value.initialized !== "boolean" ||
      !value.readings ||
      typeof value.loggedIn !== "boolean"
    )
      throw new Error("本機紀錄版本無法載入；來源已保留。");
    const validTasks = value.tasks.every(
      (t) =>
        t &&
        binIds.has(t.locationId) &&
        locations.find((p) => p.id === t.locationId)?.district === "大安區" &&
        typeof t.id === "string" &&
        t.id.length > 0 &&
        reportTypes.some((type) => type.id === t.type) &&
        ["citizen", "sensor", "inspection"].includes(t.source) &&
        [
          "pending",
          "processing",
          "arrived",
          "waiting_sensor",
          "repair",
          "completed",
          "dismissed",
        ].includes(t.status) &&
        validDate(t.createdAt) &&
        [
          t.acceptedAt,
          t.arrivedAt,
          t.photoAt,
          t.submittedAt,
          t.completedAt,
        ].every((date) => date === undefined || validDate(date)) &&
        (!["completed", "dismissed"].includes(t.status) ||
          (validDate(t.completedAt) && validDate(t.photoAt))) &&
        (t.reason === undefined ||
          (typeof t.reason === "string" && t.reason.length <= 500)),
    );
    const validReadings =
      !Array.isArray(value.readings) &&
      Object.entries(value.readings).every(
        ([id, r]) =>
          binIds.has(id) &&
          r &&
          typeof r.id === "string" &&
          r.source === "demo" &&
          validDate(r.observedAt) &&
          validDate(r.receivedAt) &&
          (r.capacity === null ||
            (Number.isFinite(r.capacity) &&
              r.capacity >= 0 &&
              r.capacity <= 100)) &&
          value.tasks.some((t) => t.id === r.taskId && t.locationId === id),
      );
    if (
      !validTasks ||
      !validReadings ||
      !value.likes.every((id) => binIds.has(id)) ||
      !value.completionLikes.every((id) =>
        value.tasks.some((t) => t.id === id && t.status === "completed"),
      ) ||
      new Set(value.tasks.map((t) => t.id)).size !== value.tasks.length ||
      new Set(value.reports.map((r) => r.id)).size !== value.reports.length ||
      new Set(value.redemptions.map((r) => r.id)).size !==
        value.redemptions.length ||
      new Set(value.completionLikes).size !== value.completionLikes.length ||
      availablePoints(value) < 0 ||
      value.redemptions.some(
        (item) => rewardStock(value, findReward(item.rewardId)!) < 0,
      )
    )
      throw new Error("本機事件紀錄無法驗證；來源已保留。");
    return value;
  }
  const legacy = readLegacyState();
  return {
    ...legacy,
    tasks: legacy.reports
      .filter(
        (r) =>
          !reportIsFinal(r) &&
          locations.find((p) => p.id === r.locationId)?.district === "大安區",
      )
      .map((r) => ({
        id: r.eventId || r.id,
        locationId: r.locationId,
        type: r.type,
        source: "citizen" as const,
        status:
          r.status === "processing"
            ? ("processing" as const)
            : ("pending" as const),
        createdAt: r.createdAt,
        acceptedAt: r.acceptedAt,
      })),
  };
}
export function useDemoStore() {
  const store = usePersistentState(demoStorageKey, loadDemoState);
  return {
    state: store.state || initialState,
    setState: store.setState,
    storageFailed: Boolean(store.failure),
    storageError: store.failure,
  };
}
export function cumulativePoints(state: DemoState) {
  return (
    63 +
    state.reports
      .filter(
        (report) =>
          report.status === "approved" && report.reporter !== "fixture",
      )
      .reduce((sum, report) => sum + reportAward(report), 0)
  );
}
export function availablePoints(state: DemoState) {
  return (
    cumulativePoints(state) -
    state.redemptions.reduce((sum, item) => sum + item.cost, 0)
  );
}
export function rejectedCount(state: DemoState) {
  return state.reports.filter(
    (report) => report.status === "rejected" && report.reporter !== "fixture",
  ).length;
}
export function reportingSuspended(state: DemoState) {
  return rejectedCount(state) >= 3;
}
export function rewardStock(state: DemoState, reward: Reward) {
  return (
    reward.stock -
    state.redemptions.filter((item) => item.rewardId === reward.id).length
  );
}
export function redeemReward(state: DemoState, item: Redemption): DemoState {
  const reward = findReward(item.rewardId);
  if (
    !state.loggedIn ||
    !reward ||
    item.cost !== reward.cost ||
    availablePoints(state) < reward.cost ||
    rewardStock(state, reward) <= 0 ||
    state.redemptions.some((order) => order.id === item.id)
  )
    return state;
  return { ...state, redemptions: [...state.redemptions, item] };
}
export const memberTiers = [
  { name: "見習生", threshold: 0, symbol: "芽" },
  { name: "新手", threshold: 10, symbol: "新" },
  { name: "獨當一面", threshold: 50, symbol: "獨" },
  { name: "高手", threshold: 150, symbol: "高" },
  { name: "專家", threshold: 500, symbol: "專" },
  { name: "教授", threshold: 1000, symbol: "授" },
] as const;
export function memberLevel(points: number) {
  const index =
    memberTiers.filter((tier) => points >= tier.threshold).length - 1;
  return { current: memberTiers[index], next: memberTiers[index + 1] };
}
