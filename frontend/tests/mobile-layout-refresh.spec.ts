import { test, expect } from "@playwright/test";
import { apiFixture, location, binId, envelope, status } from "./api-fixtures";
import { asPhone } from "./phone-report-fixture";

test.beforeEach(async ({ page }) => {
  await asPhone(page);
  const bins = Array.from({ length: 8 }, (_, i) => ({
    ...location,
    id: binId.slice(0, -1) + i,
    label: `新生南路 ${i + 1} 號 BinU`,
  }));
  await apiFixture(
    page,
    async (route, path) => {
      if (path === "/map/locations") {
        await route.fulfill({ json: envelope(bins) });
        return true;
      }
      if (path.endsWith("/view")) {
        const bin = bins.find((b) => path.includes(b.id)) || bins[0];
        await route.fulfill({
          json: {
            location: bin,
            status,
            compartments: location.compartments,
            can_report: false,
            report_block_reason: "login_required",
            can_apply_adoption: false,
            adopter: null,
            latest_cleanup: null,
            my_adoption_id: null,
          },
        });
        return true;
      }
    },
    { demo: true },
  );
});

test("compact M1 toolbar, three nearby rows and full M2 detail", async ({
  page,
}) => {
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(8);
  const toolbar = await page.locator(".mx-home-toolbar").boundingBox();
  const panel = await page.locator(".mx-panel").boundingBox();
  expect(toolbar!.y + toolbar!.height).toBeLessThan(panel!.y);
  expect(toolbar!.height).toBeLessThan(80);
  expect(
    (await page.locator(".m-tabs").boundingBox())!.height,
  ).toBeLessThanOrEqual(54);
  const third = await page.locator(".location-row").nth(2).boundingBox();
  expect(third!.y + third!.height).toBeLessThanOrEqual(
    panel!.y + panel!.height + 1,
  );
  await expect(
    page.getByRole("button", { name: "圖例", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "/tmp/binsoon-m1.png" });
  await page.getByRole("button", { name: "篩選桶況" }).click();
  await expect(
    page.getByRole("button", { name: "還能丟", exact: true }),
  ).toBeVisible();
  await page.locator(".location-row").first().click();
  await expect(page.locator(".mx-panel[data-view=bin]")).toBeVisible();
  const detail = await page.locator(".mx-panel").boundingBox();
  const layout = await page.locator(".mx-layout").boundingBox();
  expect(Math.abs(detail!.height - layout!.height)).toBeLessThan(2);
  await expect(page.locator(".bin-community")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/binsoon-m2.png" });
});

test("M4 automatic distance banner, multiple problems and simple success", async ({
  page,
}) => {
  await page.goto(`/#login?next=report/${binId.slice(0, -1)}0`);
  await page.getByRole("button", { name: "以市民登入", exact: true }).click();
  await expect(page.locator(".report-proximity.ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "分享目前位置" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/binsoon-m4.png" });
  await page.getByRole("button", { name: "現場拍照", exact: true }).click();
  await expect(page.locator(".ai-progress")).toHaveCount(0, { timeout: 10000 });
  await expect(
    page.getByRole("checkbox", { name: "很髒", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "很髒", exact: true }).check();
  await page.getByRole("checkbox", { name: "損壞", exact: true }).check();
  await page.screenshot({ path: "/tmp/binsoon-m4-photo.png" });
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "謝謝回報！", exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("binsoon-citizen-demo-v1")!).reports,
  );
  const fresh = stored.filter(
    (r: { id: string }) => !/^demo-report-[123]$/.test(r.id),
  );
  expect(fresh.map((r: { type: string }) => r.type)).toEqual(
    expect.arrayContaining(["dirty", "broken"]),
  );
  await expect(page.getByText("案件識別", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/binsoon-m4-done.png" });
});

test("desktop and 320px layouts keep controls within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(8);
  await page.screenshot({ path: "/tmp/binsoon-desktop.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.locator(".mx-home-toolbar")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/binsoon-narrow.png" });
});

test("M3 has a clear report CTA and compact navigation panel", async ({
  page,
}) => {
  await page.route("https://valhalla1.openstreetmap.de/route", (route) =>
    route.fulfill({
      json: {
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
                  type: 1,
                  instruction: "Walk north",
                  street_names: ["信義路"],
                  length: 0.3,
                  begin_shape_index: 0,
                  travel_type: "foot",
                },
                {
                  type: 4,
                  instruction: "You have arrived",
                  length: 0,
                  begin_shape_index: 3,
                  travel_type: "foot",
                },
              ],
            },
          ],
        },
      },
    }),
  );
  await page.goto(`/#nav/${binId.slice(0, -1)}3`);
  const report = page.getByRole("link", { name: "抵達後回報", exact: true });
  await expect(report).toBeVisible();
  const cta = await report.boundingBox();
  const tabs = await page.locator(".m-tabs").boundingBox();
  expect(cta!.y + cta!.height).toBeLessThanOrEqual(tabs!.y);
  expect(cta!.height).toBeGreaterThanOrEqual(48);
  await page.getByRole("button", { name: "開始導航", exact: true }).click();
  await expect(page.getByTestId("nav-banner")).toBeVisible();
  await page.screenshot({ path: "/tmp/binsoon-m3.png" });
});

test("multi-issue retry keeps successful reports and retries only the original failed command", async ({
  page,
}) => {
  const attempts: { type: string; key: string | undefined }[] = [];
  let failed = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/media") {
      await route.fulfill({ json: { id: "media-fixture" } });
      return true;
    }
    if (path === "/reports" && route.request().method() === "POST") {
      const type = route.request().postDataJSON().type;
      attempts.push({
        type,
        key: route.request().headers()["idempotency-key"],
      });
      if (type === "broken" && !failed) {
        failed = true;
        await route.fulfill({
          status: 503,
          json: {
            detail: { code: "UNAVAILABLE", message: "請稍後重試", fields: [] },
          },
        });
      } else
        await route.fulfill({
          json: { id: type === "dirty" ? "report-dirty" : "report-broken" },
        });
      return true;
    }
  });
  const { login } = await import("./api-fixtures");
  await login(page, "citizen", `report/${binId}`);
  await page.getByRole("button", { name: "現場拍照", exact: true }).click();
  await page.getByRole("checkbox", { name: "很髒", exact: true }).check();
  await page.getByRole("checkbox", { name: "損壞", exact: true }).check();
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("已送出 1 項");
  await page.getByRole("button", { name: "重試原回報", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "謝謝回報！", exact: true }),
  ).toBeVisible();
  expect(attempts.map((a) => a.type)).toEqual(["dirty", "broken", "broken"]);
  expect(attempts[1].key).toBeTruthy();
  expect(attempts[2].key).toBe(attempts[1].key);
});
