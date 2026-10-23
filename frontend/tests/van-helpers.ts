import { expect, type Page } from "@playwright/test";
import {
  addDays,
  dateLabel,
  shifts,
  shortDate,
  stops,
  today,
  type Shift,
} from "../src/data/vanDemo";

// 固定「現在」：台北 2026-10-23 16:00（尚未到 20:00，當天不會公布隔天路線）。
export const NOW = new Date("2026-10-23T08:00:00Z");
export const dates = Array.from({ length: 7 }, (_, i) =>
  addDays(today(NOW), i + 1),
);
export const stopById = (id: string) => stops.find((s) => s.id === id)!;

export function trackApi(page: Page) {
  const api: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/v1/")) api.push(r.url());
  });
  return api;
}

export async function mockValhalla(page: Page) {
  const requests: {
    costing: string;
    locations: { lat: number; lon: number }[];
  }[] = [];
  await page.route(
    "https://valhalla1.openstreetmap.de/route",
    async (route) => {
      requests.push(route.request().postDataJSON());
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
  return requests;
}

export const markers = (page: Page) =>
  page.locator('[aria-label^="小車停靠點："]');
export const marker = (page: Page, stopId: string) =>
  page.locator(`[aria-label="小車停靠點：${stopById(stopId).name}"]`);

// 地圖 marker 是 Leaflet 的鍵盤可聚焦元素；手機上被抽屜遮住時用鍵盤開啟最穩。
export async function openMarker(page: Page, stopId: string) {
  const m = marker(page, stopId);
  await m.focus();
  await page.keyboard.press("Enter");
}

export async function pickSlot(page: Page, date: string, shift: Shift) {
  await page.locator(".van-datechip").nth(dates.indexOf(date)).click();
  await expect(
    page.locator(".van-datechip").nth(dates.indexOf(date)),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator(".van-slot")
    .filter({ hasText: shifts[shift].name })
    .click();
}

export const confirmName = (
  date: string,
  shift: Shift,
  stopId: string,
  verb = "預約",
) =>
  `${verb} ${shortDate(date)} ${shifts[shift].name} · ${stopById(stopId).name}`;

// 從 #van 清單開某站、選日期與時段、確認，回傳預約 id。
export async function book(
  page: Page,
  stopId: string,
  date: string,
  shift: Shift,
) {
  await page.goto("/#van");
  await page.locator(`.van-row[data-id="${stopId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`#van/stop/${stopId}$`));
  await pickSlot(page, date, shift);
  await page
    .getByRole("button", {
      name: confirmName(date, shift, stopId),
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#van\/booking\/[^/?]+$/);
  return new URL(page.url()).hash.split("/").pop()!;
}

export { dateLabel };
