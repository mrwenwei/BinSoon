import { test, expect, type Page } from "@playwright/test";
import { apiFixture, binId, envelope, location } from "./api-fixtures";

// 地圖瀏覽模式：手機抽屜三段、桌面左側面板、四顆篩選＋垃圾種類、原地選桶與深連結。
const slot = (
  waste_type: "general" | "recycling",
  fill_level_pct: number,
  fill_status: string,
) => ({
  ...location.bin_status,
  waste_type,
  classification_source: "demo_assumption",
  fill_level_pct,
  fill_status,
  is_usable: fill_status === "hungry" || fill_status === "half",
  unavailable_reasons: fill_status === "full" ? ["full"] : [],
});
const bin = (
  id: string,
  label: string,
  general: [number, string],
  recycling: [number, string],
  distance: number,
) => ({
  ...location,
  id,
  label,
  distance_m: distance,
  walking_estimate_seconds: distance * 1.2,
  latitude: 25.033 + distance / 100000,
  longitude: 121.5358 + distance / 150000,
  bin_status: slot("general", ...general),
  compartments: [slot("general", ...general), slot("recycling", ...recycling)],
});
const generalFull = bin(
  binId,
  "一般滿回收空",
  [92, "full"],
  [30, "hungry"],
  120,
);
const generalOk = bin(
  "10000000-0000-4000-8000-000000000002",
  "一般空回收滿",
  [20, "hungry"],
  [88, "full"],
  260,
);
const bothFull = bin(
  "10000000-0000-4000-8000-000000000003",
  "兩槽都滿",
  [95, "full"],
  [90, "full"],
  380,
);
const proposed = {
  ...bin(
    "10000000-0000-4000-8000-000000000004",
    "建議設置點",
    [0, "unknown"],
    [0, "unknown"],
    300,
  ),
  longitude: 121.5318,
  bin_type: "proposed",
  placement_status: "proposed",
};
const landmark = {
  ...location,
  id: "place-landmark",
  kind: "place",
  label: "公園地標",
  bin_status: null,
  compartments: [],
  reported_count: 12,
  location_precision: "representative_point_only",
  source_file: "daan_hotspot_gap_screening.csv",
  bin_type: null,
  placement_status: null,
  distance_m: 200,
  walking_estimate_seconds: 240,
  latitude: 25.0305,
  longitude: 121.5335,
};
const all = [generalFull, generalOk, bothFull, proposed, landmark];

async function setup(page: Page) {
  const reads: URLSearchParams[] = [];
  await apiFixture(page, async (route, path) => {
    const params = new URL(route.request().url()).searchParams;
    if (path === "/map/locations") {
      reads.push(params);
      await route.fulfill({
        json: envelope(
          params.get("filter") === "new"
            ? [
                {
                  ...generalOk,
                  bin_status: { ...generalOk.bin_status, is_new: true },
                },
              ]
            : all,
        ),
      });
      return true;
    }
    const match = all.find((item) => path === `/bins/${item.id}/view`);
    if (match) {
      await route.fulfill({
        json: {
          location: match,
          status:
            match.compartments.find(
              (c) => c.waste_type === (params.get("waste_type") || "general"),
            ) ?? match.bin_status,
          compartments: match.compartments,
          adopter: null,
          latest_cleanup: null,
          my_adoption_id: null,
          can_apply_adoption: false,
          can_report: false,
          report_block_reason: "login_required",
        },
      });
      return true;
    }
  });
  return reads;
}
const marker = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test("phone drawer switches between collapsed, half and full", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/#map");
  const layout = page.locator(".mx-layout");
  const panel = page.locator(".mx-panel");
  const handle = page.locator(".mx-handle");
  await expect(page.locator(".mx-row")).toHaveCount(3);
  await expect(layout).toHaveAttribute("data-drawer", "half");
  const box = (await layout.boundingBox())!;
  const half = (await panel.boundingBox())!.height;
  expect(Math.abs(half - box.height / 2)).toBeLessThan(4);
  // 半開 → 全開
  await handle.click();
  await expect(layout).toHaveAttribute("data-drawer", "full");
  await expect
    .poll(async () => (await panel.boundingBox())!.height)
    .toBeGreaterThan(box.height - 20);
  // 全開時點把手回半開（收起只靠往下拖）
  await handle.click();
  await expect(layout).toHaveAttribute("data-drawer", "half");
  // 等高度動畫結束再量把手位置
  await expect
    .poll(async () => (await panel.boundingBox())!.height)
    .toBeLessThan(half + 2);
  // 往下拖到底 → 收起：只剩把手與標題，清單不可操作
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + 200, { steps: 6 });
  await page.mouse.move(h.x + h.width / 2, box.y + box.height - 10, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(layout).toHaveAttribute("data-drawer", "collapsed");
  await expect
    .poll(async () => (await panel.boundingBox())!.height)
    .toBeLessThan(140);
  await expect(page.locator(".mx-panel-body")).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("heading", { name: "附近的桶", level: 1 }),
  ).toBeVisible();
  // 收起 → 點把手回半開；鍵盤上下鍵也能調整
  await handle.click();
  await expect(layout).toHaveAttribute("data-drawer", "half");
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  await expect(layout).toHaveAttribute("data-drawer", "full");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(layout).toHaveAttribute("data-drawer", "collapsed");
  // 收起時選了桶（點地圖標記）→ 面板自動回半開顯示桶資訊
  await marker(page, "垃圾桶：一般空回收滿").click();
  await expect(layout).toHaveAttribute("data-drawer", "half");
  await expect(
    page.getByRole("heading", { name: "一般空回收滿", level: 1 }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("desktop keeps the panel on the left and the map on the right", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".mx-row")).toHaveCount(3);
  const panel = (await page.locator(".mx-panel").boundingBox())!;
  const map = (await page.locator(".mx-map").boundingBox())!;
  expect(panel.x).toBeLessThan(1);
  expect(panel.width).toBeGreaterThanOrEqual(360);
  expect(panel.width).toBeLessThanOrEqual(441);
  expect(map.x).toBeGreaterThanOrEqual(panel.x + panel.width - 1);
  expect(Math.abs(map.height - panel.height)).toBeLessThan(2);
  await expect(page.locator(".mx-handle")).toBeHidden();
  await expect(page.locator(".mx-layout")).not.toHaveAttribute(
    "data-drawer",
    /.+/,
  );
  // 選桶後面板原地顯示桶資訊，地圖仍在右側，沒有獨立桶頁的小地圖。
  await page.locator(".mx-row").first().click();
  await expect(page.locator(".mx-panel .api-bin-detail")).toBeVisible();
  await expect(page.locator(".api-detail-map")).toHaveCount(0);
  await expect(page.locator(".leaflet-container")).toHaveCount(1);
  expect((await page.locator(".mx-map").boundingBox())!.x).toBe(map.x);
});

test("four filters and the waste type drive the list, sorting and marker colours", async ({
  page,
}) => {
  const reads = await setup(page);
  await page.goto("/#map");
  const rows = page.locator(".mx-row");
  // 全部：只列桶（地標、建議點不在清單），一般垃圾能丟的排最前。
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("一般空回收滿");
  await expect(rows.nth(0)).toContainText("一般垃圾：還能丟");
  await expect(rows.nth(1)).toContainText("一般滿回收空");
  await expect(rows.nth(1)).toContainText("一般垃圾：滿了");
  await expect(rows.nth(2)).toContainText("0/2");
  await expect(page.locator(".mx-list")).not.toContainText("公園地標");
  await expect(page.locator(".mx-list")).not.toContainText("建議設置點");
  // 一般垃圾：標記顏色看一般槽
  await expect(marker(page, "垃圾桶：一般空回收滿")).toHaveClass(
    /state-hungry/,
  );
  await expect(marker(page, "垃圾桶：一般滿回收空")).toHaveClass(/state-full/);
  await expect(marker(page, "地標：公園地標")).toHaveClass(/mx-landmark/);
  await expect(marker(page, "建議點：建議設置點")).toHaveClass(/mx-proposed/);
  await expect(page.locator(".mx-origin")).toContainText("起點（示意）");
  // 還能丟（一般垃圾）
  await page.getByRole("button", { name: "還能丟", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("一般空回收滿");
  await expect(marker(page, "垃圾桶：一般滿回收空")).toHaveCount(0);
  await expect(marker(page, "地標：公園地標")).toHaveCount(0);
  // 切到資源回收：清單、排序與標記一起換
  await page.getByLabel("垃圾種類", { exact: true }).selectOption("recycling");
  await expect(page).toHaveURL(/#map\?waste_type=recycling$/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("一般滿回收空");
  await expect(rows.first()).toContainText("資源回收：還能丟");
  await expect(marker(page, "垃圾桶：一般滿回收空")).toHaveClass(
    /state-hungry/,
  );
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("一般滿回收空");
  await expect(marker(page, "垃圾桶：一般空回收滿")).toHaveClass(/state-full/);
  // 新設：照原本交給後端 filter=new
  await page.getByRole("button", { name: "新設", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("新設");
  expect(reads.at(-1)?.get("filter")).toBe("new");
  // 建議點：只在這個篩選列入清單
  await page.getByRole("button", { name: "建議點", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("建議設置點");
  await expect(rows.first()).toContainText("尚未設置");
  // 每次讀取都是全台北市、全部類型、含建議點，並帶所選種類。
  for (const params of reads) {
    expect(params.get("district")).toBe("all");
    expect(params.get("kind")).toBe("all");
    expect(params.get("include_proposed")).toBe("true");
  }
  expect(reads.some((p) => p.get("waste_type") === "recycling")).toBe(true);
  await expect(page.getByRole("button", { name: "場所代表點" })).toHaveCount(0);
  await expect(page.getByText("A LITTLE HELP", { exact: false })).toHaveCount(
    0,
  );
});

test("a recycling deep link opens the map with the bin panel selected and back returns to the list", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/#bin/${generalOk.id}?waste_type=recycling`);
  await expect(
    page.getByRole("heading", { name: "一般空回收滿", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "bin");
  await expect(page.getByLabel("垃圾種類", { exact: true })).toHaveValue(
    "recycling",
  );
  await expect(
    page.getByRole("button", { name: "選擇資源回收", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const selected = marker(page, "垃圾桶：一般空回收滿");
  await expect(selected).toHaveClass(/selected/);
  await expect(selected).toHaveClass(/state-full/);
  await expect(page.locator(".api-detail-map")).toHaveCount(0);
  await expect(page.locator(".mx-row")).toHaveCount(0);
  await page.getByRole("link", { name: "← 返回清單", exact: true }).click();
  await expect(page).toHaveURL(/#map\?waste_type=recycling$/);
  await expect(page.locator(".mx-row")).toHaveCount(3);
  // 從清單選桶會更新網址，瀏覽器返回鍵回到清單。
  await page.locator(".mx-row").first().click();
  await expect(page).toHaveURL(
    new RegExp(`#bin/${binId}\\?waste_type=recycling$`),
  );
  await expect(
    page.getByRole("heading", { name: "一般滿回收空", level: 1 }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "附近的桶", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".mx-row")).toHaveCount(3);
});

test("landmarks stay off the list and explain they are not bins", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".mx-row")).toHaveCount(3);
  await expect(page.locator(".mx-list")).not.toContainText("公園地標");
  await marker(page, "地標：公園地標").click();
  const details = page.getByRole("region", { name: "位置詳情" });
  await expect(details).toContainText(
    "這是地標，不是垃圾桶，周邊約 12 處清潔箱",
  );
  await expect(
    page.getByRole("heading", { name: "公園地標", level: 1 }),
  ).toBeVisible();
  await expect(marker(page, "地標：公園地標")).toHaveClass(/selected/);
  await page.getByRole("button", { name: "關閉，回到附近的桶" }).click();
  await expect(page.locator(".mx-row")).toHaveCount(3);
});
