import { expect, type Page } from "@playwright/test";
import {
  apiFixture,
  arrivedWork,
  binId,
  eventId,
  location,
  report,
  reportId,
  status,
  workId,
} from "./api-fixtures";

export const completionId = "60000000-0000-4000-8000-000000000001";
export const completionMediaId = "50000000-0000-4000-8000-000000000002";
export const photoFile = {
  name: "completion.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMwTnMBAAGtAN6NqpJ+AAAAAElFTkSuQmCC",
    "base64",
  ),
};
export function completionFixture() {
  const state = {
    readingId: "",
    version: 3,
    evidence: false,
    submitted: false,
    cleared: false,
    completed: false,
    reviewed: true,
    liked: false,
    completionId,
    clearCount: 0,
    finishCount: 0,
    evidenceCount: 0,
    likeCount: 0,
    expireNext: "",
    abortNext: "",
    conflictNext: "",
    failReads: false,
  };
  const requests: {
    path: string;
    key?: string;
    etag?: string;
    body: unknown;
    token: string;
  }[] = [];
  const replay = new Map<string, { body: unknown; etag: string }>();
  const work = () => ({
    ...arrivedWork,
    version: state.version,
    status: state.completed
      ? "completed"
      : state.submitted
        ? "waiting_sensor"
        : "arrived",
    completion_id: state.completed ? state.completionId : null,
    completed_at: state.completed ? "2026-10-19T08:10:00Z" : null,
    submitted_at: state.submitted ? "2026-10-19T08:08:00Z" : null,
    photo_at: state.evidence ? "2026-10-19T08:05:00Z" : null,
    clear_reading_id: state.cleared ? state.readingId : null,
  });
  const reading = () => ({
    id: work().clear_reading_id,
    bin_id: binId,
    work_order_id: workId,
    fill_level_pct: 0,
    observed_at: "2026-10-19T08:09:00Z",
    received_at: "2026-10-19T08:09:00Z",
    source_type: "simulated",
    event_type: "collection",
  });
  const binStatus = () => ({
    ...status,
    fill_level_pct: state.cleared ? 0 : 90,
    fill_status: state.cleared ? "hungry" : "full",
    is_usable: state.cleared,
    unavailable_reasons: state.cleared ? [] : ["full"],
  });
  const binLocation = () => ({
    ...location,
    label: "滿桶流程測試桶",
    bin_status: binStatus(),
  });
  const reportView = () => ({
    ...report,
    photo_ids: [],
    first_reporter: true,
    status: state.reviewed ? "approved" : "processing",
    pending_points: state.reviewed ? 0 : 1,
    awarded_points: state.reviewed ? 1 : 0,
    work_status: work().status,
    event_status: state.completed ? "closed" : "open",
  });
  const detail = () => ({
    work_order: work(),
    location: binLocation(),
    reports: [reportView()],
    evidence: state.evidence
      ? [
          {
            id: "evidence-uuid",
            media_id: completionMediaId,
            purpose: "completion",
            created_at: "2026-10-19T08:05:00Z",
          },
        ]
      : [],
    latest_reading: state.cleared ? reading() : null,
    completion_requirements: {
      arrived: true,
      reports_reviewed: state.reviewed,
      completion_photo: state.evidence,
      work_submitted: state.submitted,
      fresh_clear_reading: state.cleared,
      missing: [
        ...(state.reviewed ? [] : ["reports_reviewed"]),
        ...(state.evidence ? [] : ["completion_photo"]),
        ...(state.submitted ? [] : ["work_submitted"]),
        ...(state.cleared ? [] : ["fresh_clear_reading"]),
      ],
    },
  });
  const cleanup = () => ({
    id: state.completionId,
    bin_id: binId,
    work_order_id: workId,
    completed_at: "2026-10-19T08:10:00Z",
    like_count: state.likeCount,
    liked_by_me: state.liked,
    can_like: !state.liked,
  });
  async function setup(page: Page) {
    await apiFixture(page, async (route, path) => {
      const req = route.request(),
        token = req.headers().authorization || "";
      const staffPath = `/staff/work-orders/${workId}`,
        adminPath = `/admin/work-orders/${workId}`;
      if (req.method() === "GET") {
        if ([staffPath, adminPath].includes(path)) {
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
          expect(token).toContain(
            path.startsWith("/admin") ? "admin" : "staff",
          );
          await route.fulfill({
            headers: { ETag: `"v${state.version}"` },
            json: detail(),
          });
          return true;
        }
        if (path === `/bins/${binId}/view`) {
          await route.fulfill({
            json: {
              location: binLocation(),
              status: binStatus(),
              adopter: null,
              latest_cleanup: state.completed
                ? {
                    ...cleanup(),
                    can_like: token.includes("citizen") && !state.liked,
                  }
                : null,
              can_report: token.includes("citizen"),
              report_block_reason: token ? null : "login_required",
              my_adoption_id: null,
              can_apply_adoption: false,
            },
          });
          return true;
        }
        if (path === "/map/locations") {
          await route.fulfill({
            json: {
              items: [binLocation()],
              page: { limit: 100, offset: 0, total: 1 },
            },
          });
          return true;
        }
        if (path === "/map/nearest-usable") {
          await route.fulfill({
            json: { items: state.cleared ? [binLocation()] : [] },
          });
          return true;
        }
        if (path.endsWith("/history")) {
          await route.fulfill({
            json: state.cleared
              ? [
                  {
                    id: "clear-reading",
                    recorded_at: "2026-01-05T08:00:00Z",
                    fill_level_pct: 0,
                    event_type: "collection",
                    source_type: "simulated",
                    generation: 0,
                  },
                ]
              : [],
          });
          return true;
        }
        if (path === `/reports/${reportId}`) {
          await route.fulfill({ json: reportView() });
          return true;
        }
      }
      if (path === "/media" && req.method() === "POST") {
        expect(token).toContain("staff");
        expect(req.postDataBuffer()?.includes(photoFile.buffer)).toBe(true);
        expect(req.postData()).toContain("completion");
        await route.fulfill({
          status: 201,
          json: { id: completionMediaId, purpose: "completion" },
        });
        return true;
      }
      if (
        req.method() !== "POST" ||
        !(
          path.startsWith(staffPath + "/") ||
          path === adminPath + "/demo-clear" ||
          path.startsWith("/completions/")
        )
      )
        return;
      const body = req.postDataJSON(),
        key = req.headers()["idempotency-key"];
      requests.push({
        path,
        key,
        etag: req.headers()["if-match"],
        body,
        token,
      });
      expect(key).toMatch(/^[0-9a-f-]{36}$/);
      if (state.expireNext && path.endsWith(state.expireNext)) {
        state.expireNext = "";
        await route.fulfill({
          status: 401,
          json: {
            detail: {
              code: "UNAUTHENTICATED",
              message: "Session 已失效",
              fields: [],
            },
          },
        });
        return true;
      }
      const old = replay.get(`${path}/${key}`);
      if (old) {
        await route.fulfill({
          headers: { ETag: old.etag, "Idempotency-Replayed": "true" },
          json: old.body,
        });
        return true;
      }
      if (!path.startsWith("/completions/"))
        expect(req.headers()["if-match"]).toBe(`"v${state.version}"`);
      if (state.conflictNext && path.endsWith(state.conflictNext)) {
        state.conflictNext = "";
        state.version++;
        await route.fulfill({
          status: 412,
          json: {
            detail: {
              code: "VERSION_CONFLICT",
              message: "工單版本已更新",
              fields: [],
            },
          },
        });
        return true;
      }
      let result: unknown;
      if (path.endsWith("/evidence")) {
        expect(token).toContain("staff");
        expect(body).toEqual({
          media_id: completionMediaId,
          purpose: "completion",
        });
        state.evidence = true;
        state.evidenceCount++;
        state.version++;
        result = detail();
      } else if (path.endsWith("/finish")) {
        expect(token).toContain("staff");
        if (!state.evidence || !state.reviewed) {
          await route.fulfill({
            status: 409,
            json: {
              detail: {
                code: "EVIDENCE_REQUIRED",
                message: "請先完成全部查證與證據",
                fields: [],
              },
            },
          });
          return true;
        }
        state.submitted = true;
        state.finishCount++;
        state.completed = state.cleared;
        state.version++;
        result = work();
      } else if (path.endsWith("/demo-clear")) {
        expect(token).toContain("admin");
        expect(body.reading_id).toMatch(/^[0-9a-f-]{36}$/);
        state.readingId = body.reading_id;
        state.clearCount++;
        state.cleared = true;
        state.completed = state.submitted && state.reviewed && state.evidence;
        state.version++;
        result = { reading: reading(), work_order: work() };
      } else {
        expect(token).toContain("citizen");
        expect(body).toEqual({});
        if (
          !state.completed ||
          path !== `/completions/${state.completionId}/like`
        ) {
          await route.fulfill({
            status: 409,
            json: {
              detail: {
                code: "INVALID_TRANSITION",
                message: "此成果已不是最新紀錄",
                fields: [],
              },
            },
          });
          return true;
        }
        if (!state.liked) {
          state.liked = true;
          state.likeCount++;
        }
        result = cleanup();
      }
      const response = { body: result, etag: `"v${state.version}"` };
      replay.set(`${path}/${key}`, response);
      if (state.abortNext && path.endsWith(state.abortNext)) {
        state.abortNext = "";
        await route.abort("failed");
      } else
        await route.fulfill({ headers: { ETag: response.etag }, json: result });
      return true;
    });
  }
  return { state, setup, requests };
}
