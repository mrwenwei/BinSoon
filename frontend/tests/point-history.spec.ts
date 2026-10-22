import { test, expect } from "@playwright/test";
import { apiFixture, login } from "./api-fixtures";

test("member overview uses separate tabs for point history, redemptions and notifications", async ({
  page,
}, info) => {
  await apiFixture(page, undefined, { demo: true });
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/#login?next=member");
  await page
    .getByRole("button", { name: "以市民登入", exact: true })
    .click();
  await expect(page.locator(".member-ledger")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "回報摘要" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "通知與進度", exact: true }),
  ).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toContain("點數台帳");
  await page.getByRole("link", { name: "點數歷史紀錄", exact: true }).click();
  await expect(page).toHaveURL(/#point-history$/);
  await expect(
    page.getByRole("heading", { name: "點數歷史紀錄", level: 1 }),
  ).toBeInViewport();
  await expect(
    page.getByRole("link", { name: "點數歷史紀錄", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("list", { name: "點數歷史紀錄" }).locator("li"),
  ).toHaveCount(5);
  await expect(
    page.getByText("-35 點 · 餘額 93 點", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("list", { name: "點數歷史紀錄" }).locator("li"),
  ).toHaveCount(5);
  await page.screenshot({
    path: info.outputPath("point-history.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "我的兌換", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "我的兌換", level: 1 }),
  ).toBeInViewport();
  await page.getByRole("link", { name: "通知與進度", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "站內通知", level: 1 }),
  ).toBeInViewport();
  await page.getByRole("link", { name: "集章與等級", exact: true }).click();
  await expect(page).toHaveURL(/#member$/);
  await expect(
    page.getByRole("region", { name: "我的點數" }).locator(".numeral-xl"),
  ).toHaveText("93");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("member-tabs.png"),
    fullPage: true,
  });
});

test("point history paginates server entries and keeps their balances", async ({
  page,
}) => {
  const offsets: number[] = [];
  await apiFixture(page, async (route, path) => {
    if (path !== "/me/point-entries") return;
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    offsets.push(offset);
    const entries = Array.from({ length: 21 }, (_, i) => ({
      id: "entry-" + i,
      type: "report_award",
      amount: 1,
      balance_after: 50 + i,
      report_id: null,
      redemption_id: null,
      created_at: "2026-10-21T01:00:00Z",
    }));
    await route.fulfill({
      json: {
        items: entries.slice(offset, offset + limit),
        page: { offset, limit, total: 21 },
      },
    });
    return true;
  });
  await login(page, "citizen", "point-history");
  await expect(page.locator(".point-history-page li")).toHaveCount(20);
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await expect(page.locator(".point-history-page li")).toHaveCount(1);
  await expect(
    page.getByText("+1 點 · 餘額 70 點", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "下一頁", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "上一頁", exact: true }).click();
  await expect(page.locator(".point-history-page li")).toHaveCount(20);
  // Development StrictMode can repeat the initial GET; page transitions must still be 0 → 20 → 0.
  expect(
    offsets.filter(
      (offset, index) => index === 0 || offset !== offsets[index - 1],
    ),
  ).toEqual([0, 20, 0]);
});
