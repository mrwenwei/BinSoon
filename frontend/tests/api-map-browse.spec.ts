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
  await expect(page.locator(".location-row")).toHaveCount(3);
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
  await expect(page.locator(".location-row")).toHaveCount(3);
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
  // 寬地圖時圖例完整顯示，不需要收合按鈕。
  await expect(page.locator(".map-legend-toggle")).toBeHidden();
  await expect(page.locator(".map-legend")).toContainText("依一般垃圾");
  await expect(page.locator(".map-legend")).toContainText("建議點");
  await expect(page.locator(".map-legend")).not.toContainText("STATUS");
  // 選桶後面板原地顯示桶資訊，地圖仍在右側，沒有獨立桶頁的小地圖。
  await page.locator(".location-row").first().click();
  await expect(page.locator(".mx-panel .api-bin-detail")).toBeVisible();
  await expect(page.locator(".api-detail-map")).toHaveCount(0);
  await expect(page.locator(".leaflet-container")).toHaveCount(1);
  expect((await page.locator(".mx-map").boundingBox())!.x).toBe(map.x);
});

test("narrow maps fold the legend into a button that opens without clipping", async ({
  page,
}) => {
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await setup(page);
    await page.goto("/#map");
    await page.reload();
    await expect(page.locator(".location-row")).toHaveCount(3);
    const toggle = page.getByRole("button", { name: "圖例", exact: true });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const items = page.locator(".map-legend-items");
    const map = (await page.locator(".mx-map").boundingBox())!;
    for (const text of [
      "依一般垃圾",
      "餓了",
      "吃飽了",
      "失聯",
      "地標",
      "建議點",
    ]) {
      const box = (await items
        .getByText(text, { exact: false })
        .first()
        .boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(map.x);
      expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width + 1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("four filters and the waste type drive the list, sorting and marker colours", async ({
  page,
}) => {
  const reads = await setup(page);
  await page.goto("/#map");
  const rows = page.locator(".location-row");
  // 篩選沿用既有的 .filter-chips。
  await expect(page.locator(".filter-chips").getByRole("button")).toHaveText([
    "全部",
    "還能丟",
    "新設",
    "建議點",
  ]);
  // 全部：只列桶（地標、建議點不在清單），一般垃圾能丟的排最前。
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("一般空回收滿");
  await expect(rows.nth(0)).toContainText("一般垃圾 · 餓了 · 20%");
  await expect(rows.nth(0).locator(".status-pill.state-hungry")).toHaveCount(1);
  await expect(rows.nth(1)).toContainText("一般滿回收空");
  await expect(rows.nth(1)).toContainText("一般垃圾 · 吃飽了 · 92%");
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
  // 切到資源回收：清單、排序、標記與圖例一起換
  await page.getByLabel("垃圾種類", { exact: true }).selectOption("recycling");
  await expect(page).toHaveURL(/#map\?waste_type=recycling$/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("一般滿回收空");
  await expect(rows.first()).toContainText("資源回收 · 餓了 · 30%");
  await expect(marker(page, "垃圾桶：一般滿回收空")).toHaveClass(
    /state-hungry/,
  );
  await expect(page.locator(".map-legend")).toContainText("依資源回收");
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
  await expect(page.locator(".location-row")).toHaveCount(0);
  await page.getByRole("link", { name: "← 返回清單", exact: true }).click();
  await expect(page).toHaveURL(/#map\?waste_type=recycling$/);
  await expect(page.locator(".location-row")).toHaveCount(3);
  // 從清單選桶會更新網址，瀏覽器返回鍵回到清單。
  await page.locator(".location-row").first().click();
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
  await expect(page.locator(".location-row")).toHaveCount(3);
});

test("landmarks stay off the list and explain they are not bins", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(3);
  await expect(page.locator(".mx-list")).not.toContainText("公園地標");
  await marker(page, "地標：公園地標").click();
  await expect(
    page.getByText("這是地標，不是垃圾桶，周邊約 12 處清潔箱", {
      exact: false,
    }),
  ).toBeVisible();
  // 面板沿用既有的位置詳情元件（場所代表點說明＋來源）。
  const details = page.getByRole("region", { name: "位置詳情" });
  await expect(details).toContainText("並非個別清潔箱位置");
  await expect(details).toContainText("周邊 12 處");
  await expect(
    page.getByRole("heading", { name: "公園地標", level: 2 }),
  ).toBeFocused();
  await expect(marker(page, "地標：公園地標")).toHaveClass(/selected/);
  // 選地標也寫進網址，瀏覽器返回鍵回到清單，不會離開地圖頁。
  await expect(page).toHaveURL(
    /#map\?place=place-landmark&waste_type=general$/,
  );
  await page.goBack();
  await expect(page).toHaveURL(/#map(\?waste_type=general)?$/);
  await expect(page.locator(".location-row")).toHaveCount(3);
  await marker(page, "地標：公園地標").click();
  await page.getByRole("button", { name: "關閉位置詳情" }).click();
  await expect(page.locator(".location-row")).toHaveCount(3);
});

test("selecting from a full drawer returns to half and keeps the bin in view, also after reopening", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/#map");
  const layout = page.locator(".mx-layout");
  const panel = page.locator(".mx-panel");
  await expect(page.locator(".location-row")).toHaveCount(3);
  await page.locator(".mx-handle").click();
  await expect(layout).toHaveAttribute("data-drawer", "full");
  // 全開時從清單選桶 → 自動回半開，標記在抽屜上方可見區的中間。
  await page.getByRole("button", { name: /^一般空回收滿/ }).click();
  await expect(layout).toHaveAttribute("data-drawer", "half");
  const inView = async () => {
    const top = (await page.locator(".mx-map").boundingBox())!.y;
    const panelTop = (await panel.boundingBox())!.y;
    const box = (await marker(page, "垃圾桶：一般空回收滿").boundingBox())!;
    const center = box.y + box.height / 2;
    return center > top + 40 && center < panelTop - 10;
  };
  await expect.poll(inView).toBe(true);
  // 全開再回半開 → 仍在可見區；把地圖移開後再開合一次 → 重新置中。
  await page.locator(".mx-handle").click();
  await expect(layout).toHaveAttribute("data-drawer", "full");
  await page.locator(".mx-handle").click();
  await expect(layout).toHaveAttribute("data-drawer", "half");
  await expect.poll(inView).toBe(true);
  // 用鍵盤把地圖往北移（Leaflet 方向鍵），讓桶掉進抽屜底下。
  await page.locator(".leaflet-container").focus();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(350);
  }
  await expect.poll(inView).toBe(false);
  await page.locator(".mx-handle").click();
  await expect(layout).toHaveAttribute("data-drawer", "full");
  await page.locator(".mx-handle").click();
  await expect(layout).toHaveAttribute("data-drawer", "half");
  await expect.poll(inView).toBe(true);
});

test("search waits for typing to pause and only the latest query is shown", async ({
  page,
}) => {
  const reads = await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(3);
  const before = reads.length;
  await page.getByRole("searchbox").pressSequentially("兩槽都滿", {
    delay: 60,
  });
  await expect
    .poll(() => reads.slice(before).map((p) => p.get("q")))
    .toEqual(["兩槽都滿"]);
  await page.waitForTimeout(500);
  expect(reads.slice(before).map((p) => p.get("q"))).toEqual(["兩槽都滿"]);
});

test("the phone map page does not scroll and still discloses simulated readings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await page.mouse.wheel(0, 600);
  await page.evaluate(() => window.scrollTo(0, 400));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".api-footer")).toHaveCount(0);
  const disclosure = page.getByText(
    "所有滿度目前皆為 simulated 模擬讀值，尚無真實 IoT 接收。",
    { exact: true },
  );
  await disclosure.scrollIntoViewIfNeeded();
  await expect(disclosure).toBeInViewport();
  // 其他頁仍保留原本的頁尾。
  await page.goto("/#reports");
  await expect(page.locator(".api-footer")).toHaveCount(1);
});

test("markers work from the keyboard, focus follows selection and polling keeps it", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(3);
  // 地標用鍵盤 Enter 打開
  await marker(page, "地標：公園地標").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/place=place-landmark/);
  await expect(
    page.getByRole("heading", { name: "公園地標", level: 2 }),
  ).toBeFocused();
  // 清單列按 Enter 選桶，焦點移到面板標題
  await page.getByRole("link", { name: "← 返回清單" }).click();
  await page.locator(".location-row").first().focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "一般空回收滿", level: 1 }),
  ).toBeFocused();
  // 輪詢（每 10 秒）後，標記上的焦點與選取都還在
  const target = marker(page, "垃圾桶：兩槽都滿");
  await target.focus();
  await expect(target).toBeFocused();
  await page.waitForTimeout(11500);
  await expect(target).toBeFocused();
  await expect(marker(page, "垃圾桶：一般空回收滿")).toHaveClass(/selected/);
  // 在面板內切換種類不多一筆瀏覽紀錄：返回鍵直接回清單
  await page.getByLabel("垃圾種類", { exact: true }).selectOption("recycling");
  await expect(page).toHaveURL(/waste_type=recycling$/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "附近的桶", level: 1 }),
  ).toBeVisible();
});
