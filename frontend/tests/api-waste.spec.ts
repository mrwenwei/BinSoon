import { asPhone, captureReport } from "./phone-report-fixture";
import { test, expect } from "@playwright/test";
import { binId, reportId, workId, login, tapEmptyMap } from "./api-fixtures";
import { wasteFixture, wasteCompletion } from "./api-waste-fixture";
import { photoFile } from "./api-completion-fixture";
import type { Page } from "@playwright/test";

// 桶面板不再有種類選單：點地圖空白處回清單，在地圖篩選列換種類，再點回同一個桶。
async function switchWaste(page: Page, value: "general" | "recycling") {
  await tapEmptyMap(page);
  await page
    .getByRole("radio", {
      name: value === "general" ? "一般垃圾" : "資源回收",
      exact: true,
    })
    .click();
  await page
    .locator(".mx-list .location-row")
    .filter({ hasText: "雙槽測試桶" })
    .click();
}
const compartment = (page: Page, name: string) =>
  page.locator(".mx-panel .compartment").filter({ hasText: name });

test.beforeEach(async ({ page }) => {
  await asPhone(page);
});

test("one map point exposes independent general and recycling availability and preserves the choice in navigation", async ({
  page,
}) => {
  const f = wasteFixture();
  await f.setup(page);
  await page.goto("/#map");
  await expect(
    page.locator(".mx-list").getByRole("button", { name: /雙槽測試桶/ }),
  ).toHaveCount(1);
  await page.getByRole("radio", { name: "資源回收", exact: true }).click();
  // 「最近的可用小夥伴」併入「附近的桶」：列上每一槽一條滿度條（無障礙名稱寫完整）。
  await expect(
    page
      .getByRole("list", { name: "附近的桶" })
      .getByRole("img", { name: "資源回收，餓了，20%" }),
  ).toBeVisible();
  await page
    .locator(".mx-list")
    .getByRole("button", { name: /雙槽測試桶/ })
    .click();
  await expect(
    page.getByRole("link", { name: "導航過去", exact: true }),
  ).toBeVisible();
  await expect(compartment(page, "一般垃圾")).toContainText("95%");
  await expect(compartment(page, "資源回收")).toContainText("20%");
  await page.getByRole("link", { name: "導航過去", exact: true }).click();
  await expect(page).toHaveURL(/waste_type=recycling/);
  await expect(
    page.getByRole("heading", { name: "雙槽測試桶", level: 2 }),
  ).toBeVisible();
  expect(
    f.requests
      .filter((r) => r.path === `/bins/${binId}/view`)
      .every((r) => r.waste === "recycling"),
  ).toBe(true);
});

test("recycling reports retain their exact stream and command through a lost response", async ({
  page,
}) => {
  const f = wasteFixture();
  await f.setup(page);
  await login(page, "citizen", `report/${binId}?waste_type=recycling`);
  await captureReport(page);
  f.state.abortReport = true;
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await page.getByRole("button", { name: "重試原回報", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "謝謝你幫城市變乾淨！", exact: true }),
  ).toBeVisible();
  const writes = f.requests.filter(
    (r) => r.path === "/reports" && r.method === "POST",
  );
  expect(writes).toHaveLength(2);
  expect(writes[0].body.waste_type).toBe("recycling");
  expect(writes[1]).toEqual(writes[0]);
  await expect(page.getByText(/資源回收 · 分類依據/)).toBeVisible();
  await page.getByRole("link", { name: "查看這個桶", exact: true }).click();
  await expect(page).toHaveURL(/waste_type=recycling/);
});

test("pending thanks for general waste never block or retarget recycling thanks", async ({
  page,
}) => {
  const f = wasteFixture();
  await f.setup(page);
  await login(page, "citizen", `bin/${binId}?waste_type=general`);
  f.state.abortLike = true;
  await page.getByRole("button", { name: "謝謝清潔隊", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重試原按讚", exact: true }),
  ).toBeVisible();
  await switchWaste(page, "recycling");
  await expect(
    page.getByRole("button", { name: "謝謝清潔隊", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "重試原按讚", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "謝謝清潔隊", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已感謝", exact: true }),
  ).toBeDisabled();
  await switchWaste(page, "general");
  await page.getByRole("button", { name: "重試原按讚", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已感謝", exact: true }),
  ).toBeDisabled();
  const likes = f.requests.filter((r) => r.path.endsWith("/like"));
  expect(likes.map((r) => r.path)).toEqual([
    `/completions/${wasteCompletion.general}/like`,
    `/completions/${wasteCompletion.recycling}/like`,
    `/completions/${wasteCompletion.general}/like`,
  ]);
  expect(likes[2]).toEqual(likes[0]);
});

test("work lists filter by waste and administrator clearing follows the work stream without a client override", async ({
  page,
  context,
}) => {
  const f = wasteFixture();
  await f.setup(page);
  await login(page, "staff", "staff/tasks");
  await page.getByLabel("垃圾種類", { exact: true }).selectOption("recycling");
  await expect(page.locator(".api-items > li")).toHaveCount(1);
  await expect(page.locator(".api-items")).toContainText("資源回收");
  await page.getByRole("link", { name: /查看工單/ }).click();
  await expect(page.getByText(/資源回收 · 分類依據/).first()).toBeVisible();
  const admin = await context.newPage();
  await f.setup(admin);
  await login(admin, "admin", `admin/work-orders/${workId}`);
  await expect(admin.getByText(/資源回收 · 分類依據/).first()).toBeVisible();
  await admin.getByLabel("確認送出清空回傳").check();
  await admin.getByRole("button", { name: "送出清空", exact: true }).click();
  await expect(
    admin
      .getByRole("region", { name: "各類桶槽" })
      .getByRole("listitem")
      .filter({ hasText: "一般垃圾" }),
  ).toContainText("95%");
  await expect(
    admin
      .getByRole("region", { name: "各類桶槽" })
      .getByRole("listitem")
      .filter({ hasText: "資源回收" }),
  ).toContainText("0%");
  const clearing = f.requests.find((r) => r.path.endsWith("/demo-clear"))!;
  expect(Object.keys(clearing.body)).toEqual(["reading_id"]);
  expect(clearing.etag).toBe('"v3"');
  expect(clearing.waste).toBe(null);
});

test("compact bin details keep both waste slots and omit obsolete history controls", async ({
  page,
}) => {
  const f = wasteFixture();
  await f.setup(page);
  await page.goto(`/#bin/${binId}?waste_type=recycling`);
  await expect(page.getByRole("region", { name: "各類桶槽" })).toContainText(
    "20%",
  );
  await expect(page.getByRole("region", { name: "各類桶槽" })).toContainText(
    "95%",
  );
  await expect(page.locator(".api-history")).toHaveCount(0);
  await expect(page.getByLabel("歷史種類", { exact: true })).toHaveCount(0);
  await switchWaste(page, "general");
  await expect(page.getByRole("region", { name: "各類桶槽" })).toContainText(
    "舊狀態假設為一般垃圾",
  );
  expect(f.requests.filter((r) => r.path.endsWith("/history"))).toHaveLength(0);
});

test("switching waste preserves separate photo drafts and does not expose a stale compartment while loading", async ({
  page,
}) => {
  const f = wasteFixture();
  await f.setup(page);
  await login(page, "citizen", `report/${binId}?waste_type=recycling`);
  await page
    .getByRole("textbox", { name: "說明", exact: true })
    .fill("回收投入口情況");
  await captureReport(page);
  await expect(
    page.getByRole("img", { name: "待送出的照片", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "一般垃圾", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "一般垃圾", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "說明", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("img", { name: "待送出的照片", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "說明", exact: true })
    .fill("一般垃圾另一份草稿");
  await page.getByRole("radio", { name: "資源回收", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "資源回收", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "說明", exact: true }),
  ).toHaveValue("回收投入口情況");
  await expect(
    page.getByRole("img", { name: "待送出的照片", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回桶詳情", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "雙槽測試桶", level: 1, exact: true }),
  ).toBeVisible();
  f.state.repairRecycling = true;
  await switchWaste(page, "general");
  await expect(page.locator(".bin-action-panel .status-pill")).toHaveText(
    "吃飽了 · 95%",
  );
  f.state.delayRecycling = 400;
  await switchWaste(page, "recycling");
  await expect(
    page
      .locator(".bin-action-panel .status-pill")
      .filter({ hasText: "吃飽了 · 95%" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "導航過去", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".bin-action-panel .status-pill")).toHaveText(
    "維修中",
  );
  await expect(
    page.getByRole("link", { name: "導航過去", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".api-history")).toHaveCount(0);
});

test("report list filtering and waste choice stay usable on desktop and 320px screens", async ({
  page,
}, testInfo) => {
  const f = wasteFixture();
  await f.setup(page);
  await login(page, "citizen", "reports");
  await expect(page.locator(".api-items > li")).toHaveCount(2);
  await page.getByLabel("垃圾種類", { exact: true }).selectOption("recycling");
  await expect(page.locator(".api-items > li")).toHaveCount(1);
  await expect(page.locator(".api-items")).toContainText("資源回收");
  await page.evaluate((id) => {
    location.hash = `bin/${id}?waste_type=recycling`;
  }, binId);
  await expect(compartment(page, "資源回收")).toContainText("20%");
  // 桶面板的槽只顯示、不能點；種類從地圖篩選列切換（鍵盤也能操作）。
  await expect(page.locator(".mx-panel .compartment-select")).toHaveCount(0);
  // 鍵盤：Esc 關閉桶面板回清單。
  await page.keyboard.press("Escape");
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "list");
  await page.getByRole("radio", { name: "資源回收", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("radio", { name: "一般垃圾", exact: true }),
  ).toBeChecked();
  await page
    .locator(".mx-list .location-row")
    .filter({ hasText: "雙槽測試桶" })
    .press("Enter");
  await expect(
    page.getByRole("link", { name: "尋找可用桶並導航", exact: true }),
  ).toHaveAttribute("href", `#nav/${binId}?waste_type=general`);
  await switchWaste(page, "recycling");
  await expect(
    page.getByRole("link", { name: "導航過去", exact: true }),
  ).toHaveAttribute("href", `#nav/${binId}?waste_type=recycling`);
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  // 桶資訊改在地圖旁的面板，不再有小地圖；地圖提示也拿掉了，改驗圖例按鈕在主地圖內。
  const mapBox = await page.locator(".mx-map").boundingBox();
  const noteBox = await page
    .getByRole("button", { name: "圖例", exact: true })
    .boundingBox();
  expect(noteBox!.y).toBeGreaterThanOrEqual(mapBox!.y);
  expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(
    mapBox!.y + mapBox!.height,
  );
  await page.screenshot({
    path: `../.scratch/frontend-api-integration/waste-compartments-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `../.scratch/frontend-api-integration/waste-compartments-preview-${testInfo.project.name}.png`,
  });
});

test("all map pages retain recycling and render one result per location", async ({
  page,
}) => {
  const f = wasteFixture();
  f.state.multiPage = true;
  await f.setup(page);
  await page.goto("/#map?waste_type=recycling");
  await expect(page.locator(".mx-list .location-row")).toHaveCount(2);
  await expect(page.locator(".mx-list")).toContainText("另一個位置");
  const reads = f.requests.filter((r) => r.path === "/map/locations");
  expect(reads.every((r) => r.waste === "recycling")).toBe(true);
  expect(reads.some((r) => r.offset === "1")).toBe(true);
});

test("expired recycling report restores the same waste draft and original command after login", async ({
  page,
}) => {
  const f = wasteFixture();
  f.state.expireReport = true;
  await f.setup(page);
  await login(page, "citizen", `report/${binId}?waste_type=recycling`);
  await captureReport(page);
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await page.getByRole("link", { name: "登入後繼續回報", exact: true }).click();
  await page.getByLabel("帳號", { exact: true }).fill("demo-citizen");
  await page
    .getByLabel("密碼", { exact: true })
    .fill("fixture-only-not-a-real-password");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "資源回收", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "重試原回報", exact: true }).click();
  await expect(page.getByText(/資源回收 · 分類依據/).first()).toBeVisible();
  const commands = f.requests.filter(
    (r) => r.path === "/reports" && r.method === "POST",
  );
  expect(commands).toHaveLength(2);
  expect(commands[0].body.waste_type).toBe("recycling");
  expect(commands[1]).toEqual(commands[0]);
});

test("arrow keys switch the report waste repeatedly, keep focus on the radio and keep each draft (N7)", async ({
  page,
}) => {
  const f = wasteFixture();
  await f.setup(page);
  await login(page, "citizen", `report/${binId}?waste_type=general`);
  const general = page.getByRole("radio", { name: "一般垃圾", exact: true });
  const recycling = page.getByRole("radio", { name: "資源回收", exact: true });
  const note = page.getByRole("textbox", { name: "說明", exact: true });
  await expect(general).toBeChecked();
  await note.fill("一般垃圾草稿");
  await general.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/waste_type=recycling/);
  await expect(recycling).toBeChecked();
  await expect(recycling).toBeFocused();
  await expect(note).toHaveValue("");
  await note.fill("資源回收草稿");
  await recycling.focus();
  // 連續按方向鍵：焦點一直在選中的那格，草稿每槽各自保存。
  await page.keyboard.press("ArrowLeft");
  await expect(general).toBeChecked();
  await expect(general).toBeFocused();
  await expect(note).toHaveValue("一般垃圾草稿");
  await page.keyboard.press("ArrowRight");
  await expect(recycling).toBeChecked();
  await expect(recycling).toBeFocused();
  await expect(note).toHaveValue("資源回收草稿");
  await page.keyboard.press("ArrowLeft");
  await expect(general).toBeFocused();
  await expect(note).toHaveValue("一般垃圾草稿");
});

test("the navigation waste picker keeps focus after the page reloads for the new waste (X5)", async ({
  page,
}) => {
  const f = wasteFixture();
  await f.setup(page);
  await page.goto(`/#nav/${binId}?waste_type=general`);
  // 導航頁改為一般垃圾、資源回收兩格單選（先一般再回收），不再是下拉選單。
  const general = page.getByRole("radio", { name: "一般垃圾" });
  const recycling = page.getByRole("radio", { name: "資源回收" });
  await expect(general).toBeChecked();
  await general.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/waste_type=recycling/);
  await expect(
    page.getByText("本次要丟：資源回收。", { exact: true }),
  ).toBeVisible();
  await expect(recycling).toBeChecked();
  await expect(recycling).toBeFocused();
});
