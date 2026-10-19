import { test, expect } from "@playwright/test";
import { parseCrewRoute } from "../src/data/crewRouting";

const endpoint = "https://valhalla1.openstreetmap.de/route";
const shape =
  "_x{vn@gx}xfFu@|@qFCcAjA}ACcA?qDEHuJ`AqvAAmIhEDny@v@dED|CAxUJpUHbWHtY^nm@lAzG@rUFlZ@|A?`DDfD@`i@RlWJx@?`pBn@lEgAe@~G_Hx_A}HdgACv@k@lGiGo@aMy@{LMqN`@yO|AqTpD_p@lPsCr@sa@nJwQtF_UzF_GzCmn@tOqCl@kDAoCt@k|@~T";

function routeResponse(costing: string, count: number, length = 2.4) {
  return {
    trip: {
      status: 0,
      units: "kilometers",
      summary: { length, time: 480 },
      legs: Array.from({ length: count }, () => ({
        shape,
        summary: { length: 0.6, time: 120 },
        maneuvers: [
          {
            type: 10,
            instruction: "Turn right onto 信義路三段.",
            street_names: ["信義路三段"],
            length: 0.6,
            time: 120,
            travel_type: costing === "auto" ? "car" : "motor_scooter",
          },
        ],
      })),
    },
  };
}

test("crew routes use the selected vehicle, display road geometry and invalidate directions when the mode changes", async ({
  page,
}, testInfo) => {
  const requests: { costing: string; locations: unknown[] }[] = [];
  await page.route(endpoint, async (route) => {
    const request = route.request().postDataJSON();
    requests.push(request);
    await route.fulfill({
      json: routeResponse(request.costing, request.locations.length - 1),
    });
  });
  await page.goto("/#staff/route");
  await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await expect(
    page.getByRole("radio", { name: "機車（一般機車）" }),
  ).toBeChecked();
  await expect(page.locator(".road-route")).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.getByText("道路里程 2.4 公里")).toBeVisible();
  await expect(page.getByText("預估行駛 8 分鐘")).toBeVisible();
  await expect(page.locator(".road-route")).toHaveCount(1);
  await expect(page.getByText("右轉，進入信義路三段").first()).toBeVisible();
  expect(requests[0].costing).toBe("motor_scooter");
  expect(requests[0].locations.length).toBe(5);
  await page.getByRole("radio", { name: "汽車" }).check();
  await expect(page.locator(".road-route")).toHaveCount(0);
  await expect(page.getByText("道路里程 2.4 公里")).toHaveCount(0);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
  expect(requests[1].costing).toBe("auto");
  expect(requests[1].locations).toEqual(requests[0].locations);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("crew-vehicle-route.png"),
    fullPage: true,
  });
  await page
    .locator(".staff-route-list")
    .getByRole("link", { name: /查看工單/ })
    .first()
    .click();
  await page.getByRole("link", { name: "清運路線", exact: true }).click();
  await expect(page.getByRole("radio", { name: "汽車" })).toBeChecked();
  expect(requests).toHaveLength(2);
});

test("a routing failure preserves stop access without presenting straight lines as navigation", async ({
  page,
}) => {
  await page.route(endpoint, (route) =>
    route.fulfill({ status: 503, json: { error: "unavailable" } }),
  );
  await page.goto("/#staff/route");
  await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.getByRole("alert")).toContainText("目前無法取得道路路線");
  await expect(page.locator(".road-route")).toHaveCount(0);
  await expect(
    page.locator(".staff-route-list").getByRole("link", { name: /查看工單/ }),
  ).toHaveCount(4);
  await expect(page.locator(".crew-route-placeholder")).toHaveCount(2);
});

test("a late response for the previous vehicle never replaces the current route", async ({
  page,
}) => {
  let release!: () => void;
  let finished!: () => void;
  const pending = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route(endpoint, async (route) => {
    const request = route.request().postDataJSON();
    if (request.costing === "motor_scooter") {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        await route.fulfill({
          json: routeResponse(request.costing, request.locations.length - 1),
        });
      } finally {
        finished();
      }
    } else
      await route.fulfill({
        json: routeResponse(request.costing, request.locations.length - 1, 9.1),
      });
  });
  await page.goto("/#staff/route");
  await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  const started = page.waitForRequest(endpoint);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await started;
  await page.getByRole("radio", { name: "汽車" }).check();
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.getByText("道路里程 9.1 公里")).toBeVisible();
  release();
  await pending;
  await expect(page.getByText("道路里程 9.1 公里")).toBeVisible();
  await expect(page.getByText("道路里程 2.4 公里")).toHaveCount(0);
});

test("finishing a stop in another tab invalidates its previous road guidance", async ({
  page,
  context,
}) => {
  await page.route(endpoint, (route) => {
    const request = route.request().postDataJSON();
    return route.fulfill({
      json: routeResponse(request.costing, request.locations.length - 1),
    });
  });
  await page.goto("/#staff/route");
  await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
  const crew = await context.newPage();
  await crew.goto("/#staff/tasks");
  await crew.locator(".staff-task-card").filter({ hasText: "很髒" }).click();
  await crew.getByRole("button", { name: "接單", exact: true }).click();
  await crew.getByRole("button", { name: "示範已到場" }).click();
  await crew.getByRole("button", { name: "確認屬實", exact: true }).click();
  await crew.getByRole("button", { name: "拍一張完成示意照片" }).click();
  await crew.getByRole("button", { name: "提交完成證據" }).click();
  await expect(crew.getByTestId("task-status")).toHaveText("處理完成");
  await expect(
    page.locator(".staff-route-list").getByRole("link", { name: /查看工單/ }),
  ).toHaveCount(3);
  await expect(page.locator(".road-route")).toHaveCount(0);
  await expect(page.getByText("道路里程 2.4 公里")).toHaveCount(0);
});

test("road response decoding preserves numeric latitudes and longitudes at polyline6 precision", () => {
  const route = parseCrewRoute(routeResponse("motor_scooter", 1), "scooter", 1);
  expect(route.geometry.length).toBeGreaterThan(20);
  expect(route.geometry[0][0]).toBeCloseTo(25.033, 2);
  expect(route.geometry[0][1]).toBeCloseTo(121.536, 2);
  expect(route.meters).toBe(2400);
  expect(route.seconds).toBe(480);
  expect(route.legs[0].steps[0].instruction).toBe("右轉，進入信義路三段");
});

test("partial or mismatched vehicle responses cannot be shown as valid guidance", () => {
  expect(() => parseCrewRoute(routeResponse("auto", 1), "scooter", 1)).toThrow(
    /車種/,
  );
  expect(() => parseCrewRoute(routeResponse("auto", 1), "car", 2)).toThrow(
    /完整/,
  );
  const payload = routeResponse("auto", 1);
  payload.trip.legs[0].shape = "_";
  expect(() => parseCrewRoute(payload, "car", 1)).toThrow();
  payload.trip.legs[0].shape = shape;
  payload.trip.summary.length = -1;
  expect(() => parseCrewRoute(payload, "car", 1)).toThrow(/距離或時間/);
});

test("keyboard vehicle selection works and planning feedback keeps the map in place", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  await page.route(endpoint, async (route) => {
    const request = route.request().postDataJSON();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      json: routeResponse(request.costing, request.locations.length - 1),
    });
  });
  await page.goto("/#staff/route");
  await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await page.getByRole("radio", { name: "機車（一般機車）" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "汽車", exact: true }),
  ).toBeChecked();
  await page.evaluate(() => document.fonts.ready);
  const mapTop = () =>
    page
      .locator(".crew-route-map-panel")
      .evaluate(
        (element) => element.getBoundingClientRect().top + window.scrollY,
      );
  const initial = await mapTop();
  const started = page.waitForRequest(endpoint);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await started;
  await expect(
    page.getByRole("status").filter({ hasText: "正在取得汽車道路路線" }),
  ).toBeVisible();
  expect(Math.abs((await mapTop()) - initial)).toBeLessThan(2);
  release();
  await expect(page.locator(".road-route")).toHaveCount(1);
  expect(Math.abs((await mapTop()) - initial)).toBeLessThan(2);
  const summary = page.locator(".crew-route-stop summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".crew-route-stop details").first(),
  ).not.toHaveAttribute("open");
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".crew-route-stop details").first(),
  ).toHaveAttribute("open", "");
});
