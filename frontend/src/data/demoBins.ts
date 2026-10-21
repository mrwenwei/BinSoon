import type { ApiLocation, BinStatus, BinView } from "./api";
import { DEMO_STORE_KEY, DEMO_UPDATED, isDemoToken } from "./demoMode";
import type { WasteType } from "./waste";

const levels = [0, 18, 35, 50, 66, 79, 85, 96, 100, null];
const observed = new Date().toISOString();
export const demoBinLocations = new Map<string, ApiLocation>();
let cityLoaded = false;
export const demoCityLoaded = () => cityLoaded;
type ClearReport = {
  bin_id: string;
  waste_type: string;
  type: string;
  work_status: string | null;
  event_id: string;
  event_status: string;
  created_at: string;
};
type ClearSnapshot = {
  reports?: ClearReport[];
  crew_completions?: Record<string, { photo: string; completedAt: string }>;
};
let clearSnapshot: ClearSnapshot | undefined;
window.addEventListener(DEMO_UPDATED, () => {
  clearSnapshot = undefined;
});
window.addEventListener("storage", (event) => {
  if (event.key === DEMO_STORE_KEY || event.key === null)
    clearSnapshot = undefined;
});
function demoClearSnapshot(): ClearSnapshot {
  if (clearSnapshot) return clearSnapshot;
  try {
    clearSnapshot = JSON.parse(localStorage.getItem(DEMO_STORE_KEY) || "{}");
  } catch {
    clearSnapshot = {};
  }
  return clearSnapshot || {};
}
function compartment(
  id: string,
  original: BinStatus,
  waste: WasteType,
  proposed: boolean,
): BinStatus {
  const hash = [...id].reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
  let fill = levels[(hash + (waste === "recycling" ? 3 : 0)) % levels.length];
  let clearedAt: string | undefined;
  try {
    const saved = demoClearSnapshot();
    const reports = Array.isArray(saved.reports) ? saved.reports : [];
    const completed = reports.filter(
      (r: {
        bin_id: string;
        waste_type: string;
        type: string;
        work_status: string | null;
        event_id: string;
      }) =>
        r.bin_id === id &&
        r.waste_type === waste &&
        r.type === "full" &&
        r.work_status === "completed" &&
        saved.crew_completions?.[r.event_id]?.photo,
    );
    clearedAt = completed
      .map(
        (r: { event_id: string }) =>
          saved.crew_completions?.[r.event_id]?.completedAt || "",
      )
      .sort()
      .at(-1);
    if (
      clearedAt &&
      !reports.some(
        (r: {
          bin_id: string;
          waste_type: string;
          event_status: string;
          created_at: string;
        }) =>
          r.bin_id === id &&
          r.waste_type === waste &&
          r.event_status === "open" &&
          r.created_at > clearedAt!,
      )
    )
      fill = 0;
  } catch {
    /* No committed demo clear reading. */
  }
  const operational = original.operational_status || "normal";
  const reasons =
    operational !== "normal"
      ? [operational]
      : proposed
        ? ["not_installed"]
        : fill === null
          ? ["unknown"]
          : fill >= 80
            ? ["full"]
            : [];
  const capacity = original.capacity_liters || (waste === "general" ? 120 : 80);
  return {
    ...original,
    waste_type: waste,
    fill_level_pct: fill,
    fill_status:
      fill === null
        ? "unknown"
        : fill >= 80
          ? "full"
          : fill >= 50
            ? "half"
            : "hungry",
    is_usable: reasons.length === 0,
    unavailable_reasons: reasons,
    capacity_liters: capacity,
    estimated_used_liters:
      fill === null ? null : Math.round((capacity * fill) / 100),
    reading_source_type: "simulated",
    observed_at: fill === null ? null : observed,
    received_at: fill === null ? null : observed,
    last_emptied_at: fill === 0 ? clearedAt || observed : null,
  };
}
export function demoLocation(item: ApiLocation, waste: WasteType): ApiLocation {
  if (item.kind !== "bin" || !item.bin_status) return item;
  const parts = (["general", "recycling"] as const).map((type) =>
    compartment(
      item.id,
      item.compartments?.find((part) => part.waste_type === type) ||
        item.bin_status!,
      type,
      item.placement_status === "proposed",
    ),
  );
  const projected = {
    ...item,
    compartments: parts,
    bin_status: parts.find((part) => part.waste_type === waste)!,
  };
  demoBinLocations.set(item.id, projected);
  return projected;
}
export function demoBinPayload(
  path: string,
  payload: unknown,
  token?: string,
): unknown {
  const url = new URL(path, "http://local");
  const waste: WasteType =
    url.searchParams.get("waste_type") === "recycling"
      ? "recycling"
      : "general";
  if (["/map/locations", "/map/nearest-usable"].includes(url.pathname)) {
    const data = payload as { items: ApiLocation[] };
    if (!Array.isArray(data?.items)) return payload;
    if (
      url.pathname === "/map/locations" &&
      url.searchParams.get("district") === "all" &&
      !url.searchParams.get("q") &&
      (!url.searchParams.get("filter") ||
        url.searchParams.get("filter") === "all")
    ) {
      const page = (payload as { page?: { offset: number; total: number } })
        .page;
      if (page && page.offset + data.items.length >= page.total)
        cityLoaded = true;
    }
    const items = data.items.map((item) => demoLocation(item, waste));
    return {
      ...data,
      items: url.pathname.endsWith("nearest-usable")
        ? items.filter((item) => item.bin_status?.is_usable)
        : items,
    };
  }
  if (/^\/bins\/[^/]+\/view$/.test(url.pathname)) {
    const data = payload as BinView;
    const item = demoLocation(
      {
        ...data.location,
        bin_status: data.status,
        compartments: data.compartments?.length
          ? data.compartments
          : data.location.compartments,
      },
      waste,
    );
    const mayReport =
      isDemoToken(token) &&
      item.placement_status !== "proposed" &&
      item.bin_status?.operational_status === "normal";
    return {
      ...data,
      location: item,
      status: item.bin_status,
      compartments: item.compartments,
      ...(isDemoToken(token)
        ? {
            can_report: mayReport,
            report_block_reason: mayReport ? null : "not_installed",
            can_apply_adoption: mayReport,
            my_adoption_id: null,
            latest_cleanup: null,
          }
        : {}),
    };
  }
  return payload;
}
