import { useEffect, useState } from "react";
import { locations } from "./locations";
import { reportTypes, type DemoReport } from "./reports";
const key = "binsoon-a-flow-v1";
export interface DemoState {
  loggedIn: boolean;
  likes: string[];
  reports: DemoReport[];
  stamps: string[];
  redeemed: boolean;
}
const initialState: DemoState = {
  loggedIn: false,
  likes: [],
  reports: [],
  stamps: [],
  redeemed: false,
};
const binIds = new Set(
  locations.filter((item) => item.kind === "bin").map((item) => item.id),
);
function binList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === "string" && binIds.has(id)) &&
    new Set(value).size === value.length
  );
}
function isReport(value: unknown): value is DemoReport {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.locationId === "string" &&
    binIds.has(item.locationId) &&
    reportTypes.some((type) => type.id === item.type) &&
    typeof item.description === "string" &&
    item.description.length <= 500 &&
    typeof item.createdAt === "string" &&
    Number.isFinite(Date.parse(item.createdAt))
  );
}
function readState(): DemoState {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (
      value &&
      typeof value.loggedIn === "boolean" &&
      typeof value.redeemed === "boolean" &&
      binList(value.likes) &&
      binList(value.stamps) &&
      Array.isArray(value.reports) &&
      value.reports.every(isReport)
    ) {
      const reports: DemoReport[] = value.reports;
      if (
        new Set(reports.map((report) => `${report.locationId}/${report.type}`))
          .size === reports.length
      )
        return {
          loggedIn: value.loggedIn,
          likes: value.likes,
          stamps: value.stamps,
          reports,
          redeemed: value.redeemed,
        };
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
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      setStorageFailed(true);
    }
  }, [state]);
  return { state, setState, storageFailed };
}
export function availablePoints(state: DemoState) {
  return state.redeemed ? 30 : 230;
}
