import { test, expect } from "@playwright/test";
import { apiFixture, binId, location, status, envelope } from "./api-fixtures";

test("public demo varies bin fullness consistently and keeps the bottom sheet compact", async ({
  page,
}) => {
  let histories = 0;
  const bins = Array.from({ length: 10 }, (_, i) => ({
    ...location,
    id: binId.slice(0, -1) + i,
    label: `展示 Bin友 ${i}`,
  }));
  await apiFixture(
    page,
    async (route, path) => {
      if (path === "/map/locations") {
        await route.fulfill({ json: envelope(bins) });
        return true;
      }
      if (path.endsWith("/view")) {
        const bin = bins.find((b) => path.includes(b.id))!;
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
      if (path.endsWith("/history")) histories++;
    },
    { demo: true },
  );
  await page.goto("/");
  await expect(page.locator(".location-row")).toHaveCount(10);
  await expect(
    page.locator(".location-row").getByRole("img", { name: /一般垃圾.*，0%$/ }),
  ).toHaveCount(1);
  await expect(
    page
      .locator(".location-row")
      .getByRole("img", { name: /一般垃圾.*，50%$/ }),
  ).toHaveCount(1);
  await expect(
    page
      .locator(".location-row")
      .getByRole("img", { name: /一般垃圾.*，100%$/ }),
  ).toHaveCount(1);
  const row = page
    .locator(".location-row")
    .filter({ has: page.getByRole("img", { name: /一般垃圾.*，50%$/ }) });
  await row.click();
  await expect(page.getByRole("region", { name: "各類桶槽" })).toContainText(
    "50%",
  );
  await expect(
    page.getByRole("heading", { name: "滿度與清運歷史" }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "位置詳情" })).toHaveCount(0);
  expect(histories).toBe(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "各類桶槽" })).toContainText(
    "50%",
  );
});

test("citizen signs in without credentials and sees a persistent fictional membership", async ({
  page,
}) => {
  let privateRequests = 0;
  await apiFixture(
    page,
    async (_route, path) => {
      if (path.startsWith("/me") || path.startsWith("/auth")) privateRequests++;
    },
    { demo: true },
  );
  await page.goto("/#login?next=member");
  await expect(page.getByLabel("密碼", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "會員中心", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("累積點數 128", { exact: true })).toBeVisible();
  await expect(page.getByText("可用點數 93", { exact: true })).toBeVisible();
  await expect(page.getByText(/屬實回報 3 次/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("可用點數 93", { exact: true })).toBeVisible();
  expect(privateRequests).toBe(0);
});

test("citizen reports, creates proposals, votes and redeems entirely locally across reload", async ({
  page,
}) => {
  const writes: string[] = [];
  const privateHeaders: string[] = [];
  await apiFixture(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") writes.push(path);
      if (route.request().headers().authorization) privateHeaders.push(path);
    },
    { demo: true },
  );
  await page.goto(`/#login?next=${encodeURIComponent(`report/${binId}`)}`);
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  await page
    .getByRole("button", { name: "使用此桶座標（模擬 GPS）", exact: true })
    .click();
  await page.getByRole("button", { name: "產生示意照片", exact: true }).click();
  await page.getByLabel("確認使用模擬測試位置，非實測 GPS").check();
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(page).toHaveURL(/#report-done\//);
  const reportUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "謝謝你幫城市變乾淨！", exact: true }),
  ).toBeVisible();
  await page.goto("/#vote/create");
  await page
    .getByRole("textbox", { name: "提案名稱", exact: true })
    .fill("展示 Bin友提案");
  await page
    .getByRole("textbox", { name: "需求原因", exact: true })
    .fill("本機示意需求，非真實設置。");
  await page.getByLabel("緯度", { exact: true }).fill("25.037");
  await page.getByLabel("經度", { exact: true }).fill("121.5358");
  await page.getByRole("button", { name: "查詢周邊位置", exact: true }).click();
  await page.getByRole("button", { name: "送出提案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "提案已建立", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "查看提案與投票", exact: true }).click();
  await expect(
    page.getByText("支持 1 · 反對 0 · 投票人數 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "反對", exact: true }).click();
  await expect(
    page.getByText("支持 0 · 反對 1 · 投票人數 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "撤票", exact: true }).click();
  await expect(
    page.getByText("支持 0 · 反對 0 · 投票人數 0", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("支持 0 · 反對 0 · 投票人數 0", { exact: true }),
  ).toBeVisible();
  await page.goto("/#rewards");
  await page
    .getByRole("button", { name: "選擇 Bin友超商展示券", exact: true })
    .click();
  await page.getByRole("button", { name: "確認兌換", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "兌換成功", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "會員中心，目前 58 點", exact: true }),
  ).toBeVisible();
  await page.goto("/#member");
  await expect(page.getByText("可用點數 58", { exact: true })).toBeVisible();
  await expect(page.getByText("待確認點數 3", { exact: true })).toBeVisible();
  await page.goto(reportUrl);
  await expect(
    page.getByRole("heading", { name: "謝謝你幫城市變乾淨！", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  expect(privateHeaders).toEqual([]);
});

test("demo notifications and adoption preferences stay local and can be changed or ended", async ({
  page,
}) => {
  const writes: string[] = [];
  await apiFixture(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") writes.push(path);
    },
    { demo: true },
  );
  await page.goto("/#login?next=notifications");
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  await page.getByRole("button", { name: "標為已讀", exact: true }).click();
  await expect(page.getByText(/已讀時間：/)).toBeVisible();
  await page.goto("/#adopt/demo-adoption-1");
  await expect(
    page.getByText("認養狀態：認養中", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("滿桶通知", { exact: true }).uncheck();
  await page.getByLabel("桶旁堆放通知", { exact: true }).uncheck();
  await page.getByLabel("髒污通知", { exact: true }).check();
  await page.getByRole("button", { name: "預覽更新偏好", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("目前通知：滿桶 關閉、堆放 關閉、髒污 開啟", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "結束認養", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("認養狀態：已結束", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("認養狀態：已結束", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("demo surfaces fit desktop and 320px phones and use the Bin友 wording", async ({
  page,
}, info) => {
  await apiFixture(page, undefined, { demo: true });
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 844 });
  for (const route of ["map", `bin/${binId}`, "login?next=member"]) {
    await page.goto(`/#${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: info.outputPath(`demo-${route.split("/")[0].split("?")[0]}.png`),
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  await expect(page.getByText("可用點數 93", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("電子雞");
  await page.screenshot({
    path: info.outputPath("demo-member.png"),
    fullPage: true,
  });
});

test("two demo tabs cannot spend the same points twice", async ({
  page,
  context,
}) => {
  const writes: string[] = [];
  const setup = async (tab: import("@playwright/test").Page) => {
    await apiFixture(
      tab,
      async (route, path) => {
        if (route.request().method() !== "GET") writes.push(path);
      },
      { demo: true },
    );
    await tab.goto("/#login?next=rewards");
    await tab
      .getByRole("button", { name: "以展示市民登入", exact: true })
      .click();
    await tab
      .getByRole("button", { name: "選擇 Bin友咖啡展示券", exact: true })
      .click();
  };
  await setup(page);
  const second = await context.newPage();
  await setup(second);
  await Promise.all([
    page.getByRole("button", { name: "確認兌換", exact: true }).click(),
    second.getByRole("button", { name: "確認兌換", exact: true }).click(),
  ]);
  await expect
    .poll(
      async () =>
        (await page
          .getByRole("heading", { name: "兌換成功", exact: true })
          .count()) +
        (await second
          .getByRole("heading", { name: "兌換成功", exact: true })
          .count()),
    )
    .toBe(1);
  await page.goto("/#member");
  await expect(page.getByText("可用點數 23", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test("unavailable local storage never falls back to writing a report to the backend", async ({
  page,
}) => {
  const writes: string[] = [];
  await apiFixture(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") writes.push(path);
    },
    { demo: true },
  );
  await page.addInitScript(() => {
    const save = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "binsoon-citizen-demo-v1")
        throw new DOMException("Full", "QuotaExceededError");
      return save.call(this, key, value);
    };
  });
  await page.goto(`/#login?next=${encodeURIComponent(`report/${binId}`)}`);
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  await page.getByRole("button", { name: "產生示意照片", exact: true }).click();
  await page
    .getByRole("button", { name: "使用此桶座標（模擬 GPS）", exact: true })
    .click();
  await page.getByLabel("確認使用模擬測試位置，非實測 GPS").check();
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("本機展示儲存空間不足");
  await expect(page).toHaveURL(new RegExp(`#report/${binId}$`));
  expect(writes).toEqual([]);
});
