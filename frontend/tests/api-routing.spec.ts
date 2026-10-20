import { resolutionFixture } from "./api-resolution-fixture";
import { test, expect } from "@playwright/test";
import {
  apiFixture,
  binId,
  workId,
  login,
  logoutButton,
  arrivedWork,
  location,
} from "./api-fixtures";
const endpoint = "https://valhalla1.openstreetmap.de/route";
const secondWork = "30000000-0000-4000-8000-000000000002";
const secondBin = "10000000-0000-4000-8000-000000000002";
const thirdWork = "30000000-0000-4000-8000-000000000003";
const origin = { latitude: 25.0321, longitude: 121.5341, source: "demo_fixed" };
const stops = [
  {
    bin_id: secondBin,
    label: "優先回收站",
    latitude: 25.035,
    longitude: 121.537,
    work_order_ids: [thirdWork],
    waste_types: ["recycling"],
    priority: "high",
  },
  {
    bin_id: binId,
    label: "一般與回收合站",
    latitude: 25.033,
    longitude: 121.5358,
    work_order_ids: [workId, secondWork],
    waste_types: ["general", "recycling"],
    priority: "normal",
  },
];
function road(costing: string, count: number, length = 2.4) {
  return {
    trip: {
      status: 0,
      units: "kilometers",
      summary: { length, time: 480 },
      legs: Array.from({ length: count }, () => ({
        shape: "_x{vn@gx}xfFu@|@qFCcAjA",
        summary: { length: 1.2, time: 240 },
        maneuvers: [
          {
            type: 10,
            instruction: "Turn right",
            street_names: ["信義路"],
            length: 1.2,
            travel_type: costing === "auto" ? "car" : "motor_scooter",
          },
        ],
      })),
    },
  };
}
test("staff uses the API origin and ordered combined stops for both vehicles and opens each distinct work order", async ({
  page,
}, testInfo) => {
  const reads: string[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/staff/work-orders/${workId}`) {
      await route.fulfill({
        headers: { ETag: '"v1"' },
        json: {
          work_order: {
            ...arrivedWork,
            status: "pending",
            assigned_staff_id: null,
            arrived_at: null,
          },
          location,
          reports: [],
          evidence: [],
          completion: null,
          latest_reading: null,
          completion_requirements: {
            missing: ["arrived", "completion_photo", "work_submitted"],
          },
        },
      });
      return true;
    }
    if (path === "/staff/route-stops") {
      reads.push(route.request().headers().authorization);
      await route.fulfill({
        json: { origin, stops, generated_at: "2026-10-19T10:00:00Z" },
      });
      return true;
    }
  });
  const roads: any[] = [];
  await page.route(endpoint, async (route) => {
    const body = route.request().postDataJSON();
    roads.push({ body, headers: route.request().headers() });
    await route.fulfill({
      json: road(body.costing, body.locations.length - 1),
    });
  });
  await login(page, "staff", "staff/route");
  await expect(
    page.getByRole("heading", { name: "今日示範清運路線" }),
  ).toBeVisible();
  await expect(page.locator(".crew-route-stop h3")).toHaveText([
    "優先回收站",
    "一般與回收合站",
  ]);
  await expect(page.locator(".crew-stop-actions a")).toHaveCount(3);
  await expect(page.getByText("一般垃圾、資源回收")).toBeVisible();
  expect(roads).toHaveLength(0);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
  await expect(page.getByText("道路里程 2.4 公里")).toBeVisible();
  expect(roads[0].body.locations).toEqual([
    { lat: 25.0321, lon: 121.5341, type: "break" },
    { lat: 25.035, lon: 121.537, type: "break" },
    { lat: 25.033, lon: 121.5358, type: "break" },
  ]);
  expect(roads[0].headers.authorization).toBeUndefined();
  expect(JSON.stringify(roads[0].body)).not.toContain(workId);
  expect(roads[0].body.costing).toBe("motor_scooter");
  await page.getByRole("radio", { name: "機車（一般機車）" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".road-route")).toHaveCount(0);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
  expect(roads[1].body.costing).toBe("auto");
  expect(reads.every((token) => token === "Bearer fixture-staff")).toBe(true);
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `../.scratch/frontend-api-integration/api-route-${testInfo.project.name}.png`,
    fullPage: true,
  });
  const actions = page.locator(".crew-stop-actions a");
  await expect(actions.nth(1)).toHaveAttribute(
    "href",
    `#staff/tasks/${workId}`,
  );
  await expect(actions.nth(2)).toHaveAttribute(
    "href",
    `#staff/tasks/${secondWork}`,
  );
  await actions.nth(1).click();
  await expect(
    page.getByRole("button", { name: "接單", exact: true }),
  ).toBeVisible();
});

test("server work changes invalidate a route even when its bin stays, while a new generated_at alone preserves it", async ({
  page,
}) => {
  let current = structuredClone(stops);
  let generation = 0;
  await apiFixture(page, async (route, path) => {
    if (path === "/staff/route-stops") {
      await route.fulfill({
        json: {
          origin,
          stops: current,
          generated_at: `2026-10-19T10:00:0${generation++}Z`,
        },
      });
      return true;
    }
  });
  let release!: () => void;
  let finished!: () => void;
  const pending = new Promise<void>((resolve) => (finished = resolve));
  let roadCalls = 0;
  await page.route(endpoint, async (route) => {
    const body = route.request().postDataJSON();
    if (++roadCalls === 2)
      await new Promise<void>((resolve) => (release = resolve));
    try {
      await route.fulfill({
        json: road(body.costing, body.locations.length - 1),
      });
    } finally {
      if (roadCalls === 2) finished();
    }
  });
  await login(page, "staff", "staff/route");
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
  await page.getByRole("button", { name: "更新待辦站點" }).click();
  await expect(
    page.getByRole("button", { name: "更新待辦站點" }),
  ).toBeEnabled();
  await expect(page.locator(".road-route")).toHaveCount(1);
  const started = page.waitForRequest(endpoint);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await started;
  current[1].work_order_ids = [secondWork];
  await page.getByRole("button", { name: "更新待辦站點" }).click();
  await expect(page.locator(".crew-stop-actions a")).toHaveCount(2);
  release();
  await pending;
  await expect(page.locator(".road-route")).toHaveCount(0);
  await expect(page.getByText("道路里程 2.4 公里")).toHaveCount(0);
  current = [];
  await page.getByRole("button", { name: "更新待辦站點" }).click();
  await expect(page.getByText("今日已無待清運站點。")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "產生路線指引" }),
  ).toBeDisabled();
});

test("recycling filtering and vehicle changes discard delayed routes without borrowing citizen availability", async ({
  page,
}) => {
  const filters: (string | null)[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/staff/route-stops") {
      const waste = new URL(route.request().url()).searchParams.get(
        "waste_type",
      );
      filters.push(waste);
      await route.fulfill({
        json: {
          origin,
          stops: waste ? [stops[0]] : stops,
          generated_at: "2026-10-19T10:00:00Z",
        },
      });
      return true;
    }
  });
  let release!: () => void;
  const calls: any[] = [];
  await page.route(endpoint, async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    if (body.costing === "motor_scooter")
      await new Promise<void>((resolve) => (release = resolve));
    await route.fulfill({
      json: road(
        body.costing,
        body.locations.length - 1,
        body.costing === "auto" ? 9.1 : 2.4,
      ),
    });
  });
  await login(page, "staff", "staff/route");
  const started = page.waitForRequest(endpoint);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await started;
  await page.getByLabel("垃圾種類", { exact: true }).selectOption("recycling");
  await expect(page.locator(".crew-route-stop h3")).toHaveText(["優先回收站"]);
  await page.getByRole("radio", { name: "汽車", exact: true }).check();
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.getByText("道路里程 9.1 公里")).toBeVisible();
  release();
  await expect(page.getByText("道路里程 9.1 公里")).toBeVisible();
  expect(filters).toContain("recycling");
  expect(calls[1].locations).toHaveLength(2);
  await page.getByRole("link", { name: "← 返回派工清單" }).click();
  await page.getByRole("link", { name: "道路指引", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "汽車", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".road-route")).toHaveCount(0);
});

test("routing rate limits and timeouts leave all work links available and never draw straight line navigation", async ({
  page,
}) => {
  await page.clock.install();
  await apiFixture(page, async (route, path) => {
    if (path === "/staff/route-stops") {
      await route.fulfill({
        json: { origin, stops, generated_at: "2026-10-19T10:00:00Z" },
      });
      return true;
    }
  });
  let mode = "rate";
  await page.route(endpoint, async (route) => {
    if (mode === "rate")
      await route.fulfill({ status: 429, json: { error: "rate limited" } });
    else
      await new Promise<void>((resolve) => {
        route
          .request()
          .response()
          .then(() => resolve())
          .catch(() => resolve());
      });
  });
  await login(page, "staff", "staff/route");
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.getByRole("alert")).toContainText("路線服務忙碌");
  await expect(page.locator(".crew-stop-actions a")).toHaveCount(3);
  await expect(page.locator(".road-route,.demo-route")).toHaveCount(0);
  mode = "timeout";
  await page.clock.fastForward(1500);
  const started = page.waitForRequest(endpoint);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await started;
  await page.clock.fastForward(21000);
  await expect(page.getByRole("alert")).toContainText("路線服務逾時");
  await expect(page.locator(".crew-stop-actions a")).toHaveCount(3);
  await expect(page.locator(".crew-route-placeholder")).toHaveCount(2);
});

test("a failed station refresh retains work access but invalidates guidance until a fresh manual plan", async ({
  page,
}) => {
  let failed = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/staff/route-stops") {
      await route.fulfill(
        failed
          ? {
              status: 503,
              json: {
                detail: {
                  code: "UNAVAILABLE",
                  message: "站點暫不可用",
                  fields: [],
                },
              },
            }
          : { json: { origin, stops, generated_at: "2026-10-19T10:00:00Z" } },
      );
      return true;
    }
  });
  await page.route(endpoint, (route) =>
    route.fulfill({ json: road(route.request().postDataJSON().costing, 2) }),
  );
  await login(page, "staff", "staff/route");
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
  failed = true;
  await page.getByRole("button", { name: "更新待辦站點" }).click();
  await expect(page.getByRole("alert")).toContainText("站點暫不可用");
  await expect(page.locator(".crew-stop-actions a")).toHaveCount(3);
  await expect(page.locator(".road-route")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "產生路線指引" }),
  ).toBeDisabled();
  failed = false;
  await page.getByRole("button", { name: "重新載入", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "更新待辦站點" }),
  ).toBeEnabled();
  await expect(page.locator(".road-route")).toHaveCount(0);
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
});

test("route access requires a staff session and expiry never leaves personal stops behind", async ({
  page,
}) => {
  let failure = 0;
  let reads = 0;
  await apiFixture(page, async (route, path) => {
    if (path === "/staff/route-stops") {
      reads++;
      await route.fulfill(
        failure
          ? {
              status: failure,
              json: {
                detail: {
                  code: "DENIED",
                  message: "工作階段或權限失效",
                  fields: [],
                },
              },
            }
          : { json: { origin, stops, generated_at: "2026-10-19T10:00:00Z" } },
      );
      return true;
    }
  });
  await login(page, "citizen", "staff/route");
  await expect(
    page.getByRole("link", { name: "隊員登入", exact: true }),
  ).toHaveAttribute("href", "#staff/login?next=staff%2Froute");
  expect(reads).toBe(0);
  await login(page, "admin", "staff/route");
  await expect(
    page.getByRole("link", { name: "隊員登入", exact: true }),
  ).toBeVisible();
  expect(reads).toBe(0);
  failure = 403;
  await login(page, "staff", "staff/route");
  await expect(page.getByRole("alert")).toContainText("工作階段或權限失效");
  await expect(page.locator(".crew-route-stop")).toHaveCount(0);
  failure = 0;
  await page.getByRole("button", { name: "重新載入", exact: true }).click();
  await expect(page.locator(".crew-route-stop")).toHaveCount(2);
  failure = 401;
  await page.getByRole("button", { name: "更新待辦站點" }).click();
  await expect(
    page.getByRole("link", { name: "隊員登入", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".crew-route-stop")).toHaveCount(0);
  failure = 0;
  await page.getByRole("link", { name: "隊員登入", exact: true }).click();
  await page
    .getByLabel("密碼", { exact: true })
    .fill("fixture-only-not-a-real-password");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.locator(".crew-route-stop")).toHaveCount(2);
  await (await logoutButton(page)).click();
  await expect(page.locator(".crew-route-stop")).toHaveCount(0);
});

test("station refresh stops in the background and after leaving the page", async ({
  page,
}) => {
  await page.clock.install();
  let reads = 0;
  await apiFixture(page, async (route, path) => {
    if (path === "/staff/route-stops") {
      reads++;
      await route.fulfill({
        json: { origin, stops, generated_at: "2026-10-19T10:00:00Z" },
      });
      return true;
    }
  });
  await login(page, "staff", "staff/route");
  await expect(page.locator(".crew-route-stop")).toHaveCount(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = reads;
  await page.clock.fastForward(30000);
  expect(reads).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads).toBe(before + 1);
  await page.getByRole("link", { name: "← 返回派工清單" }).click();
  await expect(
    page.getByRole("heading", { name: "清潔隊工作台", exact: true }),
  ).toBeVisible();
  const after = reads;
  await page.clock.fastForward(30000);
  expect(reads).toBe(after);
});

test("finishing work in another staff tab removes the backend stop on the next foreground read", async ({
  page,
  context,
}) => {
  const f = resolutionFixture("dirty");
  f.state.completion = true;
  await f.setup(page);
  await page.clock.install();
  await page.route("**/api/v1/staff/route-stops*", (route) =>
    route.fulfill({
      json: {
        origin,
        stops: f.state.workStatus === "completed" ? [] : [stops[1]],
        generated_at: "2026-10-19T10:00:00Z",
      },
    }),
  );
  await page.route(endpoint, (route) =>
    route.fulfill({ json: road(route.request().postDataJSON().costing, 1) }),
  );
  await login(page, "staff", "staff/route");
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.locator(".road-route")).toHaveCount(1);
  const crew = await context.newPage();
  await f.setup(crew);
  await login(crew, "staff", `staff/tasks/${workId}`);
  await crew.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    crew.getByText("工單狀態：已完成", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(11000);
  await expect(page.getByText("今日已無待清運站點。")).toBeVisible();
  await expect(page.locator(".road-route")).toHaveCount(0);
});
