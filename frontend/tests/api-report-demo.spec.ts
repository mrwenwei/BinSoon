import { test, expect } from "@playwright/test";
import { apiFixture, binId, login, report } from "./api-fixtures";

test("demo inputs use the selected API bin and upload a marked image through the original report command", async ({
  page,
}) => {
  let uploads = 0;
  const commands: { key?: string; body: Record<string, unknown> }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/media") {
      uploads++;
      const payload = route.request().postDataBuffer()!;
      expect(payload.includes(Buffer.from("demo-report.png"))).toBeTruthy();
      expect(
        payload.includes(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      ).toBeTruthy();
      await route.fulfill({ status: 201, json: { id: report.photo_ids[0] } });
      return true;
    }
    if (path === "/reports") {
      commands.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      await route.abort("failed");
      return true;
    }
  });
  await login(page, "citizen", `report/${binId}?waste_type=recycling`);
  await page
    .getByRole("button", { name: "使用此桶座標（模擬 GPS）", exact: true })
    .click();
  await expect(page.getByLabel("緯度", { exact: true })).toHaveValue("25.033");
  await expect(page.getByLabel("經度", { exact: true })).toHaveValue(
    "121.5358",
  );
  await page.getByRole("button", { name: "產生示意照片", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "待送出的模擬測試照片" }),
  ).toBeVisible();
  const submit = page.getByRole("button", {
    name: "確認送出回報",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await page.getByLabel("確認使用模擬測試位置，非實測 GPS").check();
  await submit.click();
  await expect(
    page.getByRole("button", { name: "重試原回報", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "使用此桶座標（模擬 GPS）", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "重試原回報", exact: true }).click();
  await expect.poll(() => commands.length).toBe(2);
  expect(uploads).toBe(1);
  expect(commands[1]).toEqual(commands[0]);
  expect(commands[0].body).toMatchObject({
    bin_id: binId,
    waste_type: "recycling",
    position: { latitude: 25.033, longitude: 121.5358 },
    photo_ids: report.photo_ids,
    quick: false,
  });
  expect(commands[0].body.description).toContain("模擬測試");
  expect(commands[0].body.description).toContain("非實測 GPS");
});

test("distance and unavailable scenarios stay explicit and a late GPS result cannot overwrite the selected scenario", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition(success: PositionCallback) {
          (window as unknown as { deliverGps: () => void }).deliverGps = () =>
            success({
              coords: { latitude: 24, longitude: 120 },
            } as GeolocationPosition);
        },
      },
    });
  });
  await apiFixture(page);
  await login(page, "citizen", `report/${binId}`);
  await page.getByRole("button", { name: "取得目前位置", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "模擬距離過遠（約 78 公尺）",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "模擬距離過遠（約 78 公尺）", exact: true })
    .click();
  expect(
    Number(await page.getByLabel("緯度", { exact: true }).inputValue()),
  ).toBeGreaterThan(25.0336);
  await page.getByRole("button", { name: "模擬定位失敗", exact: true }).click();
  await expect(page.getByLabel("緯度", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("經度", { exact: true })).toHaveValue("");
  await expect(page.getByRole("status")).toContainText("模擬定位失敗");
  await page
    .getByRole("button", { name: "使用此桶座標（模擬 GPS）", exact: true })
    .click();
  await page.evaluate(() =>
    (window as unknown as { deliverGps: () => void }).deliverGps(),
  );
  await expect(page.getByLabel("緯度", { exact: true })).toHaveValue("25.033");
  await expect(page.getByLabel("經度", { exact: true })).toHaveValue(
    "121.5358",
  );
  await expect(
    page.getByLabel("確認使用模擬測試位置，非實測 GPS"),
  ).not.toBeChecked();
});

test("demo drafts remain separate by waste type and marking never silently truncates the description", async ({
  page,
}, testInfo) => {
  await apiFixture(page);
  await login(page, "citizen", `report/${binId}`);
  const longDescription = "測".repeat(500);
  await page
    .getByRole("textbox", { name: "說明", exact: true })
    .fill(longDescription);
  await page
    .getByRole("button", { name: "使用此桶座標（模擬 GPS）", exact: true })
    .click();
  await page.getByRole("button", { name: "產生示意照片", exact: true }).click();
  await page.getByLabel("確認使用模擬測試位置，非實測 GPS").check();
  await expect(page.getByRole("alert")).toContainText("超過 500 字");
  await expect(
    page.getByRole("textbox", { name: "說明", exact: true }),
  ).toHaveValue(longDescription);
  await expect(
    page.getByRole("button", { name: "確認送出回報", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "說明", exact: true })
    .fill("測試回報");
  await expect(
    page.getByRole("button", { name: "確認送出回報", exact: true }),
  ).toBeEnabled();
  await page.getByRole("radio", { name: "資源回收" }).click();
  await expect(page.getByRole("radio", { name: "資源回收" })).toBeChecked();
  await expect(page.getByLabel("緯度", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("img", { name: "待送出的模擬測試照片" }),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: "一般垃圾" }).click();
  await expect(page.getByRole("radio", { name: "一般垃圾" })).toBeChecked();
  await expect(page.getByLabel("緯度", { exact: true })).toHaveValue("25.033");
  await expect(
    page.getByRole("img", { name: "待送出的模擬測試照片" }),
  ).toBeVisible();
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath(`api-report-demo-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
