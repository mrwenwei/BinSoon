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

test("M navigation has three responsive tabs and identity switches through login", async ({
  page,
}, info) => {
  await apiFixture(page, undefined, { demo: true });
  await page.goto("/#map");
  await expect(page.getByRole("button", { name: "開啟選單" })).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "主要分頁" });
  await expect(nav.getByRole("link")).toHaveCount(3);
  for (const name of ["地圖", "設桶投票", "我的"])
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  const box = await nav.boundingBox();
  if (info.project.name === "mobile")
    expect(box!.y + box!.height).toBeCloseTo(page.viewportSize()!.height, 0);
  else expect(box!.y).toBeLessThan(150);
  const identity = page.getByRole("navigation", { name: "Demo 身份切換" });
  await identity.getByRole("link", { name: "清潔隊", exact: true }).click();
  await page
    .getByRole("button", { name: "以清潔員登入", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "今日派工", exact: true }),
  ).toBeVisible();
  await identity.getByRole("link", { name: "市民", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "市民登入", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "以市民登入", exact: true })
    .click();
  await expect(page).toHaveURL(/#map$/);
});
