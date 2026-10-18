import { useEffect, useState } from "react";
import { locations } from "./locations";
import {
  reportAward,
  reportIsFinal,
  reportTypes,
  type DemoReport,
  type ReportStatus,
} from "./reports";
import { findReward, type Redemption, type Reward } from "./rewards";

// v1 remains untouched: its stamp album and 230-point rules are not this ledger.
export const demoStorageKey = "binsoon-a-flow-1018-v2";
export interface DemoState {
  loggedIn: boolean;
  likes: string[];
  reports: DemoReport[];
  redemptions: Redemption[];
}
const initialState: DemoState = {
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
function readState(): DemoState {
  try {
    const value = JSON.parse(localStorage.getItem(demoStorageKey) || "null");
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
        loggedIn: value.loggedIn,
        likes: [...new Set<string>(value.likes)],
        reports: value.reports,
        redemptions: value.redemptions,
      };
      if (
        new Set(
          state.reports.map((report) => `${report.locationId}/${report.type}`),
        ).size === state.reports.length &&
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
  return initialState;
}
export function useDemoStore() {
  const [state, setState] = useState(readState);
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(demoStorageKey, JSON.stringify(state));
    } catch {
      setStorageFailed(true);
    }
  }, [state]);
  return { state, setState, storageFailed };
}
export function cumulativePoints(state: DemoState) {
  return (
    63 +
    state.reports
      .filter((report) => report.status === "approved")
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
  return state.reports.filter((report) => report.status === "rejected").length;
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
export function reviewReport(
  state: DemoState,
  id: string,
  status: ReportStatus,
): DemoState {
  if (!state.loggedIn) return state;
  return {
    ...state,
    reports: state.reports.map((report) => {
      if (report.id !== id || reportIsFinal(report)) return report;
      const now = new Date().toISOString();
      return {
        ...report,
        status,
        ...(status !== "pending"
          ? { acceptedAt: report.acceptedAt || now }
          : {}),
        ...(status === "approved" || status === "rejected"
          ? { reviewedAt: now }
          : {}),
      };
    }),
  };
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
