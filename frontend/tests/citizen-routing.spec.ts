import { test, expect } from "@playwright/test";
import { apiFixture, binId, location, status } from "./api-fixtures";

const endpoint = "https://valhalla1.openstreetmap.de/route";
const usable = {
  ...status,
  is_usable: true,
  unavailable_reasons: [],
  fill_level_pct: 20,
  fill_status: "hungry",
};
function road(costing: string) {
  return {
    trip: {
      status: 0,
      units: "kilometers",
      summary: { length: 0.8, time: 300 },
      legs: [
        {
          shape: "_x{vn@gx}xfFu@|@qFCcAjA",
          summary: { length: 0.8, time: 300 },
          maneuvers: [
            {
              type: 10,
              instruction: "Turn right",
              street_names: ["信義路"],
              length: 0.8,
              travel_type:
                costing === "pedestrian"
                  ? "foot"
                  : costing === "auto"
                    ? "car"
                    : "motor_scooter",
            },
          ],
        },
      ],
    },
  };
}
async function setup(page: Parameters<typeof apiFixture>[0]) {
  await apiFixture(page, async (route, path) => {
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location,
          status: usable,
          can_report: false,
          latest_cleanup: null,
          adopter: null,
        },
      });
      return true;
    }
  });
}
test("citizen navigation plans walking scooter and car road geometry and has no QR", async ({
  page,
}, info) => {
  await setup(page);
  const modes: string[] = [];
  await page.route(endpoint, async (route) => {
    const body = route.request().postDataJSON();
    modes.push(body.costing);
    expect(route.request().headers().authorization).toBeUndefined();
    expect(body.locations).toHaveLength(2);
    await route.fulfill({ json: road(body.costing) });
  });
  await page.goto(`/#nav/${binId}`);
  for (const [value, label, costing] of [
    ["walk", "步行", "pedestrian"],
    ["scooter", "機車", "motor_scooter"],
    ["car", "汽車", "auto"],
  ]) {
    await page.getByLabel("交通方式", { exact: true }).selectOption(value);
    await expect(
      page.getByRole("heading", { name: `${label}導航`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "道路路線摘要" }),
    ).toContainText("800 公尺");
    await expect(page.locator(".road-route")).toHaveCount(1);
    await expect(page.locator(".demo-route")).toHaveCount(0);
    expect(modes).toContain(costing);
  }
  await expect(page.getByRole("img", { name: /QR/ })).toHaveCount(0);
  await expect(page.getByText(/QR 只分享/)).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("citizen-road.png"),
    fullPage: true,
  });
});
test("road service failure has no synthetic line and supports an explicit retry", async ({
  page,
}) => {
  await setup(page);
  let fail = true;
  await page.route(endpoint, (route) =>
    fail
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: road("pedestrian") }),
  );
  await page.goto(`/#nav/${binId}`);
  await expect(page.getByRole("alert")).toContainText("目前無法取得道路路線");
  await expect(page.locator(".road-route, .demo-route")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "重新規劃路線" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
});
