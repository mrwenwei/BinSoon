import { test, expect } from "@playwright/test";
import {
  apiFixture,
  arrivedWork,
  location,
  binId,
  reportId,
  workId,
  eventId,
  report,
  envelope,
  login,
} from "./api-fixtures";

test("staff uses latest ETags and explicitly confirms after a conflict before reviewing", async ({
  page,
}) => {
  let version = 1,
    status = "pending",
    conflict = true,
    approved = false;
  const calls: { path: string; etag: string; key: string }[] = [];
  const work = () => ({
    id: workId,
    version,
    bin_id: binId,
    event_id: eventId,
    type: "full",
    status,
    district: "大安區",
    source: "citizen",
    priority: "high",
    assigned_staff_id: status === "pending" ? null : "staff-uuid",
    created_at: report.created_at,
    accepted_at: status === "pending" ? null : report.created_at,
    arrived_at: status === "arrived" ? report.created_at : null,
    target_at: null,
    is_overdue: false,
    reason: null,
    blocked_by_removed_bin: false,
  });
  await apiFixture(page, async (route, path) => {
    if (path === "/staff/work-orders") {
      await route.fulfill({ json: envelope([work()]) });
      return true;
    }
    if (path === `/staff/work-orders/${workId}`) {
      await route.fulfill({
        headers: { ETag: `"v${version}"` },
        json: {
          work_order: work(),
          location,
          reports: [
            {
              ...report,
              status: approved ? "approved" : "processing",
              awarded_points: approved ? 1 : 0,
              pending_points: approved ? 0 : 1,
            },
          ],
          evidence: [],
          completion_requirements: {
            missing: ["completion_photo", "fresh_clear_reading"],
          },
        },
      });
      return true;
    }
    if (
      route.request().method() === "POST" &&
      path.startsWith(`/staff/work-orders/${workId}/`)
    ) {
      const h = route.request().headers();
      calls.push({ path, etag: h["if-match"], key: h["idempotency-key"] });
      if (path.endsWith("/arrive") && conflict) {
        conflict = false;
        version = 3;
        await route.fulfill({
          status: 412,
          json: {
            detail: {
              code: "VERSION_CONFLICT",
              message: "版本已更新",
              fields: [],
            },
          },
        });
        return true;
      }
      expect(h["if-match"]).toBe(`"v${version}"`);
      version++;
      if (path.endsWith("/accept")) status = "processing";
      if (path.endsWith("/arrive")) status = "arrived";
      if (path.endsWith("/review")) approved = true;
      await route.fulfill({
        headers: { ETag: `"v${version}"` },
        json: approved
          ? {
              work_order: work(),
              report: { ...report, status: "approved", awarded_points: 1 },
            }
          : work(),
      });
      return true;
    }
  });
  await login(page, "staff", "staff/tasks");
  await page.getByRole("link", { name: /查看工單/ }).click();
  await page.getByRole("button", { name: "接單", exact: true }).click();
  await expect(page.getByText("工單版本 v2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "確認到場", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("版本已更新");
  await expect(page.getByText("工單版本 v3", { exact: true })).toBeVisible();
  expect(calls).toHaveLength(2);
  await page
    .getByRole("button", { name: "確認目前版本並重試", exact: true })
    .click();
  await expect(page.getByText("工單版本 v4", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認查證", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("查證結果").selectOption("approved");
  await page.getByRole("button", { name: "確認查證", exact: true }).click();
  await expect(page.getByText("已入帳點數 1", { exact: true })).toBeVisible();
  await expect(
    page.getByText("工單狀態：已到場", { exact: true }),
  ).toBeVisible();
  expect(calls.map((c) => c.etag)).toEqual(['"v1"', '"v2"', '"v3"', '"v4"']);
  expect(new Set(calls.map((c) => c.key)).size).toBe(4);
});

test("citizen sees server settlement after staff verification without confusing it with completion", async ({
  page,
  context,
}) => {
  let approved = false;
  const setup = (target: import("@playwright/test").Page) =>
    apiFixture(target, async (route, path) => {
      const r = {
        ...report,
        first_reporter: true,
        adopter: true,
        pending_points: approved ? 0 : 2,
        awarded_points: approved ? 2 : 0,
        status: approved ? "approved" : "processing",
        work_status: "arrived",
      };
      if (path === `/staff/work-orders/${workId}`) {
        await route.fulfill({
          headers: { ETag: approved ? '"v4"' : '"v3"' },
          json: {
            work_order: { ...arrivedWork, version: approved ? 4 : 3 },
            location,
            reports: [r],
            evidence: [],
            completion_requirements: { missing: ["completion_photo"] },
          },
        });
        return true;
      }
      if (path.endsWith(`/reports/${reportId}/review`)) {
        approved = true;
        await route.fulfill({
          headers: { ETag: '"v4"' },
          json: {
            report: { ...r, status: "approved", awarded_points: 2 },
            work_order: { ...arrivedWork, version: 4 },
          },
        });
        return true;
      }
      if (path === "/me/membership") {
        await route.fulfill({
          json: {
            cumulative_points: approved ? 2 : 0,
            available_points: approved ? 2 : 0,
            pending_points: approved ? 0 : 2,
            approved_report_count: approved ? 1 : 0,
            rejected_report_count: 0,
            reporting_suspended: false,
            current_tier: { name: "見習生" },
            next_tier: { name: "新手" },
            points_to_next_tier: approved ? 8 : 10,
          },
        });
        return true;
      }
      if (path === "/me/point-entries") {
        await route.fulfill({
          json: envelope(
            approved
              ? [
                  {
                    id: "entry-uuid",
                    amount: 2,
                    balance_after: 2,
                    report_id: reportId,
                    created_at: report.created_at,
                    type: "report_award",
                  },
                ]
              : [],
          ),
        });
        return true;
      }
      if (path === `/reports/${reportId}`) {
        await route.fulfill({ json: r });
        return true;
      }
    });
  await setup(page);
  await login(page, "citizen", "member");
  await expect(page.getByText("待確認點數 2", { exact: true })).toBeVisible();
  const crew = await context.newPage();
  await setup(crew);
  await login(crew, "staff", `staff/tasks/${workId}`);
  await crew.getByLabel("查證結果").selectOption("approved");
  await crew.getByRole("button", { name: "確認查證", exact: true }).click();
  await expect(crew.getByText("已入帳點數 2", { exact: true })).toBeVisible();
  await page.bringToFront();
  await expect(page.getByText("可用點數 2", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: "查看回報", exact: true }).click();
  await expect(
    page.getByText("查證屬實不代表工作已完成。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("工單進度：已到場", { exact: true }),
  ).toBeVisible();
});

test("staff command survives reauthentication with its original body, key and ETag", async ({
  page,
}) => {
  const calls: unknown[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/staff/work-orders/${workId}`) {
      await route.fulfill({
        headers: { ETag: '"v3"' },
        json: {
          work_order: arrivedWork,
          location,
          reports: [report],
          evidence: [],
          completion_requirements: { missing: [] },
        },
      });
      return true;
    }
    if (path.endsWith(`/reports/${reportId}/review`)) {
      calls.push({
        body: route.request().postDataJSON(),
        etag: route.request().headers()["if-match"],
        key: route.request().headers()["idempotency-key"],
      });
      await route.fulfill(
        calls.length === 1
          ? {
              status: 401,
              json: {
                detail: {
                  code: "SESSION_EXPIRED",
                  message: "登入已失效",
                  fields: [],
                },
              },
            }
          : {
              headers: { ETag: '"v4"' },
              json: { report, work_order: { ...arrivedWork, version: 4 } },
            },
      );
      return true;
    }
  });
  await login(page, "staff", `staff/tasks/${workId}`);
  await page.getByLabel("查證結果").selectOption("rejected");
  await expect(
    page.getByRole("button", { name: "確認查證", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("不實原因").fill("現場並無此問題");
  await page.getByRole("button", { name: "確認查證", exact: true }).click();
  await page.getByRole("link", { name: "隊員登入", exact: true }).click();
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page
    .getByRole("button", { name: "重試原工單操作", exact: true })
    .click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1]).toEqual(calls[0]);
});
