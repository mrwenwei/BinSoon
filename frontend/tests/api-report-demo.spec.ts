import { test, expect } from "@playwright/test";
import { apiFixture, binId, login, report } from "./api-fixtures";
import { asPhone, captureReport } from "./phone-report-fixture";

test("desktop blocks direct report and quick report even in a phone-sized window", async ({
  browser,
  baseURL,
}, info) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 393, height: 851 },
    isMobile: false,
    hasTouch: false,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const writes: string[] = [];
  await apiFixture(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") writes.push(path);
    },
    { demo: true },
  );
  for (const width of [1440, 393, 320]) {
    await page.setViewportSize({ width, height: 851 });
    for (const route of [`report/${binId}`, `quick-report/example`]) {
      await page.goto(`/#${route}`);
      await expect(
        page.getByRole("heading", { name: "請使用手機現場回報" }),
      ).toBeVisible();
      await expect(page.locator('input[type="file"], form')).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "確認送出回報" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
  }
  await page.screenshot({
    path: info.outputPath("desktop-report-block.png"),
    fullPage: true,
  });
  expect(writes).toEqual([]);
  await context.close();
});

test("phone requires shared coordinates before simulated capture and never accesses a real camera or album", async ({
  page,
}, info) => {
  await asPhone(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition() {
          throw new Error("Real GPS must not be called");
        },
      },
    });
    if (navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async () => {
        throw new Error("Real camera must not be called");
      };
  });
  let uploads = 0;
  const commands: Record<string, unknown>[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/media") {
      uploads++;
      expect(
        route
          .request()
          .postDataBuffer()!
          .includes(Buffer.from("demo-report.png")),
      ).toBe(true);
      await route.fulfill({ json: { id: report.photo_ids[0] } });
      return true;
    }
    if (path === "/reports") {
      commands.push(route.request().postDataJSON());
      await route.abort("failed");
      return true;
    }
  });
  await login(page, "citizen", `report/${binId}`);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "現場拍照（模擬）" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "確認送出回報" }),
  ).toBeDisabled();
  await captureReport(page);
  await expect(page.getByRole("status")).toContainText("距桶位 0 公尺");
  await page.screenshot({
    path: info.outputPath("phone-report.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("連線未完成");
  await page.getByRole("button", { name: "重試原回報", exact: true }).click();
  await expect.poll(() => commands.length).toBe(2);
  expect(uploads).toBe(1);
  expect(commands[0].position).toEqual({
    latitude: 25.033,
    longitude: 121.5358,
  });
  expect(commands[0].description).toContain("非實測 GPS");
});

test("phone capture and shared location drafts stay separated by waste stream", async ({
  page,
}) => {
  await asPhone(page);
  await apiFixture(page);
  await login(page, "citizen", `report/${binId}`);
  await captureReport(page);
  await page
    .getByRole("textbox", { name: "說明", exact: true })
    .fill("測試回報");
  await page.getByRole("radio", { name: "資源回收", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "待送出的模擬測試照片" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "現場拍照（模擬）" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "一般垃圾", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "待送出的模擬測試照片" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "說明", exact: true }),
  ).toHaveValue("測試回報");
});
