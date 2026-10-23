import { test, expect } from "@playwright/test";
import {
  countAt,
  dateLabel,
  routeFor,
  shifts,
  stops,
  type Booking,
} from "../src/data/vanDemo";
import {
  NOW,
  book,
  confirmName,
  dates,
  markers,
  mockValhalla,
  openMarker,
  pickSlot,
  stopById,
  trackApi,
} from "./van-helpers";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

const bookingsOf = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("binsoon-van-v1") || "[]") as Booking[],
  );

test("citizen booking lifecycle: browse, book, reload, edit, list, member entry, cancel", async ({
  page,
}) => {
  const api = trackApi(page);
  const stop = stopById("yongkang");
  const first = { date: dates[2], shift: "morning" as const };
  const second = { date: dates[3], shift: "evening" as const };

  // 我的頁：還沒有預約。
  await page.goto("/#login?next=member");
  await page.getByRole("button", { name: "以市民登入", exact: true }).click();
  const memberEntry = page.getByRole("link", { name: /我的小車預約/ });
  await expect(memberEntry).toContainText("還沒有預約");

  // 瀏覽：地圖 marker 與清單列各 5 個停靠點。
  await page.goto("/#van");
  await expect(
    page.getByRole("region", { name: "台北位置地圖" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "預約清運小車" }),
  ).toBeVisible();
  await expect(markers(page)).toHaveCount(stops.length);
  await expect(page.locator(".van-row")).toHaveCount(stops.length);
  for (const s of stops) {
    await expect(page.locator(`.van-row[data-id="${s.id}"]`)).toContainText(
      s.name,
    );
    await expect(
      markers(page).and(page.getByLabel(`小車停靠點：${s.name}`)),
    ).toHaveCount(1);
  }

  // 開抽屜：日期列 7 天（明天起）、兩個時段、未選時確認鈕停用。
  await page.locator(`.van-row[data-id="${stop.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`#van/stop/${stop.id}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: stop.name }),
  ).toBeVisible();
  await expect(page.locator(".van-datechip")).toHaveCount(7);
  await expect(page.locator(".van-datechip").first()).toContainText(
    dateLabel(dates[0]).split("（")[0],
  );
  await expect(page.locator(".van-slot")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "請先選一個時段" }),
  ).toBeDisabled();

  await pickSlot(page, first.date, first.shift);
  await page
    .getByRole("button", {
      name: confirmName(first.date, first.shift, stop.id),
      exact: true,
    })
    .click();

  // 預約詳情。
  await expect(page).toHaveURL(/#van\/booking\/[^/?]+$/);
  const id = new URL(page.url()).hash.split("/").pop()!;
  const expectDetail = async (slot: {
    date: string;
    shift: "morning" | "evening";
  }) => {
    const detail = page.locator(".van-detail");
    await expect(detail).toContainText(
      `${dateLabel(slot.date)} ${shifts[slot.shift].name}`,
    );
    await expect(detail).toContainText(shifts[slot.shift].time);
    await expect(detail).toContainText(`${stop.name} · ${stop.address}`);
    // 預約後人數 = 基準人數 + 1（含自己）。
    const expected = countAt(
      [{ id, ...slot, stop: stop.id }],
      slot.date,
      slot.shift,
      stop.id,
    );
    expect(expected).toBe(countAt([], slot.date, slot.shift, stop.id) + 1);
    await expect(detail.locator("b")).toHaveText(String(expected));
  };
  await expectDetail(first);

  // 重新整理後仍在。
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`#van/booking/${id}$`));
  await expectDetail(first);
  expect(await bookingsOf(page)).toEqual([{ id, ...first, stop: stop.id }]);

  // 修改：換日期與時段，id 不變、仍只有一筆。
  await page.getByRole("button", { name: "修改預約" }).click();
  await expect(page).toHaveURL(
    new RegExp(`#van/stop/${stop.id}\\?edit=${id}$`),
  );
  await expect(page.locator(".van-datechip").nth(2)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator(".van-slot").filter({ hasText: "早班" }),
  ).toHaveAttribute("aria-pressed", "true");
  await pickSlot(page, second.date, second.shift);
  await page
    .getByRole("button", {
      name: confirmName(second.date, second.shift, stop.id, "更新預約"),
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`#van/booking/${id}$`));
  await expectDetail(second);
  expect(await bookingsOf(page)).toEqual([{ id, ...second, stop: stop.id }]);

  // 我的預約列表：只有一筆，內容正確。
  await page.goto("/#van/mine");
  await expect(
    page.getByRole("heading", { name: "我的小車預約" }),
  ).toBeVisible();
  const rows = page.locator(".van-booking");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(
    `${dateLabel(second.date)} ${shifts[second.shift].name} · ${stop.name}`,
  );
  await expect(rows).toContainText(
    `目前 ${countAt([{ id, ...second, stop: stop.id }], second.date, second.shift, stop.id)} / 10 人`,
  );

  // 我的頁入口列副標。
  await page.goto("/#member");
  await expect(memberEntry).toContainText(
    `1 筆預約 · 最近 ${dateLabel(second.date)}${shifts[second.shift].name} ${stop.name}`,
  );
  await memberEntry.click();
  await expect(page).toHaveURL(/#van\/mine$/);

  // 取消 → 空狀態與 CTA。
  await rows.click();
  await expect(page).toHaveURL(new RegExp(`#van/booking/${id}$`));
  await page.getByRole("button", { name: "取消預約" }).click();
  await expect(page).toHaveURL(/#van\/mine$/);
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("還沒有預約。")).toBeVisible();
  expect(await bookingsOf(page)).toEqual([]);
  await page.goto("/#member");
  await expect(memberEntry).toContainText("還沒有預約");
  await page.goto("/#van/mine");
  await page.getByRole("link", { name: "預約清運小車" }).click();
  await expect(page).toHaveURL(/#van$/);
  await expect(
    page.getByRole("heading", { name: "預約清運小車" }),
  ).toBeVisible();

  expect(api).toEqual([]);
});

test("a slot you already booked is disabled and cannot be chosen again", async ({
  page,
}) => {
  const api = trackApi(page);
  const stopId = "dongmen";
  const date = dates[1];
  await book(page, stopId, date, "morning");

  await page.goto(`/#van/stop/${stopId}`);
  await page.locator(".van-datechip").nth(1).click();
  const morning = page.locator(".van-slot").filter({ hasText: "早班" });
  const evening = page.locator(".van-slot").filter({ hasText: "晚班" });
  await expect(morning).toContainText("你已預約");
  await expect(morning).toBeDisabled();
  await expect(evening).toBeEnabled();
  await expect(evening).not.toContainText("你已預約");
  // 停用的時段點不下去，確認鈕仍是「請先選一個時段」。
  await morning.click({ force: true });
  await expect(
    page.getByRole("button", { name: "請先選一個時段" }),
  ).toBeDisabled();
  // 換一天，同時段又可以選。
  await page.locator(".van-datechip").nth(2).click();
  await expect(morning).toBeEnabled();
  expect(await bookingsOf(page)).toHaveLength(1);
  expect(api).toEqual([]);
});

test("citizen booking is reflected in crew van headcount and collection flow", async ({
  page,
}) => {
  const api = trackApi(page);
  const drivingRequests = await mockValhalla(page);
  const date = dates[0];
  const shift = "evening" as const; // CrewVan 預設班表：明天晚班
  const total = (b: Booking[]) =>
    routeFor(b, date, shift).reduce((n, s) => n + s.total, 0);
  const scheduleTotal = page
    .locator(".card")
    .filter({ hasText: "前一天 20:00 統計" })
    .locator("strong");

  await page.goto("/#crew/van");
  await expect(
    page.getByRole("heading", { name: "清運小車班表" }),
  ).toBeVisible();
  const baseline = total([]);
  await expect(scheduleTotal).toHaveText(`${baseline} 人`);

  const id = await book(page, "dongmen", date, shift);
  const bookings: Booking[] = [{ id, date, shift, stop: "dongmen" }];
  expect(total(bookings)).toBe(baseline + 1);

  await page.goto("/#crew/van");
  await expect(scheduleTotal).toHaveText(`${baseline + 1} 人`);
  const route = routeFor(bookings, date, shift);
  await expect(page.locator(".van-content")).toContainText(
    `開 ${route.length} · 併 ${route.flatMap((s) => s.merged).length}`,
  );
  await page.getByRole("button", { name: "開始導航 · 第 1 站" }).click();
  await expect(
    page.getByRole("heading", { name: "導航到第 1 站" }),
  ).toBeVisible();
  await expect(page.locator(".van-map-navigation .road-route")).toBeVisible();
  await expect(page.getByText("約 5 分鐘 · 1.8 km")).toBeVisible();
  await expect(page.locator(".van-route-sheet")).toContainText(
    `預計 ${route[0].total} 人`,
  );
  await page.getByRole("button", { name: "✓ 到站了，開始收運" }).click();
  expect(drivingRequests[0].costing).toBe("auto");
  await expect(page.locator(".van-collect")).toContainText("剩 15 分鐘");
  await page.clock.setFixedTime(new Date(NOW.getTime() + 60000));
  await expect(page.locator(".van-collect")).toContainText("剩 14 分鐘");
  await expect(page.locator(".van-content")).toContainText(
    `${route[0].total} 人`,
  );

  if (route.length > 1) {
    await page.getByRole("button", { name: "本站完成，導航到第 2 站" }).click();
    await expect(
      page.getByRole("heading", { name: "導航到第 2 站" }),
    ).toBeVisible();
    await expect(page.locator(".road-route")).toBeVisible();
    expect(drivingRequests.at(-1)!.costing).toBe("auto");
    expect(drivingRequests.at(-1)!.locations[0]).toMatchObject(
      drivingRequests[0].locations[1],
    );
  }

  // 取消預約後，清潔隊端人數回到基準。
  await page.goto(`/#van/booking/${id}`);
  await page.getByRole("button", { name: "取消預約" }).click();
  await page.goto("/#crew/van");
  await expect(scheduleTotal).toHaveText(`${baseline} 人`);
  expect(api).toEqual([]);
});

test("van layout has no horizontal overflow", async ({ page }, info) => {
  await page.goto("/#van");
  await expect(
    page.getByRole("heading", { name: "預約清運小車" }),
  ).toBeVisible();
  await expect(markers(page)).toHaveCount(stops.length);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: info.outputPath(`van-${info.project.name}.png`),
    fullPage: true,
  });
  await page.locator(".van-row").first().click();
  await expect(page.locator(".van-datechip")).toHaveCount(7);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/#crew/van");
  await expect(
    page.getByRole("heading", { name: "清運小車班表" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath(`van-crew-${info.project.name}.png`),
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

test("tapping another map stop swaps the drawer content without a page jump", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile",
    "drawer behavior is mobile-specific",
  );
  const api = trackApi(page);
  await page.goto("/#van");
  await page.evaluate(
    () => ((window as unknown as { __kept: number }).__kept = 1),
  );
  await page.locator('.van-row[data-id="dongmen"]').click();
  const section = page.getByRole("region", { name: "停靠點詳情" });
  await expect(section.getByRole("heading", { level: 1 })).toHaveText(
    stopById("dongmen").name,
  );
  await expect(page.locator(".mx-layout")).toHaveAttribute(
    "data-drawer",
    "half",
  );

  await openMarker(page, "jinhua");
  await expect(page).toHaveURL(/#van\/stop\/jinhua$/);
  await expect(section.getByRole("heading", { level: 1 })).toHaveText(
    stopById("jinhua").name,
  );
  await expect(page.locator(".van-datechip")).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "請先選一個時段" }),
  ).toBeDisabled();
  // 同一個文件，沒有整頁重載。
  expect(
    await page.evaluate(
      () => (window as unknown as { __kept?: number }).__kept,
    ),
  ).toBe(1);
  expect(api).toEqual([]);
});
