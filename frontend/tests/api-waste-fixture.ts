import {
  apiFixture,
  binId,
  location,
  status,
  report,
  workId,
  reportId,
  arrivedWork,
} from "./api-fixtures";
import { type Page } from "@playwright/test";
export const wasteCompletion = {
  general: "60000000-0000-4000-8000-000000000011",
  recycling: "60000000-0000-4000-8000-000000000012",
};
export function wasteFixture() {
  const requests: {
    path: string;
    offset?: string | null;
    waste: string | null;
    method: string;
    body: any;
    key?: string;
    etag?: string;
  }[] = [];
  const state = {
    multiPage: false,
    expireReport: false,
    delayRecycling: 0,
    repairRecycling: false,
    likedGeneral: false,
    likedRecycling: false,
    abortReport: false,
    abortLike: false,
    reportWaste: "recycling",
    workWaste: "recycling",
    workVersion: 3,
    cleared: false,
  };
  function compartment(waste = "general") {
    const repair = waste === "recycling" && state.repairRecycling;
    const fill = waste === "general" ? 95 : state.cleared ? 0 : 20;
    return {
      ...status,
      waste_type: waste,
      classification_source:
        waste === "general" ? "legacy_assumed_general" : "demo_assumption",
      fill_level_pct: fill,
      fill_status: repair ? "unknown" : waste === "general" ? "full" : "hungry",
      is_usable: waste === "recycling" && !repair,
      operational_status: repair ? "repair" : "normal",
      unavailable_reasons: repair
        ? ["repair"]
        : waste === "general"
          ? ["full"]
          : [],
    };
  }
  const compartments = () => [compartment(), compartment("recycling")];
  const loc = (waste = "general") => ({
    ...location,
    label: "雙槽測試桶",
    bin_status: compartment(waste),
    compartments: compartments(),
  });
  const work = () => ({
    ...arrivedWork,
    waste_type: state.workWaste,
    classification_source: "demo_assumption",
    version: state.workVersion,
    photo_at: null,
    submitted_at: null,
    completed_at: null,
    clear_reading_id: state.cleared
      ? "70000000-0000-4000-8000-000000000001"
      : null,
    completion_id: null,
  });
  const reportView = (waste = state.reportWaste) => ({
    ...report,
    waste_type: waste,
    classification_source: "demo_assumption",
    photo_ids: [],
  });
  const replay = new Map<string, unknown>();
  async function setup(page: Page) {
    await apiFixture(page, async (route, path) => {
      const req = route.request(),
        url = new URL(req.url()),
        waste = url.searchParams.get("waste_type"),
        selected = waste || "general";
      const entry = {
        path,
        offset: url.searchParams.get("offset"),
        waste,
        method: req.method(),
        body:
          req.method() === "POST" && path !== "/media"
            ? req.postDataJSON()
            : null,
        key: req.headers()["idempotency-key"],
        etag: req.headers()["if-match"],
      };
      requests.push(entry);
      if (req.method() === "GET") {
        if (path === "/map/locations") {
          await route.fulfill({
            json: {
              items: [
                state.multiPage && Number(url.searchParams.get("offset")) > 0
                  ? {
                      ...loc(selected),
                      id: "10000000-0000-4000-8000-000000000002",
                      label: "另一個位置",
                    }
                  : loc(selected),
              ],
              page: {
                limit: 100,
                offset: Number(url.searchParams.get("offset")),
                total: state.multiPage ? 2 : 1,
              },
            },
          });
          return true;
        }
        if (path === "/map/nearest-usable") {
          await route.fulfill({
            json: {
              items: compartment(selected).is_usable ? [loc(selected)] : [],
            },
          });
          return true;
        }
        if (path === `/bins/${binId}/view`) {
          if (selected === "recycling" && state.delayRecycling)
            await new Promise((resolve) =>
              setTimeout(resolve, state.delayRecycling),
            );
          const liked =
            selected === "general" ? state.likedGeneral : state.likedRecycling;
          await route.fulfill({
            json: {
              location: loc(selected),
              status: compartment(selected),
              compartments: compartments(),
              adopter: null,
              latest_cleanup: {
                id: wasteCompletion[selected as "general" | "recycling"],
                bin_id: binId,
                work_order_id: workId,
                waste_type: selected,
                classification_source: "demo_assumption",
                completed_at: "2026-10-19T08:00:00Z",
                like_count: liked ? 1 : 0,
                liked_by_me: liked,
                can_like: !liked && Boolean(req.headers().authorization),
              },
              can_report: Boolean(req.headers().authorization),
              report_block_reason: req.headers().authorization
                ? null
                : "login_required",
              my_adoption_id: null,
              can_apply_adoption: false,
            },
          });
          return true;
        }
        if (path === `/bins/${binId}/history`) {
          await route.fulfill({
            json: [
              {
                id: "70000000-0000-4000-8000-000000000002",
                recorded_at: "2026-01-05T08:00:00Z",
                fill_level_pct:
                  selected === "legacy_unknown"
                    ? 73
                    : selected === "general"
                      ? 95
                      : 20,
                event_type: "measurement",
                source_type: "simulated",
                generation: 0,
                waste_type: selected === "legacy_unknown" ? null : selected,
                classification_source:
                  selected === "legacy_unknown"
                    ? "legacy_unclassified"
                    : "demo_assumption",
              },
            ],
          });
          return true;
        }
        if (path === `/reports/${reportId}`) {
          await route.fulfill({ json: reportView() });
          return true;
        }
        if (path === "/me/reports") {
          await route.fulfill({
            json: {
              items: [
                reportView("general"),
                {
                  ...reportView("recycling"),
                  id: "20000000-0000-4000-8000-000000000002",
                },
              ].filter((r) => !waste || r.waste_type === waste),
              page: { limit: 20, offset: 0, total: waste ? 1 : 2 },
            },
          });
          return true;
        }
        if (path === "/staff/work-orders") {
          await route.fulfill({
            json: {
              items: [
                {
                  ...work(),
                  id: "30000000-0000-4000-8000-000000000002",
                  waste_type: "general",
                  classification_source: "legacy_assumed_general",
                },
                { ...work(), waste_type: "recycling" },
              ].filter((w) => !waste || w.waste_type === waste),
              page: { limit: 20, offset: 0, total: waste ? 1 : 2 },
            },
          });
          return true;
        }
        if (
          path === `/staff/work-orders/${workId}` ||
          path === `/admin/work-orders/${workId}`
        ) {
          await route.fulfill({
            headers: { ETag: `"v${state.workVersion}"` },
            json: {
              work_order: work(),
              location: loc(state.workWaste),
              reports: [reportView(state.workWaste)],
              evidence: [],
              latest_reading: state.cleared
                ? {
                    id: work().clear_reading_id,
                    bin_id: binId,
                    work_order_id: workId,
                    waste_type: state.workWaste,
                    classification_source: "demo_assumption",
                    fill_level_pct: 0,
                    source_type: "simulated",
                    event_type: "collection",
                    observed_at: "2026-10-19T08:00:00Z",
                    received_at: "2026-10-19T08:00:00Z",
                  }
                : null,
              completion_requirements: {
                arrived: true,
                reports_reviewed: false,
                completion_photo: false,
                work_submitted: false,
                fresh_clear_reading: state.cleared,
                missing: [
                  "reports_reviewed",
                  "completion_photo",
                  "work_submitted",
                ],
              },
            },
          });
          return true;
        }
      }
      if (req.method() === "POST" && path === "/media") {
        await route.fulfill({
          status: 201,
          json: {
            id: "50000000-0000-4000-8000-000000000001",
            purpose: "report",
          },
        });
        return true;
      }
      if (req.method() === "POST" && path === "/reports") {
        if (state.expireReport) {
          state.expireReport = false;
          await route.fulfill({
            status: 401,
            json: {
              detail: {
                code: "SESSION_EXPIRED",
                message: "登入逾時",
                fields: [],
              },
            },
          });
          return true;
        }
        if (replay.has(entry.key!)) {
          await route.fulfill({ json: replay.get(entry.key!) });
          return true;
        }
        state.reportWaste = entry.body.waste_type;
        const data = reportView();
        replay.set(entry.key!, data);
        if (state.abortReport) {
          state.abortReport = false;
          await route.abort("failed");
        } else await route.fulfill({ status: 201, json: data });
        return true;
      }
      if (req.method() === "POST" && path.startsWith("/completions/")) {
        const isGeneral = path.includes(wasteCompletion.general);
        if (isGeneral) state.likedGeneral = true;
        else state.likedRecycling = true;
        if (state.abortLike) {
          state.abortLike = false;
          await route.abort("failed");
        } else await route.fulfill({ json: {} });
        return true;
      }
      if (
        req.method() === "POST" &&
        path === `/admin/work-orders/${workId}/demo-clear`
      ) {
        state.cleared = true;
        state.workVersion++;
        await route.fulfill({ json: { work_order: work() } });
        return true;
      }
    });
  }
  return { state, requests, setup };
}
