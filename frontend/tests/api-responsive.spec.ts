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
