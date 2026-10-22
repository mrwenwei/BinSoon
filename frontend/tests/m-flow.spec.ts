import { test, expect } from "@playwright/test";
import { apiFixture, binId, location, status, envelope } from "./api-fixtures";
import { asPhone } from "./phone-report-fixture";

const nextId = "10000000-0000-4000-8000-000000000009";

test("M4 simulates AI analysis after capture, allows correction and keeps waste drafts separate", async ({
  page,
}, info) => {
  await asPhone(page);
  let writes = 0;
  await apiFixture(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") writes++;
      if (path === `/bins/${binId}/view`) {
        await route.fulfill({
          json: {
            location,
            status,
            compartments: location.compartments,
            can_report: true,
            adopter: null,
            latest_cleanup: null,
          },
        });
        return true;
      }
    },
    { demo: true },
  );
  await page.goto(`/#login?next=report/${binId}`);
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  await page
    .getByRole("button", { name: "分享目前位置（模擬）", exact: true })
    .click();
  await page
    .getByRole("button", { name: "現場拍照（模擬）", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "AI 判讀中" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認送出回報", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "問題類型", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "已幫你選好" }),
  ).toBeVisible();
  const chosen = await page
    .getByRole("combobox", { name: "問題類型", exact: true })
    .inputValue();
  expect(["full", "dirty"]).toContain(chosen);
  await page
    .getByRole("combobox", { name: "問題類型", exact: true })
    .selectOption("broken");
  await expect(
    page.getByRole("combobox", { name: "問題類型", exact: true }),
  ).toHaveValue("broken");
  await page.screenshot({
    path: info.outputPath("m4-ai-result.png"),
    fullPage: true,
  });
  await page.getByRole("radio", { name: "資源回收", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "待送出的模擬測試照片" }),
  ).toHaveCount(0);
  await expect(page.getByText(/已幫你選好/)).toHaveCount(0);
  expect(writes).toBe(0);
});

test("M3 offers a same-stream usable replacement before changing the route", async ({
  page,
}, info) => {
  const full = {
    ...status,
    fill_status: "full",
    fill_level_pct: 100,
    is_usable: false,
  };
  const hungry = {
    ...status,
    is_usable: true,
    fill_status: "hungry",
    fill_level_pct: 20,
    unavailable_reasons: [],
  };
  await apiFixture(page, async (route, path) => {
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location,
          status: full,
          can_report: true,
          adopter: null,
          latest_cleanup: null,
        },
      });
      return true;
    }
    if (path === "/map/nearest-usable") {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("waste_type")).toBe("recycling");
      expect(url.searchParams.get("exclude_bin_id")).toBe(binId);
      await route.fulfill({
        json: {
          items: [
            {
              ...location,
              id: nextId,
              label: "最近未滿的回收桶",
              bin_status: hungry,
            },
          ],
        },
      });
      return true;
    }
  });
  await page.goto(`/#nav/${binId}?waste_type=recycling`);
  await expect(page.getByRole("region", { name: "滿桶改導" })).toContainText(
    "吃飽了",
  );
  await expect(
    page.getByRole("link", { name: "抵達後回報", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "改導到 最近未滿的回收桶", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "最近未滿的回收桶", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "抵達後回報", exact: true }),
  ).toHaveAttribute("href", `#report/${nextId}?waste_type=recycling`);
  await page.screenshot({
    path: info.outputPath("m3-rerouted.png"),
    fullPage: true,
  });
});

test("map and voting are separate tabs with no proposed bins leaking into the bin map", async ({
  page,
}, info) => {
  const proposed = {
    ...location,
    id: nextId,
    label: "待現勘建議點",
    bin_type: "proposed",
    placement_status: "proposed",
  };
  await apiFixture(
    page,
    async (route, path) => {
      if (path === "/map/locations") {
        await route.fulfill({ json: envelope([location, proposed]) });
        return true;
      }
    },
    { demo: true },
  );
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(1);
  await expect(page.locator(".location-row")).toContainText(location.label);
  await expect(
    page.getByRole("button", { name: "建議點", exact: true }),
  ).toHaveCount(0);
  const tabs = page.getByRole("navigation", { name: "主要分頁" });
  await page.screenshot({
    path: info.outputPath("m1-map.png"),
    fullPage: true,
  });
  await tabs.getByRole("link", { name: "要桶投票", exact: true }).click();
  await expect(page.locator(".location-row")).toHaveCount(3);
  await expect(
    page.locator(".location-row").filter({ hasText: proposed.label }),
  ).toContainText(proposed.label);
  await expect(
    tabs.getByRole("link", { name: "要桶投票", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({
    path: info.outputPath("v1-vote.png"),
    fullPage: true,
  });
});

test("M1 puts phone controls in its sheet and desktop controls above the map with accessible notices", async ({
  page,
}, info) => {
  await apiFixture(page, undefined, { demo: true });
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(1);
  const toolbar = page.locator(".mx-home-toolbar");
  const search = page.getByRole("searchbox", { name: "搜尋地點", exact: true });
  const panel = page.getByRole("region", { name: "資訊面板" });
  const notice = page.getByRole("region", { name: "找桶小提醒" });
  await expect(
    toolbar.getByRole("radio", { name: "一般垃圾", exact: true }),
  ).toBeVisible();
  await expect(
    toolbar.getByRole("button", { name: "還能丟", exact: true }),
  ).toBeVisible();
  expect((await search.boundingBox())!.y).toBeLessThan(
    (await page.locator(".location-row").first().boundingBox())!.y,
  );
  expect((await notice.boundingBox())!.y).toBeGreaterThan(
    (await search.boundingBox())!.y,
  );
  await expect(panel.getByRole("searchbox")).toHaveCount(
    info.project.name === "mobile" ? 1 : 0,
  );
  const track = notice.locator(".map-notice-track");
  await expect(track).toHaveCSS("animation-timing-function", "linear");
  await expect(panel.locator(".mx-head-title .tiny")).toHaveCount(0);
  await expect(notice.getByRole("button")).toHaveCount(0);
  await notice.focus();
  await expect(track).toHaveCSS("animation-play-state", "paused");
  await search.focus();
  if (info.project.name === "desktop") {
    await notice.hover();
    await expect(track).toHaveCSS("animation-play-state", "paused");
  }
  await search.focus();
  await page.mouse.move(0, 0);
  await expect(track).toHaveCSS("animation-play-state", "running");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/binsoon-m1-${info.project.name}.png`,
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(track).toHaveCSS("animation-name", "none");
  await expect(notice.getByRole("button")).toHaveCount(0);
  await expect(track.locator(".map-notice-repeat")).toBeHidden();
});
