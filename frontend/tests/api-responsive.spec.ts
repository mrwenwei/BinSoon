import { test, expect } from "@playwright/test";
import { apiFixture, login, binId } from "./api-fixtures";

test("API map, details, login and report stay usable on desktop and narrow phones", async ({
  page,
}, info) => {
  await apiFixture(page);
  for (const width of info.project.name === "desktop"
    ? [1440, 768, 320]
    : [393]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, hash] of [
      ["map", "map"],
      ["bin", `bin/${binId}`],
      ["login", "login"],
      ["report", `report/${binId}`],
    ]) {
      await page.goto(`/#${hash}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (name === "map")
        await expect(page.locator(".location-row")).toHaveCount(1);
      if (name === "bin")
        await expect(
          page.getByRole("heading", { name: "API 未知桶", level: 1 }),
        ).toBeVisible();
      const header = await page.locator(".topbar").boundingBox();
      const main = await page.getByRole("main").boundingBox();
      expect(main!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`api-${name}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await login(page, "citizen", "member");
  await expect(page.getByText("可用點數 0", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("api-member.png"),
    fullPage: true,
  });
});

test("hamburger drawer reaches every entry, traps focus and closes with Esc or the scrim", async ({
  page,
}) => {
  await apiFixture(page);
  await page.goto("/#map");
  const menu = page.getByRole("button", { name: "開啟選單", exact: true });
  // 手機頂欄：地圖｜要桶投票兩個分頁（桌面版改顯示原主選單）。
  await expect(page.locator(".primary-tabs a")).toHaveText([
    "地圖",
    "要桶投票",
  ]);
  await menu.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  for (const name of [
    "找垃圾桶",
    "要桶投票",
    "我的回報",
    "會員中心",
    "集章與等級",
    "兌換獎勵",
    "認養電子雞（尚未開放）",
    "清潔隊工作台",
    "清運道路指引",
    "管理員",
    "市民登入",
    "隊員登入",
    "管理員登入",
  ])
    await expect(drawer.getByRole("link", { name, exact: true })).toBeVisible();
  // 焦點鎖在側邊欄：從最後一個項目按 Tab 回到第一個。
  await drawer.getByRole("link", { name: "管理員登入", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(drawer.getByRole("button", { name: "關閉選單" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await page
    .locator(".drawer-scrim")
    .click({ position: { x: 380, y: 400 }, force: true });
  await expect(drawer).toBeHidden();
  await menu.click();
  await drawer.getByRole("link", { name: "清潔隊工作台", exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/#staff\/tasks$/);
  // 手機版沒有底部導覽列。
  await expect(page.locator(".mobile-nav")).toHaveCount(0);
});
