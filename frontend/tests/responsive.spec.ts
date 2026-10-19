import { reviewAsStaff } from "./staff-helpers";
import { test, expect } from "@playwright/test";

test("P1-P9 fit desktop and phone viewports including 320px", async ({
  page,
  isMobile,
}, testInfo) => {
  async function capture(name: string, heading: RegExp) {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBeTruthy();
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
  }
  await page.goto("/tests/legacy/index.html");
  await expect(page.locator(".location-row")).toHaveCount(47);
  await capture("map", /附近哪裡/);
  await page.getByRole("button", { name: "只看餓了的", exact: true }).click();
  for (const row of await page.locator(".location-row").all())
    await expect(row).toContainText("餓了");
  await page.getByRole("button", { name: "全部桶況", exact: true }).click();
  await page.locator(".location-row").first().click();
  const binUrl = page.url();
  await capture("bin", /新生南路/);
  await page.getByRole("link", { name: "導航過去", exact: true }).click();
  const navUrl = page.url();
  await capture("navigation", /步行導航/);
  await page.getByRole("link", { name: "抵達後回報", exact: true }).click();
  if (!isMobile) {
    await capture("report-qr", /回報要在現場/);
    await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
  }
  const reportUrl = page.url();
  await page.getByRole("button", { name: "其他", exact: false }).click();
  await page.getByRole("button", { name: "拍一張示意照片" }).click();
  await page.getByLabel("示意定位情境").selectOption("near");
  await page.getByRole("link", { name: "登入後繼續回報" }).click();
  await capture("login", /先讓電子雞/);
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeDisabled();
  await page
    .getByLabel("補充說明（必填）")
    .fill("路旁垃圾桶需要協助，這是示範說明。".repeat(5));
  await capture("report", /回報這個桶/);
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await expect(page).toHaveURL(/#report-done\//);
  const doneUrl = page.url();
  await capture("report-done", /謝謝你幫城市變乾淨/);
  await page
    .getByRole("link", { name: "看審核結果", exact: true })
    .first()
    .click();
  const reviewUrl = page.url();
  await reviewAsStaff(page, "approved");
  await capture("review", /回報審核結果/);
  await page.getByRole("link", { name: "前往會員中心", exact: true }).click();
  await capture("member", /會員中心/);
  await page.goto("/tests/legacy/index.html#rewards");
  await capture("rewards", /兌換獎品/);
  await page
    .getByRole("article", { name: "7-11 50 元兌換券" })
    .getByRole("button", { name: "兌換", exact: true })
    .click();
  await capture("rewards-confirm", /兌換獎品/);
  await page.getByRole("button", { name: "確認兌換 30 點" }).click();
  const rewardsUrl = page.url();
  await capture("rewards-success", /兌換獎品/);
  if (!isMobile) {
    for (const width of [768, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [name, url, heading] of [
        ["bin", binUrl, /新生南路/],
        ["navigation", navUrl, /步行導航/],
        ["report", reportUrl, /回報這個桶/],
        ["report-done", doneUrl, /謝謝你幫城市變乾淨/],
        ["review", reviewUrl, /回報審核結果/],
        ["member", "/tests/legacy/index.html#member", /會員中心/],
        ["rewards", rewardsUrl, /兌換獎品/],
        ["login", "/tests/legacy/index.html#login", /先讓電子雞/],
        ["map", "/tests/legacy/index.html#map", /附近哪裡/],
      ] as const) {
        await page.goto(url);
        await capture(`${name}-${width}`, heading);
      }
    }
  }
  await page.goto("/tests/legacy/index.html#report/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "找不到這個頁面" }),
  ).toBeVisible();
});

test("v1 storage is preserved, invalid v2 recovers, and unavailable storage stays usable", async ({
  page,
}) => {
  const legacy = '{"loggedIn":true,"stamps":["old-demo"],"points":230}';
  await page.addInitScript((legacy) => {
    localStorage.setItem("binsoon-a-flow-v1", legacy);
    localStorage.setItem("binsoon-a-flow-1018-v2", '{"reports":[{}]}');
  }, legacy);
  await page.goto("/tests/legacy/index.html#stamps");
  await expect(
    page.getByRole("heading", { name: "會員中心", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("可用點數 63", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("binsoon-a-flow-v1")),
  ).toBe(legacy);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("storage unavailable");
    };
  });
  await page.goto("/tests/legacy/index.html");
  await expect(
    page.getByText("瀏覽器無法儲存資料，重新整理後可能無法保留本次紀錄。"),
  ).toBeVisible();
  await page.locator(".location-row").first().click();
  await expect(
    page.getByRole("button", { name: "按讚", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("尚無可驗證清運完成紀錄", { exact: true }),
  ).toBeVisible();
  await page.goto("/tests/legacy/index.html#login");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "瀏覽器無法儲存資料" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("binsoon-demo-1019-v3")),
  ).toBeNull();
});
