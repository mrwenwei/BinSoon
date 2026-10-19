import { expect, type Page } from "@playwright/test";
import {
  apiFixture,
  arrivedWork,
  binId,
  workId,
  reportId,
  report,
  location,
  status,
} from "./api-fixtures";
import {
  photoFile,
  completionMediaId,
  completionId,
} from "./api-completion-fixture";
export function resolutionFixture(type = "dirty") {
  const state = {
    type,
    version: 3,
    workStatus: "arrived",
    assigned: "staff-uuid",
    arrived: true,
    reviewed: true,
    rejected: false,
    completion: false,
    site: false,
    submitted: false,
    reason: null as string | null,
    otherBroken: false,
    otherOpen: true,
    fill: 40,
    abortNext: "",
    conflictNext: "",
    expireNext: "",
    failReads: false,
  };
  const requests: {
    path: string;
    body: any;
    key?: string;
    etag?: string;
    token: string;
  }[] = [];
  const uploads: string[] = [];
  const media = {
    completion: completionMediaId,
    site: "50000000-0000-4000-8000-000000000003",
  };
  const work = () => ({
    ...arrivedWork,
    type: state.type,
    version: state.version,
    status: state.workStatus,
    assigned_staff_id: state.assigned,
    arrived_at: state.arrived ? report.created_at : null,
    photo_at: state.completion ? "2026-10-19T08:05:00Z" : null,
    submitted_at: state.submitted ? "2026-10-19T08:06:00Z" : null,
    completed_at: ["completed", "dismissed"].includes(state.workStatus)
      ? "2026-10-19T08:06:00Z"
      : null,
    completion_id: state.workStatus === "completed" ? completionId : null,
    clear_reading_id: null,
    reason: state.reason,
  });
  const binStatus = () => {
    const repair =
      state.otherBroken ||
      (state.type === "broken" &&
        state.arrived &&
        !["completed", "dismissed"].includes(state.workStatus));
    return {
      ...status,
      fill_level_pct: state.fill,
      fill_status: repair ? "unknown" : state.fill >= 80 ? "full" : "hungry",
      operational_status: repair ? "repair" : "normal",
      is_usable: !repair && state.fill < 80,
      unavailable_reasons: repair
        ? ["repair"]
        : state.fill >= 80
          ? ["full"]
          : [],
    };
  };
  const bin = () => ({
    ...location,
    label: "現場處理測試桶",
    bin_status: binStatus(),
  });
  const reportView = () => ({
    ...report,
    type: state.type,
    photo_ids: [],
    status: state.reviewed
      ? state.rejected
        ? "rejected"
        : "approved"
      : "processing",
    rejection_reason: state.rejected ? "照片描述與現場不符" : null,
    pending_points: state.reviewed ? 0 : 1,
    awarded_points: state.reviewed && !state.rejected ? 1 : 0,
    settled_at: state.reviewed ? report.created_at : null,
    work_status: state.workStatus,
    event_status: ["completed", "dismissed"].includes(state.workStatus)
      ? "closed"
      : "open",
  });
  const detail = () => ({
    work_order: work(),
    location: bin(),
    reports: [reportView()],
    evidence: (["completion", "site"] as const)
      .filter((p) => state[p])
      .map((p, i) => ({
        id: `80000000-0000-4000-8000-00000000000${i + 1}`,
        media_id: media[p],
        purpose: p,
        created_at: "2026-10-19T08:05:00Z",
      })),
    latest_reading: null,
    completion_requirements: {
      arrived: state.arrived,
      reports_reviewed: state.reviewed,
      completion_photo: state.completion,
      work_submitted: state.submitted,
      fresh_clear_reading: false,
      missing:
        state.workStatus === "dismissed"
          ? []
          : [
              ...(!state.arrived ? ["arrived"] : []),
              ...(!state.reviewed ? ["reports_reviewed"] : []),
              ...(!state.completion ? ["completion_photo"] : []),
              ...(!state.submitted ? ["work_submitted"] : []),
            ],
    },
  });
  const replay = new Map<string, unknown>();
  async function setup(page: Page) {
    await apiFixture(page, async (route, path) => {
      const req = route.request();
      const token = req.headers().authorization || "";
      const staffPath = `/staff/work-orders/${workId}`;
      if (req.method() === "GET") {
        if (path === staffPath) {
          if (state.failReads) {
            await route.fulfill({
              status: 503,
              json: {
                detail: {
                  code: "UNAVAILABLE",
                  message: "工單更新失敗",
                  fields: [],
                },
              },
            });
            return true;
          }
          expect(token).toContain("staff");
          await route.fulfill({
            headers: { ETag: `"v${state.version}"` },
            json: detail(),
          });
          return true;
        }
        if (path === `/reports/${reportId}`) {
          await route.fulfill({ json: reportView() });
          return true;
        }
        if (path === `/bins/${binId}/view`) {
          await route.fulfill({
            json: {
              location: bin(),
              status: binStatus(),
              adopter: null,
              latest_cleanup:
                state.workStatus === "completed" &&
                ["dirty", "dumping"].includes(state.type)
                  ? {
                      id: completionId,
                      bin_id: binId,
                      work_order_id: workId,
                      completed_at: work().completed_at,
                      like_count: 0,
                      liked_by_me: false,
                      can_like: token.includes("citizen"),
                    }
                  : null,
              can_report: token.includes("citizen"),
              report_block_reason: null,
              my_adoption_id: null,
              can_apply_adoption: false,
            },
          });
          return true;
        }
        if (path === "/map/nearest-usable") {
          await route.fulfill({
            json: { items: binStatus().is_usable ? [bin()] : [] },
          });
          return true;
        }
        if (path === "/map/locations") {
          await route.fulfill({
            json: { items: [bin()], page: { limit: 100, offset: 0, total: 1 } },
          });
          return true;
        }
        if (
          path === `/staff/work-orders/30000000-0000-4000-8000-000000000002`
        ) {
          await route.fulfill({
            json: {
              ...detail(),
              work_order: {
                ...work(),
                id: "30000000-0000-4000-8000-000000000002",
                event_id: "40000000-0000-4000-8000-000000000002",
                type: "dumping",
                completion_id: null,
                submitted_at: null,
                completed_at: null,
                photo_at: null,
                status: state.otherOpen ? "arrived" : "completed",
              },
            },
          });
          return true;
        }
      }
      if (req.method() === "POST" && path === "/media") {
        expect(token).toContain("staff");
        expect(req.postDataBuffer()?.includes(photoFile.buffer)).toBe(true);
        const purpose = req.postData()?.includes("\r\nsite\r\n")
          ? "site"
          : "completion";
        uploads.push(purpose);
        await route.fulfill({
          status: 201,
          json: { id: media[purpose], purpose },
        });
        return true;
      }
      if (req.method() !== "POST" || !path.startsWith(staffPath + "/")) return;
      const body = req.postDataJSON(),
        key = req.headers()["idempotency-key"],
        etag = req.headers()["if-match"];
      requests.push({ path, body, key, etag, token });
      expect(token).toContain("staff");
      expect(key).toMatch(/^[0-9a-f-]{36}$/);
      const error = async (status: number, message: string) =>
        route.fulfill({
          status,
          json: {
            detail: {
              code: status === 412 ? "VERSION_CONFLICT" : "EVIDENCE_REQUIRED",
              message,
              fields: [],
            },
          },
        });
      if (state.expireNext && path.endsWith(state.expireNext)) {
        state.expireNext = "";
        await error(401, "Session 已失效");
        return true;
      }
      if (replay.has(`${path}/${key}`)) {
        await route.fulfill({ json: replay.get(`${path}/${key}`) });
        return true;
      }
      expect(etag).toBe(`"v${state.version}"`);
      if (state.conflictNext && path.endsWith(state.conflictNext)) {
        state.conflictNext = "";
        state.version++;
        await error(412, "工單版本已更新");
        return true;
      }
      if (path.endsWith("/evidence")) {
        const p = body.purpose as "completion" | "site";
        expect(body.media_id).toBe(media[p]);
        state[p] = true;
      } else if (path.endsWith("/defer-repair")) {
        expect(state.type).toBe("broken");
        expect(body.reason.trim()).not.toBe("");
        state.reason = body.reason;
        state.workStatus = "repair";
      } else if (path.endsWith("/finish") || path.endsWith("/dismiss")) {
        const dismiss = path.endsWith("/dismiss");
        if (!state.reviewed || !(dismiss ? state.site : state.completion)) {
          await error(409, "請先完成全部查證與證據");
          return true;
        }
        if (dismiss) expect(body.reason.trim()).not.toBe("");
        state.reason = body.reason ?? null;
        state.submitted = !dismiss;
        state.workStatus = dismiss ? "dismissed" : "completed";
      } else if (path.endsWith("/review")) {
        state.reviewed = true;
        state.rejected = body.decision === "rejected";
      } else throw new Error(`Unexpected resolution command ${path}`);
      state.version++;
      const result = path.endsWith("/evidence")
        ? detail()
        : path.endsWith("/review")
          ? { report: reportView(), work_order: work() }
          : work();
      replay.set(`${path}/${key}`, result);
      if (state.abortNext && path.endsWith(state.abortNext)) {
        state.abortNext = "";
        await route.abort("failed");
      } else
        await route.fulfill({
          headers: { ETag: `"v${state.version}"` },
          json: result,
        });
      return true;
    });
  }
  return { state, requests, uploads, setup };
}
