import { test, expect } from "@playwright/test";
import { apiFixture, binId, location, status } from "./api-fixtures";

test("bin background refresh keeps card position and existing map marker while data is unchanged", async ({
  page,
}) => {
  await page.clock.install();
  let hold = false;
  let refreshStarted = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await apiFixture(page, async (route, path) => {
    if (path === `/bins/${binId}/view`) {
      if (hold) {
        refreshStarted = true;
        await pending;
      }
      await route.fulfill({
        json: {
          location,
          status,
          can_report: false,
          report_block_reason: "login_required",
          my_adoption_id: null,
          can_apply_adoption: false,
          adopter: null,
        },
      });
      return true;
    }
  });
  await page.goto(`/#bin/${binId}`);
  await expect(page.getByText("載入中…", { exact: true })).toHaveCount(0);
  await expect(
    page.locator(".api-detail-map .leaflet-marker-icon"),
  ).toHaveCount(1);
  const marker = await page
    .locator(".api-detail-map .leaflet-marker-icon")
    .elementHandle();
  const top = await page
    .locator(".bin-overview")
    .evaluate((node) => node.getBoundingClientRect().top);
  hold = true;
  await page.clock.fastForward(10001);
  await expect.poll(() => refreshStarted).toBe(true);
  expect
    .soft(
      await page
        .locator(".bin-overview")
        .evaluate((node) => node.getBoundingClientRect().top),
    )
    .toBe(top);
  expect.soft(await marker!.evaluate((node) => node.isConnected)).toBe(true);
  release();
  await page.clock.runFor(100);
  expect(await marker!.evaluate((node) => node.isConnected)).toBe(true);
});

test("new fullness is applied without resetting zoom or replacing an unchanged marker appearance", async ({
  page,
}, info) => {
  await page.clock.install();
  let fill = 20;
  await apiFixture(page, async (route, path) => {
    if (path === `/bins/${binId}/view`) {
      const current = {
        ...status,
        fill_level_pct: fill,
        fill_status: "hungry",
        is_usable: true,
        unavailable_reasons: [],
      };
      await route.fulfill({
        json: {
          location: {
            ...location,
            bin_status: current,
            compartments: [current],
          },
          status: current,
          compartments: [current],
          can_report: false,
          report_block_reason: "login_required",
          my_adoption_id: null,
          can_apply_adoption: false,
          adopter: null,
        },
      });
      return true;
    }
  });
  await page.goto(`/#bin/${binId}`);
  await expect(page.getByText("20%", { exact: true }).first()).toBeVisible();
  const marker = await page
    .locator(".api-detail-map .leaflet-marker-icon")
    .elementHandle();
  await page.locator(".api-detail-map .leaflet-control-zoom-in").click();
  await page.clock.runFor(500);
  const transform = await page
    .locator(".api-detail-map .leaflet-proxy")
    .evaluate((node) => (node as HTMLElement).style.transform);
  fill = 30;
  await page.clock.fastForward(10001);
  await expect(page.getByText("30%", { exact: true }).first()).toBeVisible();
  expect(await marker!.evaluate((node) => node.isConnected)).toBe(true);
  expect(
    await page
      .locator(".api-detail-map .leaflet-proxy")
      .evaluate((node) => (node as HTMLElement).style.transform),
  ).toBe(transform);
  await page.screenshot({
    path: info.outputPath("bin-refresh-stable.png"),
    fullPage: true,
  });
});
