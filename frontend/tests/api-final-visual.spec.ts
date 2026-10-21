import { test, expect } from "@playwright/test";
import { apiFixture, login, binId, reportId, envelope } from "./api-fixtures";
import { adoption, adoptionId } from "./api-adoption-fixture";

test("quick report, monthly summary, inbox and lifecycle fit desktop mobile and 320px with keyboard controls", async ({
  page,
}, info) => {
  await apiFixture(page, async (route, path) => {
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({ json: { ...adoption, status: "active" } });
      return true;
    }
    if (path === "/me/notifications") {
      await route.fulfill({
        json: envelope([
          {
            id: "notice",
            title: "回報已查證",
            message: "查看站內案件與後端結算結果。",
            type: "report_reviewed",
            read_at: null,
            created_at: "2026-10-20T02:00:00Z",
            waste_type: "general",
            target: { kind: "report", id: reportId },
          },
        ]),
      });
      return true;
    }
    if (path === `/bins/${binId}/lifecycle`) {
      await route.fulfill({
        headers: { ETag: '"v7"' },
        json: {
          bin_id: binId,
          version: 7,
          operational_status: "normal",
          placement_status: "existing",
          installed_at: null,
          removed_at: null,
          reason: null,
        },
      });
      return true;
    }
  });
  await login(page, "citizen", `adopt/${adoptionId}`);
  const original = page.viewportSize()!;
  for (const width of [original.width, 320]) {
    await page.setViewportSize({ width, height: original.height });
    for (const [route, heading, file] of [
      [`adopt/${adoptionId}`, "認養詳情", "monthly"],
      [
        `quick-report/${adoptionId}`,
        info.project.name === "desktop" ? "請使用手機現場回報" : "認養快捷通報",
        "quick",
      ],
      ["notifications", "站內通知", "inbox"],
    ]) {
      await page.evaluate((route) => {
        location.hash = route;
      }, route);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("main").getByText("載入中…", { exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`${file}-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByLabel("只看未讀").focus();
    await page.keyboard.press("Space");
    await expect(page.getByLabel("只看未讀")).toBeChecked();
  }
  await login(page, "admin", `admin/bins/${binId}`);
  for (const width of [original.width, 320]) {
    await page.setViewportSize({ width, height: original.height });
    await page
      .getByLabel("撤除原因", { exact: true })
      .fill("現場工程需要撤除，保留既有案件與歷史");
    await page.getByRole("button", { name: "預覽撤除", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "確認操作", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`lifecycle-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "取消", exact: true }).click();
  }
});
