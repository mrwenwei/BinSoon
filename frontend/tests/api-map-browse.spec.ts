import { test, expect, type Page } from "@playwright/test";
import { apiFixture, binId, envelope, location } from "./api-fixtures";

// M1 地圖：手機抽屜三段、桌面左側面板、上方搜尋／三顆篩選／垃圾種類、原地選桶與深連結。
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
            : all.filter(
                (item) =>
                  !params.get("q") || item.label.includes(params.get("q")!),
              ),
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
  expect(Math.abs(half - box.height * 0.55)).toBeLessThan(4);
  // 半開 → 全開
  await handle.click();
  await expect(layout).toHaveAttribute("data-drawer", "full");
  await expect
    .poll(async () => (await panel.boundingBox())!.height)
    .toBeGreaterThan(
      box.height -
        (await page.locator(".mx-home-toolbar").boundingBox())!.height -
        30,
    );
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
  await page
    .getByRole("button", { name: "2 個桶，放大查看", exact: true })
    .focus();
  await page.keyboard.press("Enter");
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
  // 圖例收在右上角按鈕裡（預設收起），內容沒有 STATUS 英文小標。
  await page.getByRole("button", { name: "圖例", exact: true }).click();
  await expect(page.locator(".map-legend")).toContainText("依一般垃圾");
  await expect(page.locator(".map-legend")).toContainText("建議點");
  await expect(page.locator(".map-legend")).not.toContainText("STATUS");
  await page.keyboard.press("Escape");
  // 選桶後面板原地顯示桶資訊，地圖仍在右側，沒有獨立桶頁的小地圖。
  await page.locator(".location-row").first().click();
  await expect(page.locator(".mx-panel .api-bin-detail")).toBeVisible();
  await expect(page.locator(".api-detail-map")).toHaveCount(0);
  await expect(page.locator(".leaflet-container")).toHaveCount(1);
  expect((await page.locator(".mx-map").boundingBox())!.x).toBe(map.x);
});

test("the legend is a map-corner button with a keyboard-friendly popover", async ({
  page,
}) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await setup(page);
    await page.goto("/#map");
    await page.reload();
    await expect(page.locator(".location-row")).toHaveCount(3);
    // 沒有底部圖例列與地圖提示；右上角一顆沿用 .menu-button 的 44×44 圖示按鈕。
    await expect(page.locator(".mx-map .map-note")).toHaveCount(0);
    await expect(page.locator(".map-legend")).toHaveCount(0);
    const button = page.getByRole("button", { name: "圖例", exact: true });
    await expect(button).toHaveClass(/menu-button/);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const box = (await button.boundingBox())!;
    const map = (await page.locator(".mx-map").boundingBox())!;
    expect(Math.round(box.width)).toBe(44);
    expect(Math.round(box.height)).toBe(44);
    expect(box.x + box.width).toBeGreaterThan(map.x + map.width - 60);
    const toolbar = (await page.locator(".mx-home-toolbar").boundingBox())!;
    expect(box.y).toBeLessThan(
      width <= 760 ? toolbar.y + toolbar.height + 40 : map.y + 60,
    );
    // 開：直式排列 6 項，都在地圖範圍內；版面不會位移（N3）。
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const legend = page.locator(".mx-legend-popover .map-legend.stacked");
    await expect(legend.locator(":scope > span")).toHaveText([
      /依一般垃圾/,
      /餓了/,
      /吃飽了/,
      /失聯／維修／撤除/,
      /地標/,
      /建議點/,
    ]);
    const items = await legend.locator(":scope > span").all();
    let lastY = -1;
    for (const item of items) {
      const b = (await item.boundingBox())!;
      expect(b.y).toBeGreaterThan(lastY);
      lastY = b.y;
      expect(b.x).toBeGreaterThanOrEqual(map.x);
      expect(b.x + b.width).toBeLessThanOrEqual(map.x + map.width + 1);
    }
    expect(
      await page.evaluate(
        () => document.querySelector(".mx-layout")!.scrollTop,
      ),
    ).toBe(0);
    expect((await page.locator(".mx-map").boundingBox())!.y).toBe(map.y);
    // 再點一次按鈕關閉
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".mx-legend-popover")).toHaveCount(0);
    // 鍵盤：Enter 開、Esc 關，焦點回到按鈕
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    // 點外面關閉
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("heading", { name: "附近的桶", level: 1 }).click();
    await expect(page.locator(".mx-legend-popover")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("map filters and the waste type drive the list, sorting and marker colours", async ({
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
  ]);
  // 全部：只列桶（地標、建議點不在清單），一般垃圾能丟的排最前。
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("一般空回收滿");
  await expect(
    rows.nth(0).getByRole("img", { name: "一般垃圾，餓了，20%" }),
  ).toBeVisible();
  await expect(rows.nth(0).locator(".mx-slot.state-hungry")).toHaveCount(1);
  await expect(rows.nth(1)).toContainText("一般滿回收空");
  await expect(
    rows.nth(1).getByRole("img", { name: "一般垃圾，吃飽了，92%" }),
  ).toBeVisible();
  await expect(rows.nth(2)).toContainText("0/2");
  await expect(page.locator(".mx-list")).not.toContainText("公園地標");
  await expect(page.locator(".mx-list")).not.toContainText("建議設置點");
  // 展開重疊的桶之後，標記顏色看一般槽。
  await page
    .getByRole("button", { name: "2 個桶，放大查看", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(marker(page, "垃圾桶：一般空回收滿")).toHaveClass(
    /state-hungry/,
  );
  await expect(marker(page, "垃圾桶：一般滿回收空")).toHaveClass(/state-full/);
  await expect(marker(page, "地標：公園地標")).toHaveClass(/mx-landmark/);
  await expect(marker(page, "建議點：建議設置點")).toHaveCount(0);
  await expect(page.locator(".mx-origin")).toContainText("起點（示意）");
  // 還能丟（一般垃圾）
  await page.getByRole("button", { name: "還能丟", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("一般空回收滿");
  await expect(marker(page, "垃圾桶：一般滿回收空")).toHaveCount(0);
  await expect(marker(page, "地標：公園地標")).toHaveCount(0);
  // 切到資源回收：清單、排序、標記與圖例一起換
  await page.getByRole("radio", { name: "資源回收", exact: true }).click();
  await expect(page).toHaveURL(/#map\?waste_type=recycling$/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("一般滿回收空");
  await expect(
    rows.first().getByRole("img", { name: "資源回收，餓了，30%" }),
  ).toBeVisible();
  await expect(marker(page, "垃圾桶：一般滿回收空")).toHaveClass(
    /state-hungry/,
  );
  await page.getByRole("button", { name: "圖例", exact: true }).click();
  await expect(page.locator(".map-legend")).toContainText("依資源回收");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("一般滿回收空");
  await expect(marker(page, "垃圾桶：一般空回收滿")).toHaveClass(/state-full/);
  // 新設：照原本交給後端 filter=new
  await page.getByRole("button", { name: "新設", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("新設");
  expect(reads.at(-1)?.get("filter")).toBe("new");
  // 建議點：獨立到要桶投票分頁
  await page
    .getByRole("navigation", { name: "主要分頁" })
    .getByRole("link", { name: "要桶投票", exact: true })
    .click();
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
  // 面板同時顯示兩槽：沒有種類選單、「一個定點」標題，槽也不能點。
  await expect(page.getByLabel("垃圾種類", { exact: true })).toHaveCount(0);
  await expect(page.getByText("一個定點，兩種桶況")).toHaveCount(0);
  await expect(page.getByText(/目前選擇|選擇此種類/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^選擇(一般垃圾|資源回收)$/ }),
  ).toHaveCount(0);
  await expect(page.locator(".mx-panel .compartment")).toHaveCount(2);
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
  await page
    .getByRole("button", { name: "2 個桶，放大查看", exact: true })
    .focus();
  await page.keyboard.press("Enter");
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
  await page.locator(".leaflet-control-zoom-in").click();
  await page.locator(".leaflet-control-zoom-in").click();
  await page.locator(".leaflet-control-zoom-in").click();
  // 再點一次已選的桶不會改變什麼；把焦點放到別的標記，之後的更新不會把焦點拉回標題（N2）。
  await marker(page, "垃圾桶：一般空回收滿").focus();
  await page.keyboard.press("Enter");
  const other = marker(page, "垃圾桶：兩槽都滿");
  await other.focus();
  await page.waitForTimeout(11500);
  await expect(other).toBeFocused();
  await expect(marker(page, "垃圾桶：一般空回收滿")).toHaveClass(/selected/);
  // 清單畫面的輪詢（每 10 秒）後，標記上的焦點仍在、元素沒有重建。
  await page.getByRole("link", { name: "← 返回清單" }).click();
  const target = marker(page, "垃圾桶：兩槽都滿");
  await target.focus();
  await target.evaluate((el) => el.setAttribute("data-probe", "1"));
  await page.waitForTimeout(11500);
  await expect(target).toBeFocused();
  await expect(target).toHaveAttribute("data-probe", "1");
  // 在清單換種類不多一筆瀏覽紀錄。
  const before = await page.evaluate(() => history.length);
  await page.getByRole("radio", { name: "資源回收", exact: true }).click();
  await expect(page).toHaveURL(/waste_type=recycling$/);
  expect(await page.evaluate(() => history.length)).toBe(before);
});

test("polling with a search term never moves the map or the selection (N1)", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(3);
  await page.getByRole("searchbox").fill("兩槽");
  const probe = marker(page, "垃圾桶：兩槽都滿");
  // 搜尋字改變後框住結果一次
  await page.waitForTimeout(800);
  // 把地圖移開（Leaflet 方向鍵），等一次輪詢，位置不變
  await page.locator(".leaflet-container").focus();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(350);
  }
  const moved = (await probe.boundingBox())!;
  await page.waitForTimeout(11500);
  const after = (await probe.boundingBox())!;
  expect(Math.abs(after.x - moved.x)).toBeLessThan(1);
  expect(Math.abs(after.y - moved.y)).toBeLessThan(1);
  // 搜尋字還在時選桶：置中後，輪詢也不會再改變位置或選取
  await page.locator(".location-row").first().click();
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "bin");
  await page.getByRole("link", { name: "← 返回清單" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("兩槽");
  const centred = (await probe.boundingBox())!;
  await page.waitForTimeout(11500);
  const later = (await probe.boundingBox())!;
  expect(Math.abs(later.x - centred.x)).toBeLessThan(1);
  expect(Math.abs(later.y - centred.y)).toBeLessThan(1);
});

test("a fresh half drawer shows at least one whole row at 360 and 390 wide", async ({
  page,
}) => {
  for (const [width, height] of [
    [360, 780],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await setup(page);
    await page.goto("/#map");
    await page.reload();
    await expect(page.locator(".location-row").first()).toBeVisible();
    await expect(page.locator(".mx-layout")).toHaveAttribute(
      "data-drawer",
      "half",
    );
    const panel = (await page.locator(".mx-panel").boundingBox())!;
    const row = (await page.locator(".location-row").first().boundingBox())!;
    expect(row.y).toBeGreaterThanOrEqual(panel.y);
    expect(row.y + row.height).toBeLessThanOrEqual(panel.y + panel.height);
    // M1：搜尋及種類篩選在地圖上方，下方面板只放附近清單。
    const toolbar = (await page.locator(".mx-home-toolbar").boundingBox())!;
    const picker = (await page
      .getByRole("group", { name: "垃圾種類" })
      .boundingBox())!;
    const search = (await page.getByRole("searchbox").boundingBox())!;
    expect(search.height).toBeGreaterThanOrEqual(44);
    expect(search.y).toBeLessThan(picker.y);
    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(panel.y);
    // 清單列改用滿度條後，列高明顯低於 139px。
    expect(row.height).toBeLessThan(120);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("a missing bin stops polling after 404 (L8)", async ({ page }) => {
  const views: number[] = [];
  await setup(page);
  await page.route("**/api/v1/bins/does-not-exist/**", async (route) => {
    views.push(Date.now());
    await route.fulfill({
      status: 404,
      json: {
        detail: { code: "NOT_FOUND", message: "找不到資料", fields: [] },
      },
    });
  });
  await page.goto("/#bin/does-not-exist");
  await expect(page.getByText("找不到資料").first()).toBeVisible();
  await page.waitForTimeout(1000);
  const settled = views.length;
  await page.waitForTimeout(11500);
  expect(views.length).toBe(settled);
});

test("the list stops polling while a bin is open and refreshes on return (X7)", async ({
  page,
}) => {
  const reads = await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(3);
  await page.locator(".location-row").first().click();
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "bin");
  await page.waitForTimeout(500);
  const opened = reads.length;
  await page.waitForTimeout(11500);
  expect(reads.length).toBe(opened);
  await page.getByRole("link", { name: "← 返回清單" }).click();
  await expect.poll(() => reads.length, { timeout: 3000 }).toBe(opened + 1);
  await expect
    .poll(() => reads.length, { timeout: 13000 })
    .toBeGreaterThan(opened + 1);
});

test("the icon-only waste toggle switches with arrow keys and keeps focus (C)", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(3);
  const group = page.getByRole("group", { name: "垃圾種類" });
  const general = group.getByRole("radio", { name: "一般垃圾", exact: true });
  const recycling = group.getByRole("radio", { name: "資源回收", exact: true });
  const caption = page.locator(".mx-head-title .tiny");
  await expect(general).toBeChecked();
  await expect(caption).toHaveText("3 個桶 · 一般垃圾優先");
  // 純圖示：每格 44×44，滑鼠移上去有文字提示。
  for (const name of ["一般垃圾", "資源回收"]) {
    const label = page.locator(`.mx-home-toolbar label[title="${name}"]`);
    const box = (await label.boundingBox())!;
    expect(Math.round(box.width)).toBe(44);
    expect(Math.round(box.height)).toBe(44);
  }
  const before = await page.evaluate(() => history.length);
  await general.focus();
  await page.keyboard.press("ArrowRight");
  await expect(recycling).toBeChecked();
  await expect(page).toHaveURL(/waste_type=recycling$/);
  await expect(caption).toHaveText("3 個桶 · 資源回收優先");
  await expect(recycling).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(general).toBeChecked();
  await expect(general).toBeFocused();
  await expect(caption).toHaveText("3 個桶 · 一般垃圾優先");
  await page.keyboard.press("ArrowRight");
  await expect(recycling).toBeChecked();
  await expect(recycling).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(before);
});

test("list rows show one short fill bar per compartment: solid, striped and dashed", async ({
  page,
}) => {
  await setup(page);
  const repairSlot = {
    ...slot("general", 40, "unknown"),
    operational_status: "repair",
    is_usable: false,
    unavailable_reasons: ["repair"],
  };
  const repaired = {
    ...bin(
      "10000000-0000-4000-8000-000000000005",
      "一般維修中",
      [40, "unknown"],
      [70, "full"],
      150,
    ),
  };
  repaired.bin_status = repairSlot as typeof repaired.bin_status;
  repaired.compartments = [
    repairSlot as (typeof repaired.compartments)[number],
    slot("recycling", 85, "full"),
  ];
  await page.route("**/api/v1/map/locations**", (route) =>
    route.fulfill({ json: envelope([generalFull, generalOk, repaired]) }),
  );
  await page.goto("/#map");
  const rows = page.locator(".location-row");
  await expect(rows).toHaveCount(3);
  // 所選種類（一般垃圾）在左邊，另一槽在右邊，同一行。
  const okRow = rows.filter({ hasText: "一般空回收滿" });
  const slots = okRow.locator(".mx-slot");
  await expect(slots).toHaveCount(2);
  const [left, right] = [
    (await slots.nth(0).boundingBox())!,
    (await slots.nth(1).boundingBox())!,
  ];
  expect(Math.abs(left.y - right.y)).toBeLessThan(2);
  expect(left.x).toBeLessThan(right.x);
  await expect(slots.nth(0)).toHaveAttribute(
    "aria-label",
    "一般垃圾，餓了，20%",
  );
  await expect(slots.nth(1)).toHaveAttribute(
    "aria-label",
    "資源回收，吃飽了，88%",
  );
  // 只寫百分比，不寫餓了／吃飽了
  await expect(slots.nth(0)).toHaveText(/^\D*20%$/);
  await expect(okRow).not.toContainText("餓了");
  // 餓了：實心；吃飽了：斜紋
  await expect(
    slots.nth(0).locator(".fill-bar.state-hungry > span"),
  ).toHaveCount(1);
  const stripe = await slots
    .nth(1)
    .locator(".fill-bar.state-full > span")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(stripe).toContain("repeating-linear-gradient");
  // 維修中：虛線空條＋狀態字，不放百分比
  const repairRow = rows.filter({ hasText: "一般維修中" });
  const repairBar = repairRow.locator(".mx-slot").first();
  await expect(repairBar).toHaveAttribute("aria-label", "一般垃圾，維修中");
  await expect(repairBar).toContainText("維修中");
  await expect(repairBar).not.toContainText("%");
  await expect(repairBar.locator(".fill-bar.state-offline > span")).toHaveCount(
    0,
  );
  const outline = await repairBar
    .locator(".fill-bar.state-offline")
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe("dashed");
});

test("rows fit at least one whole row at 360 and 390, and 320 is measured (N5)", async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 640],
    [360, 780],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await setup(page);
    await page.goto("/#map");
    await page.reload();
    await expect(page.locator(".location-row").first()).toBeVisible();
    const panel = (await page.locator(".mx-panel").boundingBox())!;
    const row = (await page.locator(".location-row").first().boundingBox())!;
    expect(row.height).toBeLessThan(120);
    const shortfall = row.y + row.height - (panel.y + panel.height);
    console.log(
      `N5 ${width}x${height} rowH=${Math.round(row.height)} shortfall=${Math.round(shortfall)}`,
    );
    if (width >= 360) expect(shortfall).toBeLessThanOrEqual(0);
  }
});

test("an open bin keeps its own marker in sync with the panel while the list is paused (N6)", async ({
  page,
}) => {
  let full = false;
  await setup(page);
  await page.route(`**/api/v1/bins/${generalOk.id}/view**`, (route) => {
    const general = full
      ? slot("general", 96, "full")
      : slot("general", 20, "hungry");
    const compartments = [general, slot("recycling", 88, "full")];
    return route.fulfill({
      json: {
        location: { ...generalOk, bin_status: general, compartments },
        status: general,
        compartments,
        adopter: null,
        latest_cleanup: null,
        my_adoption_id: null,
        can_apply_adoption: false,
        can_report: false,
        report_block_reason: "login_required",
      },
    });
  });
  await page.goto(`/#bin/${generalOk.id}?waste_type=general`);
  const selected = marker(page, "垃圾桶：一般空回收滿");
  await expect(selected).toHaveClass(/state-hungry/);
  full = true;
  await expect(page.getByText("兩桶都吃飽了", { exact: true })).toBeVisible({
    timeout: 13000,
  });
  await expect(selected).toHaveClass(/state-full/);
  await expect(selected).toHaveClass(/selected/);
});

test("the legend popover avoids the zoom buttons and closes when focus or the view moves away", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await setup(page);
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(3);
  const button = page.getByRole("button", { name: "圖例", exact: true });
  await button.click();
  const pop = (await page.locator(".mx-legend-popover").boundingBox())!;
  const zoomIn = (await page
    .locator(".leaflet-control-zoom-in")
    .boundingBox())!;
  const overlap =
    pop.x < zoomIn.x + zoomIn.width &&
    zoomIn.x < pop.x + pop.width &&
    pop.y < zoomIn.y + zoomIn.height &&
    zoomIn.y < pop.y + pop.height;
  expect(overlap).toBe(false);
  // Tab 離開 popover 就關閉
  await button.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".mx-legend-popover")).toHaveCount(0);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  // 開著時用鍵盤選桶：焦點移到清單列就關閉，選了桶也維持關閉
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.locator(".location-row").first().focus();
  await expect(page.locator(".mx-legend-popover")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "bin");
  await expect(page.locator(".mx-legend-popover")).toHaveCount(0);
  // 面板換畫面時也會關閉（例如用網址選桶）
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.evaluate(() => {
    location.hash = "map?waste_type=general";
  });
  await expect(page.locator(".mx-legend-popover")).toHaveCount(0);
});

test("fill bars line up across rows, including a new bin whose tag sits beside the name (L-f)", async ({
  page,
}) => {
  await setup(page);
  const fresh = {
    ...generalOk,
    id: "10000000-0000-4000-8000-000000000006",
    label: "新設的桶",
    bin_status: { ...generalOk.bin_status, is_new: true },
  };
  const removed = {
    ...bin(
      "10000000-0000-4000-8000-000000000007",
      "撤除的桶",
      [0, "unknown"],
      [100, "full"],
      300,
    ),
  };
  removed.compartments[0] = {
    ...removed.compartments[0],
    fill_level_pct: null as unknown as number,
    operational_status: "removed",
  } as (typeof removed.compartments)[number];
  await page.route("**/api/v1/map/locations**", (route) =>
    route.fulfill({ json: envelope([generalFull, fresh, removed, bothFull]) }),
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#map");
    await page.reload();
    const rows = page.locator(".mx-list .location-row");
    await expect(rows).toHaveCount(4);
    const geometry = await page.evaluate(() =>
      [...document.querySelectorAll(".mx-list .location-row")].map((row) =>
        [...row.querySelectorAll(".mx-slot .fill-bar")].map((bar) => {
          const r = bar.getBoundingClientRect();
          return [r.left, r.width];
        }),
      ),
    );
    for (const bars of geometry) {
      expect(bars).toHaveLength(2);
      for (const i of [0, 1]) {
        expect(Math.abs(bars[i][0] - geometry[0][i][0])).toBeLessThan(0.5);
        expect(Math.abs(bars[i][1] - geometry[0][i][1])).toBeLessThan(0.5);
      }
    }
    // 「新設」在桶名旁邊，不在滿度條那一行
    const newRow = rows.filter({ hasText: "新設的桶" });
    const tag = (await newRow
      .locator(".status-pill", { hasText: "新設" })
      .boundingBox())!;
    const name = (await newRow.locator("strong").boundingBox())!;
    const slots = (await newRow.locator(".mx-slots").boundingBox())!;
    expect(
      Math.abs(tag.y + tag.height / 2 - (name.y + name.height / 2)),
    ).toBeLessThan(3);
    expect(tag.y + tag.height).toBeLessThanOrEqual(slots.y);
    await expect(newRow.locator(".mx-slots .status-pill")).toHaveCount(0);
  }
});
