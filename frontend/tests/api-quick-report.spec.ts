import { test, expect } from "@playwright/test";
import {
  apiFixture,
  login,
  binId,
  location,
  status,
  report,
  reportId,
  workId,
  arrivedWork,
} from "./api-fixtures";
import { adoption, adoptionId } from "./api-adoption-fixture";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMwTnMBAAGtAN6NqpJ+AAAAAElFTkSuQmCC",
  "base64",
);

for (const state of ["pending", "withdrawn", "ended"]) {
  test(`${state} adoption cannot gain quick eligibility from a direct link`, async ({
    page,
  }) => {
    let posts = 0;
    await apiFixture(page, async (route, path) => {
      if (path === `/adoptions/${adoptionId}`) {
        await route.fulfill({ json: { ...adoption, status: state } });
        return true;
      }
      if (path === "/reports") {
        posts++;
        await route.abort();
        return true;
      }
    });
    await login(page, "citizen", `quick-report/${adoptionId}`);
    await expect(
      page.getByText("僅有效認養可快捷通報；請回認養管理確認狀態。", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "確認送出回報", exact: true }),
    ).toBeDisabled();
    expect(posts).toBe(0);
  });
}

test("permission rejection rereads adoption and BinView; suspended reporting still allows management and zero month", async ({
  page,
}) => {
  let rejected = false,
    adoptionReads = 0,
    binReads = 0;
  await apiFixture(page, async (route, path) => {
    if (path === `/adoptions/${adoptionId}`) {
      adoptionReads++;
      await route.fulfill({ json: { ...adoption, status: "active" } });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      binReads++;
      await route.fulfill({
        json: {
          location,
          status,
          can_report: !rejected,
          report_block_reason: rejected ? "suspended" : null,
          my_adoption_id: adoptionId,
          can_apply_adoption: false,
          adopter: null,
        },
      });
      return true;
    }
    if (path === "/media") {
      await route.fulfill({ json: { id: report.photo_ids[0] } });
      return true;
    }
    if (path === "/reports") {
      rejected = true;
      await route.fulfill({
        status: 403,
        json: {
          detail: {
            code: "REPORTING_SUSPENDED",
            message: "回報資格暫停",
            fields: [],
          },
        },
      });
      return true;
    }
  });
  await login(page, "citizen", `quick-report/${adoptionId}`);
  await page
    .getByLabel("現場照片", { exact: true })
    .setInputFiles({ name: "quick.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("緯度", { exact: true }).fill("25.033");
  await page.getByLabel("經度", { exact: true }).fill("121.5358");
  await page.getByLabel("確認這是我提供的現場位置").check();
  const before = { adoptionReads, binReads };
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect.poll(() => adoptionReads).toBeGreaterThan(before.adoptionReads);
  await expect.poll(() => binReads).toBeGreaterThan(before.binReads);
  await expect(
    page.getByRole("button", { name: "確認送出回報", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "返回認養管理", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "預覽更新偏好", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("已發點數 0", { exact: true })).toBeVisible();
});

for (const scenario of [
  {
    name: "valid adopter first at submission",
    adopter: true,
    first: true,
    points: 2,
  },
  { name: "later reporter gets zero", adopter: true, first: false, points: 0 },
  {
    name: "approval after submission cannot retroactively double",
    adopter: false,
    first: true,
    points: 1,
  },
  {
    name: "ending adoption does not claw back old report",
    adopter: true,
    first: true,
    points: 2,
  },
]) {
  test(`staff verifies and citizen sees backend settlement: ${scenario.name}`, async ({
    page,
  }) => {
    let approved = false;
    const result = () => ({
      ...report,
      adopter: scenario.adopter,
      first_reporter: scenario.first,
      quick: scenario.adopter,
      status: approved ? "approved" : "processing",
      work_status: "arrived",
      pending_points: approved ? 0 : scenario.points,
      awarded_points: approved ? scenario.points : 0,
    });
    await apiFixture(page, async (route, path) => {
      if (path === `/staff/work-orders/${workId}`) {
        await route.fulfill({
          headers: { ETag: approved ? '"v4"' : '"v3"' },
          json: {
            work_order: { ...arrivedWork, version: approved ? 4 : 3 },
            location,
            reports: [result()],
            evidence: [],
            completion_requirements: { missing: ["completion_photo"] },
          },
        });
        return true;
      }
      if (path === `/staff/work-orders/${workId}/reports/${reportId}/review`) {
        expect(route.request().headers()["if-match"]).toBe('"v3"');
        approved = true;
        await route.fulfill({
          json: {
            report: result(),
            work_order: { ...arrivedWork, version: 4 },
          },
        });
        return true;
      }
      if (path === `/reports/${reportId}`) {
        await route.fulfill({ json: result() });
        return true;
      }
    });
    await login(page, "staff", `staff/tasks/${workId}`);
    await page.getByLabel("查證結果").selectOption("approved");
    await page.getByRole("button", { name: "確認查證", exact: true }).click();
    await expect(
      page.getByText(`已入帳點數 ${scenario.points}`, { exact: true }),
    ).toBeVisible();
    await login(page, "citizen", `review/${reportId}`);
    await expect(
      page.getByText(`已入帳點數 ${scenario.points}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("待確認點數 0", { exact: true })).toBeVisible();
    await expect(
      page.getByText("查證屬實不代表工作已完成。", { exact: true }),
    ).toBeVisible();
  });
}

test("month switch discards late old totals and presents zero from server", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await apiFixture(page, async (route, path) => {
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({ json: { ...adoption, status: "ended" } });
      return true;
    }
    if (path.endsWith("/monthly-summary")) {
      const month = new URL(route.request().url()).searchParams.get("month");
      if (month === "2026-08") {
        started = true;
        await held;
      }
      await route
        .fulfill({
          json: {
            adoption_id: adoptionId,
            month,
            timezone: "Asia/Taipei",
            reports_submitted: month === "2026-08" ? 88 : 0,
            reports_approved: 0,
            points_awarded: 0,
            is_partial_month: false,
            source_type: "demo",
          },
        })
        .catch(() => {});
      return true;
    }
  });
  await login(page, "citizen", `adopt/${adoptionId}`);
  await page.getByLabel("認養月份").fill("2026-08");
  await expect.poll(() => started).toBe(true);
  await page.getByLabel("認養月份").fill("2026-09");
  await expect(page.getByText("送出回報 0", { exact: true })).toBeVisible();
  release!();
  await expect(
    page.getByText("2026-09 · Asia/Taipei", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("送出回報 88", { exact: true })).toHaveCount(0);
});

test("quick retry after expiry retains command; same event uses existing report ID and new event uploads fresh evidence", async ({
  page,
}) => {
  const calls: { key: string; body: Record<string, unknown> }[] = [];
  let uploads = 0;
  const nextId = "20000000-0000-4000-8000-000000000002";
  let currentId = reportId;
  await apiFixture(page, async (route, path) => {
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({ json: { ...adoption, status: "active" } });
      return true;
    }
    if (path === "/media") {
      uploads++;
      await route.fulfill({
        json: {
          id: `50000000-0000-4000-8000-${String(uploads).padStart(12, "0")}`,
        },
      });
      return true;
    }
    if (path === "/reports") {
      calls.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      if (calls.length === 1)
        await route.fulfill({
          status: 401,
          json: {
            detail: {
              code: "SESSION_EXPIRED",
              message: "登入已失效",
              fields: [],
            },
          },
        });
      else {
        currentId = calls.length === 4 ? nextId : reportId;
        await route.fulfill({
          status: calls.length === 3 ? 200 : 201,
          json: { ...report, id: currentId, photo_ids: [], quick: true },
        });
      }
      return true;
    }
    if (path === `/reports/${currentId}`) {
      await route.fulfill({
        json: { ...report, id: currentId, photo_ids: [], quick: true },
      });
      return true;
    }
  });
  await login(page, "citizen", `quick-report/${adoptionId}`);
  async function fillAndSubmit() {
    await page
      .getByLabel("現場照片", { exact: true })
      .setInputFiles({ name: "quick.png", mimeType: "image/png", buffer: png });
    await page.getByLabel("緯度", { exact: true }).fill("25.033");
    await page.getByLabel("經度", { exact: true }).fill("121.5358");
    await page.getByLabel("確認這是我提供的現場位置").check();
    await page
      .getByRole("button", { name: "確認送出回報", exact: true })
      .click();
  }
  await fillAndSubmit();
  await page.getByRole("link", { name: "市民登入", exact: true }).click();
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.getByRole("button", { name: "重試原回報", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#report-done/${reportId}$`));
  expect(calls[1]).toEqual(calls[0]);
  expect(uploads).toBe(1);
  for (const id of [reportId, nextId]) {
    await page.evaluate((id) => {
      location.hash = `quick-report/${id}`;
    }, adoptionId);
    await expect(
      page.getByRole("img", { name: "待送出的現場照片" }),
    ).toHaveCount(0);
    await fillAndSubmit();
    await expect(page).toHaveURL(new RegExp(`#report-done/${id}$`));
  }
  expect(uploads).toBe(3);
  expect(calls[2].body.photo_ids).not.toEqual(calls[3].body.photo_ids);
  expect(calls.every((c) => c.body.quick === true)).toBe(true);
});

test("active adopter reads server monthly totals and quick report shares photos position and reports API", async ({
  page,
}) => {
  let submitted = false;
  await apiFixture(page, async (route, path) => {
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({
        headers: { ETag: '"v1"' },
        json: { ...adoption, status: "active" },
      });
      return true;
    }
    if (path === `/adoptions/${adoptionId}/monthly-summary`) {
      await route.fulfill({
        json: {
          adoption_id: adoptionId,
          month: new URL(route.request().url()).searchParams.get("month"),
          timezone: "Asia/Taipei",
          reports_submitted: 3,
          reports_approved: 2,
          points_awarded: 4,
          is_partial_month: true,
          source_type: "demo",
        },
      });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location,
          status,
          can_report: true,
          report_block_reason: null,
          my_adoption_id: adoptionId,
          can_apply_adoption: false,
          adopter: { display_name: adoption.display_name },
        },
      });
      return true;
    }
    if (path === "/media") {
      expect(route.request().postDataBuffer()?.includes(png)).toBeTruthy();
      await route.fulfill({ status: 201, json: { id: report.photo_ids[0] } });
      return true;
    }
    if (path === "/reports") {
      expect(route.request().postDataJSON()).toEqual({
        bin_id: binId,
        waste_type: "general",
        type: "full",
        description: "",
        photo_ids: report.photo_ids,
        position: { latitude: 25.033, longitude: 121.5358 },
        quick: true,
      });
      submitted = true;
      await route.fulfill({
        status: 201,
        json: {
          ...report,
          adopter: true,
          quick: true,
          first_reporter: true,
          pending_points: 2,
        },
      });
      return true;
    }
    if (path === `/reports/${reportId}`) {
      await route.fulfill({
        json: {
          ...report,
          adopter: true,
          quick: true,
          first_reporter: true,
          pending_points: 2,
        },
      });
      return true;
    }
  });
  await login(page, "citizen", `adopt/${adoptionId}`);
  await expect(
    page.getByRole("heading", { name: "認養月報", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("部分月份：僅計本次有效認養期間", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("已發點數 4", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "認養快捷通報", exact: true }).click();
  await page
    .getByLabel("現場照片", { exact: true })
    .setInputFiles({ name: "quick.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("緯度", { exact: true }).fill("25.033");
  await page.getByLabel("經度", { exact: true }).fill("121.5358");
  await page.getByLabel("確認這是我提供的現場位置").check();
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#report-done/${reportId}$`));
  await expect(page.getByText("待確認點數 2", { exact: true })).toBeVisible();
  expect(submitted).toBe(true);
});
