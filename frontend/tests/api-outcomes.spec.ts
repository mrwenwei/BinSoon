import { test, expect } from "@playwright/test";
import { apiFixture, login, user } from "./api-fixtures";

test("staff sees backend ties and null duration while visitors only read public outcomes", async ({
  page,
}, info) => {
  const privateCalls: string[] = [];
  await apiFixture(page, async (route, path) => {
    const month = new URL(route.request().url()).searchParams.get("month");
    if (path === "/staff/statistics") {
      privateCalls.push(path);
      expect(new URL(route.request().url()).searchParams.get("district")).toBe(
        "大安區",
      );
      await route.fulfill({
        json: {
          month,
          timezone: "Asia/Taipei",
          district: "大安區",
          completed_count: 3,
          like_count: 4,
          average_processing_seconds: null,
          bonus_display_only: true,
          ranking: [
            {
              rank: 1,
              staff_id: user("staff").id,
              display_name: "同分甲",
              completed_count: 3,
              like_count: 4,
              average_processing_seconds: null,
            },
            {
              rank: 1,
              staff_id: "another-staff",
              display_name: "同分乙",
              completed_count: 3,
              like_count: 99,
              average_processing_seconds: 120,
            },
          ],
        },
      });
      return true;
    }
    if (path === "/public/outcomes") {
      await route.fulfill({
        json: {
          month,
          timezone: "Asia/Taipei",
          district: "大安區",
          completed_count: 6,
          like_count: 103,
        },
      });
      return true;
    }
  });
  await page.goto("/#outcomes");
  await expect(
    page.getByRole("heading", { name: "清潔隊公開成果" }),
  ).toBeVisible();
  await expect(page.getByText("完成件數 6", { exact: true })).toBeVisible();
  expect(privateCalls).toHaveLength(0);
  await login(page, "staff", "staff/statistics");
  await expect(
    page.getByText("平均處理時間 無資料", { exact: true }).first(),
  ).toBeVisible();
  const rows = page
    .getByRole("list", { name: "隊員排名" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("第 1 名");
  await expect(rows.nth(1)).toContainText("第 1 名");
  await expect(
    page.getByLabel("行政區", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("staff-statistics.png"),
    fullPage: true,
  });
});

test("rapid month changes ignore late old results and refresh reflects new completions", async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  await apiFixture(page, async (route, path) => {
    if (path === "/public/outcomes") {
      const month = new URL(route.request().url()).searchParams.get("month");
      if (month === "2026-08") {
        await waiting;
        await route
          .fulfill({
            json: {
              month,
              district: "大安區",
              timezone: "Asia/Taipei",
              completed_count: 999,
              like_count: 999,
            },
          })
          .catch(() => {});
      } else
        await route.fulfill({
          json: {
            month,
            district: "大安區",
            timezone: "Asia/Taipei",
            completed_count: count,
            like_count: count,
          },
        });
      return true;
    }
    if (path.startsWith("/staff/"))
      throw new Error("Public screen requested private staff API");
  });
  await page.goto("/#outcomes");
  await expect(page.getByText("本月尚無完成紀錄")).toBeVisible();
  await page.getByLabel("月份", { exact: true }).fill("2026-08");
  await page.getByLabel("月份", { exact: true }).fill("2026-09");
  await expect(
    page.getByRole("heading", { name: "2026-09 · 大安區" }),
  ).toBeVisible();
  release();
  count = 7;
  await page.getByRole("button", { name: "更新成果", exact: true }).click();
  await expect(page.getByText("完成件數 7", { exact: true })).toBeVisible();
  await expect(page.getByText("完成件數 999", { exact: true })).toHaveCount(0);
});

test("staff empty month and expired session show no private stale statistics", async ({
  page,
}) => {
  let expired = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/staff/statistics") {
      if (expired)
        await route.fulfill({
          status: 401,
          json: { detail: { code: "SESSION_EXPIRED", message: "請重新登入" } },
        });
      else
        await route.fulfill({
          json: {
            month: "2026-07",
            timezone: "Asia/Taipei",
            district: "大安區",
            completed_count: 0,
            like_count: 0,
            average_processing_seconds: null,
            ranking: [],
            bonus_display_only: true,
          },
        });
      return true;
    }
  });
  await login(page, "staff", "staff/statistics");
  await expect(
    page.getByText("本月沒有排名資料", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("平均處理時間 無資料", { exact: true }),
  ).toBeVisible();
  expired = true;
  await page.getByRole("button", { name: "更新成果", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "隊員登入", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("平均處理時間 無資料", { exact: true }),
  ).toHaveCount(0);
});
