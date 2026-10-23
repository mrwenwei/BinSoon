import { test, expect } from "@playwright/test";
test("local booking lifecycle and crew collection without API", async ({
  page,
}) => {
  const drivingRequests: {
    costing: string;
    locations: { lat: number; lon: number }[];
  }[] = [];
  await page.route(
    "https://valhalla1.openstreetmap.de/route",
    async (route) => {
      drivingRequests.push(route.request().postDataJSON());
      await route.fulfill({
        json: {
          trip: {
            status: 0,
            units: "kilometers",
            summary: { length: 1.8, time: 300 },
            legs: [
              {
                shape: "_x{vn@gx}xfFu@|@qFCcAjA}ACcA?qDEHuJ",
                summary: { length: 1.8, time: 300 },
                maneuvers: [
                  {
                    type: 10,
                    instruction: "Turn right",
                    street_names: ["信義路"],
                    length: 1.8,
                    travel_type: "car",
                  },
                ],
              },
            ],
          },
        },
      });
    },
  );
  const api: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/v1/")) api.push(r.url());
  });
  await page.clock.setFixedTime(new Date("2026-10-23T08:00:00Z"));
  await page.goto("/#van");
  await expect(
    page.getByRole("region", { name: "台北位置地圖" }),
  ).toBeVisible();
  await expect(page.locator(".van-stop-icon")).toHaveCount(5);
  await page.getByRole("button", { name: "永康街口", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".van-choice").filter({ hasText: "永康街口" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "東門站 5 號出口", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".van-dates button")).toHaveCount(7);
  await expect(page.locator(".van-dates button").first()).toContainText(
    "10/24",
  );
  await expect(page.locator(".van-dates button").last()).toContainText("10/30");
  await page.getByRole("button", { name: /^預約 ·/ }).click();
  await expect(
    page.getByRole("heading", { name: "我的清運預約" }),
  ).toBeVisible();
  await expect(page.locator(".van-detail")).toContainText("7");
  await page.reload();
  await page.locator(".van-booking").click();
  await page.getByRole("button", { name: "修改預約" }).click();
  await page.locator(".van-choice").filter({ hasText: "永康街口" }).click();
  await page.getByRole("button", { name: /^預約 ·/ }).click();
  await expect(page.locator(".van-detail")).toContainText("永康街口");
  await page.goto("/#crew/van");
  await expect(
    page.getByRole("heading", { name: "清運小車班表" }),
  ).toBeVisible();
  await expect(page.locator(".van-content")).toContainText("43 人");
  await page.getByRole("button", { name: "開始導航 · 第 1 站" }).click();
  await expect(page.locator(".van-map-navigation .road-route")).toBeVisible();
  await expect(page.getByText("約 5 分鐘 · 1.8 km")).toBeVisible();
  await page.getByRole("button", { name: "✓ 到站了，開始收運" }).click();
  expect(drivingRequests[0].costing).toBe("auto");
  await expect(page.locator(".van-collect")).toContainText("剩 15 分鐘");
  await page.clock.setFixedTime(new Date("2026-10-23T08:01:00Z"));
  await expect(page.locator(".van-collect")).toContainText("剩 14 分鐘");
  await page.getByRole("button", { name: "本站完成，導航到第 2 站" }).click();
  await expect(
    page.getByRole("heading", { name: "導航到第 2 站" }),
  ).toBeVisible();
  await expect(page.locator(".road-route")).toBeVisible();
  expect(drivingRequests.at(-1)!.costing).toBe("auto");
  expect(drivingRequests.at(-1)!.locations[0]).toMatchObject(
    drivingRequests[0].locations[1],
  );
  await page.goto("/#van");
  await page.locator(".van-booking").click();
  await page.getByRole("button", { name: "取消預約" }).click();
  await expect(page.locator(".van-booking")).toHaveCount(0);
  expect(api).toEqual([]);
});
test("van layout has no horizontal overflow", async ({ page }, info) => {
  await page.goto("/#van");
  await expect(
    page.getByRole("heading", { name: "預約清運小車" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/van-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/#crew/van");
  await page.screenshot({
    path: `test-results/van-crew-${info.project.name}.png`,
    fullPage: true,
  });
});

test("car route failure offers retry without drawing a fallback line", async ({
  page,
}) => {
  await page.route("https://valhalla1.openstreetmap.de/route", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/#crew/van");
  await page.getByRole("button", { name: "開始導航 · 第 1 站" }).click();
  await expect(page.getByRole("alert")).toContainText("目前無法取得汽車路線");
  await expect(page.locator(".road-route, .demo-route")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "✓ 到站了，開始收運" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "重新取得路線" }),
  ).toBeVisible();
});
