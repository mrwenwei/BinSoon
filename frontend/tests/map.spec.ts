import { test, expect } from "@playwright/test";

test("811 original records, twelve districts and source precision survive A flow without radius overlays", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/legacy/index.html");
  await expect(page.locator(".location-row")).toHaveCount(47);
  await expect(page.locator("#district option")).toHaveCount(13);
  await page.locator("#district").selectOption("all");
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await expect(page.locator(".location-row")).toHaveCount(811);
  // 重疊桶會群聚；每個標記代表的原始點總數仍須完整保留。
  await expect
    .poll(() =>
      page.locator(".leaflet-marker-icon").evaluateAll((icons) =>
        icons.reduce((total, icon) => {
          const count = icon
            .getAttribute("title")
            ?.match(/^(\d+) 個桶，放大查看$/);
          return total + (count ? Number(count[1]) : 1);
        }, 0),
      ),
    )
    .toBe(811);
  await page.locator("#district").selectOption("大安區");
  await expect(page.locator(".location-row")).toHaveCount(65);
  await page.getByRole("button", { name: "公布桶位置", exact: true }).click();
  await expect(page.locator(".location-row")).toHaveCount(47);
  await page.getByRole("button", { name: "場所代表點", exact: true }).click();
  await expect(page.locator(".location-row")).toHaveCount(18);
  await page.locator(".map-section").scrollIntoViewIfNeeded();
  await page
    .locator('.leaflet-marker-icon[title="場所代表點：麟光捷運站"]')
    .click();
  const details = page.getByRole("region", { name: "位置詳情" });
  await expect(details).toContainText("並非個別清潔箱位置");
  await expect(details).toContainText("經度 / 緯度");
  await expect(details).not.toContainText("150m");
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
  await page.getByText("來源與位置精度", { exact: true }).click();
  await expect(details).toContainText("daan_hotspot_gap_screening.csv");
  await expect(details).toContainText("representative_point_only");
  await page.screenshot({
    path: testInfo.outputPath("place-source.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "關閉位置詳情" }).click();
  await expect(details).toHaveCount(0);
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  for (const district of [
    "中正區",
    "大同區",
    "中山區",
    "松山區",
    "大安區",
    "萬華區",
    "信義區",
    "士林區",
    "北投區",
    "內湖區",
    "南港區",
    "文山區",
  ]) {
    await page.locator("#district").selectOption(district);
    await expect(page.locator(".location-row").first()).toContainText(district);
  }
  await page.locator("#district").selectOption("大安區");
  await page.getByRole("button", { name: "公布桶位置", exact: true }).click();
  await page.locator(".location-row").first().click();
  await expect(page.getByRole("region", { name: "位置詳情" })).toContainText(
    "依公布座標標示",
  );
  await page.getByText("查看地圖位置", { exact: true }).click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
  await expect(page.getByRole("main")).not.toContainText("150m");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".leaflet-control-attribution")).toContainText(
    "OpenStreetMap",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("basemap connection failure leaves records accessible", async ({
  page,
}) => {
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/tests/legacy/index.html");
  await expect(page.locator(".map-warning")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".location-row")).toHaveCount(47);
  await page.locator(".location-row").first().click();
  await expect(page.getByRole("region", { name: "位置詳情" })).toBeVisible();
});
