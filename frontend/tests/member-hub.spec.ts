import { test, expect } from "@playwright/test";
import { apiFixture, binId, location } from "./api-fixtures";

test("member keeps levels and opens separate reward and report pages", async ({
  page,
}, info) => {
  const writes: string[] = [];
  await apiFixture(
    page,
    async (route) => {
      if (route.request().method() !== "GET")
        writes.push(route.request().url());
    },
    { demo: true },
  );
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/#login?next=levels");
  await page
    .getByRole("button", { name: "以市民登入", exact: true })
    .click();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: "會員中心" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "會員升級進度" }),
  ).toHaveAttribute("value", "128");
  await expect(
    page.getByRole("progressbar", { name: "會員升級進度" }),
  ).toHaveAttribute("max", "150");
  const badges = page.getByRole("list", { name: "會員等級徽章" });
  await expect(badges.getByRole("listitem")).toHaveCount(6);
  await expect(badges.locator(".current")).toContainText("獨當一面");
  await expect(page.getByRole("button", { name: /選擇.*超商/ })).toHaveCount(0);
  await expect(page.locator(".member-reward-grid")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "我的回報", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "會員中心區塊" })
    .getByRole("link", { name: "我的回報", exact: true })
    .click();
  await expect(page).toHaveURL(/#reports$/);
  await expect(
    page.getByRole("heading", { name: "回報紀錄", level: 1 }),
  ).toBeInViewport();
  await page.getByRole("link", { name: "返回我的", exact: true }).click();
  await page
    .locator(".member-hero")
    .getByRole("link", { name: "兌換獎勵", exact: true })
    .click();
  await expect(page).toHaveURL(/#rewards$/);
  await expect(
    page.getByRole("heading", { name: "兌換獎勵", level: 1 }),
  ).toBeInViewport();
  const rewards = page.locator("main");
  await expect(
    rewards.getByRole("region", { name: "規劃中獎勵" }),
  ).toContainText("點數待定");
  await rewards
    .getByRole("button", { name: "選擇 超商咖啡", exact: true })
    .click();
  await rewards.getByRole("button", { name: "確認兌換", exact: true }).click();
  await expect(
    rewards.getByRole("heading", { name: "兌換成功" }),
  ).toBeVisible();
  await expect(page.getByText("可用點數 90", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回會員中心", exact: true }).click();
  await expect(page).toHaveURL(/#member$/);
  await expect(
    page
      .getByRole("region", { name: "我的點數" })
      .getByText("90", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/累積 128 點/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "我的功能" })
    .getByRole("link", { name: /^回報紀錄/ })
    .click();
  const reportTop = (await page
    .getByRole("heading", { name: "回報紀錄", exact: true })
    .boundingBox())!;
  const topbar = (await page.locator(".topbar").boundingBox())!;
  expect(reportTop.y).toBeGreaterThanOrEqual(topbar.y + topbar.height);
  const reports = page.locator("main");
  await expect(reports.locator("li")).toHaveCount(4);
  await expect(page).toHaveURL(/#reports$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("member-hub.png"),
    fullPage: true,
  });
  await reports.locator("li a").first().click();
  await expect(page).toHaveURL(/#review\//);
  expect(writes).toEqual([]);
});

test("notifications live in member and unclaimed bins open their own adoption application", async ({
  page,
}) => {
  await apiFixture(page, undefined, { demo: true });
  await page.goto("/#login?next=member");
  await page
    .getByRole("button", { name: "以市民登入", exact: true })
    .click();
  await page.getByRole("link", { name: "通知與進度", exact: true }).click();
  await expect(page).toHaveURL(/#notifications$/);
  await expect(
    page.getByRole("heading", { name: "站內通知", level: 1 }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回會員中心", exact: true }).click();
  await expect(page).toHaveURL(/#member$/);
  await page.goto("/#bin/" + binId);
  const entry = page.getByRole("link", { name: /申請認養此桶/ });
  await expect(entry).toContainText("認領這位 BinU");
  await entry.click();
  await expect(page).toHaveURL(new RegExp("#adopt/apply/" + binId));
  await expect(
    page.getByRole("heading", { name: "認領 BinU", level: 1 }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "等你認領的 BinU", exact: true })
      .getByText(location.label, { exact: true }),
  ).toBeVisible();
});
