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
  const foot = costing === "pedestrian" ? "foot" : "other";
  return {
    trip: {
      status: 0,
      units: "kilometers",
      summary: { length: 0.8, time: 300 },
      legs: [
        {
          // 解碼後 4 個點；maneuver 以 begin_shape_index 對應。
          shape: "_x{vn@gx}xfFu@|@qFCcAjA",
          summary: { length: 0.8, time: 300 },
          maneuvers: [
            {
              type: 1,
              instruction: "Walk north.",
              street_names: ["信義路"],
              length: 0.3,
              begin_shape_index: 0,
              travel_type: foot,
            },
            {
              type: 10,
              instruction: "Turn right",
              street_names: ["新生南路"],
              length: 0.5,
              begin_shape_index: 2,
              travel_type: foot,
            },
            {
              type: 4,
              instruction: "You have arrived",
              length: 0,
              begin_shape_index: 3,
              travel_type: foot,
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
test("citizen navigation is walking only, shows an orange route with turn list and simulated navigation, and has no QR", async ({
  page,
}, info) => {
  await setup(page);
  const costings: string[] = [];
  await page.route(endpoint, async (route) => {
    const body = route.request().postDataJSON();
    costings.push(body.costing);
    expect(route.request().headers().authorization).toBeUndefined();
    expect(body.locations).toHaveLength(2);
    await route.fulfill({ json: road(body.costing) });
  });
  await page.goto(`/#nav/${binId}`);
  await expect(
    page.getByRole("heading", { name: "步行導航", exact: true }),
  ).toBeVisible();
  // 沒有交通方式切換，也沒有機車／汽車選項。
  await expect(page.getByLabel("交通方式", { exact: true })).toHaveCount(0);
  await expect(page.getByText("機車", { exact: true })).toHaveCount(0);
  await expect(page.getByText("汽車", { exact: true })).toHaveCount(0);
  const summary = page.getByLabel("步行路線摘要");
  await expect(summary).toContainText("800 公尺");
  await expect(summary).toContainText("5 分鐘");
  // 路線＝深色外框＋橘色主線（走過／剩下各一組）；沒有舊虛線或清潔員路線樣式。
  await expect(page.locator(".nav-route-line.remaining")).toHaveCount(1);
  await expect(page.locator(".nav-route-casing.remaining")).toHaveCount(1);
  await expect(page.locator(".demo-route, .road-route")).toHaveCount(0);
  const line = page.locator(".nav-route-line.remaining");
  expect(await line.evaluate((el) => getComputedStyle(el).strokeWidth)).toBe(
    "7px",
  );
  expect(
    await page
      .locator(".nav-route-casing.remaining")
      .evaluate((el) => getComputedStyle(el).strokeWidth),
  ).toBe("11px");
  expect(await line.evaluate((el) => getComputedStyle(el).strokeLinecap)).toBe(
    "round",
  );
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--route")
        .trim(),
    ),
  ).toBe("#f2673a");
  await expect(page.locator(".nav-start")).toHaveCount(1);
  // 逐步轉彎指示：預設收合，可用鍵盤展開，列表有標題。
  const toggle = page.getByRole("button", { name: /路線指示/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const steps = page.getByRole("region", { name: "逐步轉彎指示" });
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await expect(steps.getByRole("listitem").first()).toContainText(
    "沿信義路往前 300 公尺後右轉，進入新生南路",
  );
  await expect(steps.getByRole("listitem").last()).toContainText("抵達目的桶");
  await page.screenshot({
    path: info.outputPath("citizen-nav-steps.png"),
  });
  // 模擬開始導航：頂部指示條、走過變淡、最後顯示已抵達。
  await page.getByRole("button", { name: "開始導航" }).click();
  await expect(page.getByTestId("nav-banner")).toContainText("右轉");
  await expect(page.locator(".nav-route-line.walked")).toHaveCount(1);
  await expect(page.locator(".gnav-arrived")).toHaveText("已抵達目的桶", {
    timeout: 15000,
  });
  await expect(page.getByTestId("nav-banner")).toContainText("已抵達");
  await expect(page.getByRole("img", { name: /QR/ })).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("citizen-road.png"),
    fullPage: true,
  });
  expect(new Set(costings)).toEqual(new Set(["pedestrian"]));
});
test("reduced motion hops between turns instead of animating continuously", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.route(endpoint, (route) =>
    route.fulfill({ json: road("pedestrian") }),
  );
  await page.goto(`/#nav/${binId}`);
  await page.getByRole("button", { name: "開始導航" }).click();
  await expect(page.getByTestId("nav-banner")).toContainText("右轉");
  await expect(page.locator(".gnav-arrived")).toBeVisible({ timeout: 8000 });
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
  await expect(
    page.locator(".nav-route-line, .road-route, .demo-route"),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "重新規劃路線" }).click();
  await expect(page.locator(".nav-route-line.remaining")).toHaveCount(1);
});

test("changing the waste type cancels the old route request and replaces the route", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let aborted = 0;
  page.on("requestfailed", (request) => {
    if (request.url() === endpoint) aborted++;
  });
  await page.route(endpoint, async (route) => {
    // 換種類前的請求一直卡住，直到換完才放行；被取消的請求不能再畫出路線。
    await gate;
    await route.fulfill({ json: road("pedestrian") }).catch(() => {});
  });
  await page.goto(`/#nav/${binId}`);
  await expect(page.getByText("正在規劃步行道路路線…")).toBeVisible();
  await expect(page.locator(".nav-route-line")).toHaveCount(0);
  await page.getByRole("radio", { name: "資源回收" }).check();
  await expect(page).toHaveURL(/waste_type=recycling/);
  release();
  await expect(page.locator(".nav-route-line.remaining")).toHaveCount(1);
  await expect.poll(() => aborted).toBeGreaterThan(0);
});

// ── 手機：步行導航資訊卡是跟地圖頁一樣的底部抽屜，一顆「結束導航」回到桶詳情 ──
async function phoneNav(page: Parameters<typeof apiFixture>[0]) {
  await page.setViewportSize({ width: 412, height: 780 });
  const parts = ["general", "recycling"].map((waste_type) => ({
    ...usable,
    waste_type,
  }));
  await apiFixture(page, async (route, path) => {
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location: { ...location, bin_status: usable, compartments: parts },
          status: usable,
          compartments: parts,
          can_report: false,
          latest_cleanup: null,
          adopter: null,
        },
      });
      return true;
    }
    if (path === "/map/locations") {
      await route.fulfill({
        json: {
          items: [{ ...location, bin_status: usable, compartments: parts }],
          page: { limit: 100, offset: 0, total: 1 },
        },
      });
      return true;
    }
  });
  await page.route(endpoint, (route) =>
    route.fulfill({ json: road("pedestrian") }),
  );
  await page.goto(`/#nav/${binId}?waste_type=recycling`);
  await expect(page.getByRole("button", { name: "開始導航" })).toBeVisible();
}
const sheetHeight = (page: Parameters<typeof apiFixture>[0]) =>
  page
    .locator(".gnav-card")
    .evaluate((el) => el.getBoundingClientRect().height);

test("phone: the navigation card is a bottom drawer with a handle, half by default and draggable to full and back", async ({
  page,
}) => {
  await phoneNav(page);
  const layout = page.locator(".gnav");
  const handle = page.locator(".gnav .mx-handle");
  await expect(handle).toBeVisible();
  await expect(layout).toHaveAttribute("data-drawer", "half");
  const box = (await layout.boundingBox())!;
  await expect
    .poll(() => sheetHeight(page))
    .toBeLessThanOrEqual(box.height * 0.5 + 1);
  // 地圖滿版，抽屜疊在地圖上。
  const map = (await page.locator(".gnav-map").boundingBox())!;
  expect(Math.abs(map.height - box.height)).toBeLessThan(2);
  // 往上拖到全開，再往下拖回半開。
  const h = (await handle.boundingBox())!;
  const x = h.x + h.width / 2;
  await page.mouse.move(x, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect(layout).toHaveAttribute("data-drawer", "full");
  await expect.poll(() => sheetHeight(page)).toBeGreaterThan(box.height - 40);
  const top = (await handle.boundingBox())!;
  await page.mouse.move(x, top.y + top.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect(layout).toHaveAttribute("data-drawer", "half");
  // 舊的兩個小字連結已合併成一顆按鈕。
  await expect(page.getByRole("link", { name: "返回桶詳情" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "結束導航" })).toHaveCount(0);
});

test("phone: starting navigation collapses the drawer, 結束導航 stays visible and returns to the bin detail", async ({
  page,
}) => {
  // 減少動態效果時每 1.5 秒跳一個轉彎點，收起狀態才量得到（測試路線很短）。
  await page.emulateMedia({ reducedMotion: "reduce" });
  await phoneNav(page);
  await page.getByRole("button", { name: "開始導航" }).click();
  await expect(page.locator(".gnav")).toHaveAttribute(
    "data-drawer",
    "collapsed",
  );
  await expect(page.getByTestId("nav-banner")).toBeVisible();
  const end = page.getByRole("button", { name: "結束導航", exact: true });
  await expect(end).toBeVisible();
  const box = (await end.boundingBox())!;
  const tabs = (await page.locator(".m-tabs").boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(tabs.y);
  expect(box.height).toBeGreaterThanOrEqual(44);
  // 收起時資訊卡內容不可操作，抽屜只露出標題列。
  await expect(page.locator(".gnav-body")).toHaveAttribute("inert", "");
  expect(await sheetHeight(page)).toBeLessThan(140);
  await end.click();
  await expect(page).toHaveURL(
    new RegExp(`#bin/${binId}\\?waste_type=recycling$`),
  );
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "bin");
  await expect(page.locator(".mx-layout")).toHaveAttribute(
    "data-drawer",
    "half",
  );
  await expect(page.locator(".mx-map .leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon.selected")).toHaveCount(1);
  await expect(page.getByTestId("nav-banner")).toHaveCount(0);
});

test("phone: Esc ends navigation like the 結束導航 button", async ({
  page,
}) => {
  await phoneNav(page);
  await page.getByRole("button", { name: "開始導航" }).click();
  await expect(page.getByTestId("nav-banner")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(
    new RegExp(`#bin/${binId}\\?waste_type=recycling$`),
  );
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "bin");
  await expect(page.locator(".mx-map .leaflet-container")).toBeVisible();
});
