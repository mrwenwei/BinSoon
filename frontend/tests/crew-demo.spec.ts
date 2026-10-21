import { test, expect, type Page } from "@playwright/test";
import { asPhone } from "./phone-report-fixture";

async function setup(page: Page, phone = false) {
  if (phone) await asPhone(page);
  const requests: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    requests.push(
      route.request().method() + " " + new URL(route.request().url()).pathname,
    );
    await route.abort();
  });
  await page.addInitScript(() => {
    (window as any).crewHardwareCalls = 0;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: () => {
          (window as any).crewHardwareCalls++;
          throw new Error("Real GPS must not be used");
        },
      },
    });
    if (navigator.mediaDevices)
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: () => {
          (window as any).crewHardwareCalls++;
          throw new Error("Real camera must not be used");
        },
      });
  });
  await page.goto("/#crew");
  await page
    .getByRole("button", { name: "以模擬清潔員登入", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "今日派工", exact: true }),
  ).toBeVisible();
  return requests;
}

test("one crew menu entry opens one-click local login, three dispatch tabs and reload-safe sign-out", async ({
  page,
}, info) => {
  const requests = await setup(page);
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  const menu = page.getByRole("navigation", { name: "側邊選單" });
  await expect(menu.locator('a[href^="#crew"]')).toHaveCount(1);
  await expect(
    menu.getByRole("link", { name: "清潔員管理入口", exact: true }),
  ).toBeVisible();
  await expect(
    menu.locator('a[href^="#staff"], a[href^="#admin"], a[href="#outcomes"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "關閉選單", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "待處理 5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".crew-task-list > a")).toHaveCount(5);
  await page.screenshot({
    path: info.outputPath("p18-dispatch.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "處理中 1", exact: true }).click();
  await expect(page.locator(".crew-task-list > a")).toHaveCount(1);
  await page.getByRole("button", { name: "已完成 9", exact: true }).click();
  await expect(page.locator(".crew-task-list > a")).toHaveCount(9);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "今日派工", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "登出清潔員", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "以模擬清潔員登入", exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("phone field work requires arrival, verdict, composition and fake completion photo; optional interior photo persists", async ({
  page,
}, info) => {
  const requests = await setup(page, true);
  await page.locator('a[href="#crew/task/A-012"]').click();
  const complete = page.getByRole("button", { name: "完成清運", exact: true });
  await expect(complete).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "拍完成照（模擬）", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "確認到場，開始處理（模擬）", exact: true })
    .click();
  await page.getByRole("button", { name: "屬實", exact: true }).click();
  await expect(complete).toBeDisabled();
  await page.getByRole("button", { name: "家戶垃圾", exact: true }).click();
  await expect(complete).toBeDisabled();
  await page
    .getByRole("button", { name: "拍完成照（模擬）", exact: true })
    .click();
  await expect(complete).toBeEnabled();
  await page
    .getByRole("button", { name: "加拍桶內照（模擬・選填）", exact: true })
    .click();
  for (const name of ["待確認的模擬完成照", "待確認的模擬桶內照"])
    await expect(page.getByRole("img", { name, exact: true })).toHaveAttribute(
      "src",
      /^data:image\/svg\+xml,/,
    );
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("p19-field-work.png"),
    fullPage: true,
  });
  await complete.click();
  await expect(
    page.getByRole("heading", { name: "已完成清運", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("img", { name: "已保存的模擬完成照", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "已保存的模擬桶內照", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "完成清運", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "返回今日派工", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "待處理 4", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "已完成 10", exact: true }),
  ).toBeVisible();
  // A second task can complete without an optional interior image.
  await page.getByRole("button", { name: "處理中 1", exact: true }).click();
  await page.locator('a[href="#crew/task/A-006"]').click();
  await page.getByRole("button", { name: "不實", exact: true }).click();
  await page.getByRole("button", { name: "混合", exact: true }).click();
  await page
    .getByRole("button", { name: "拍完成照（模擬）", exact: true })
    .click();
  await page.getByRole("button", { name: "完成清運", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "已完成清運", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).crewHardwareCalls)).toBe(0);
  expect(requests).toEqual([]);
});

test("desktop cannot perform field work even at phone width", async ({
  browser,
}) => {
  for (const width of [1440, 393, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: false,
    });
    const page = await context.newPage();
    const requests = await setup(page);
    await page.goto("/#crew/task/A-012");
    await expect(
      page.getByRole("heading", { name: "請使用手機現場處理", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /拍完成照|加拍桶內照|完成清運|確認到場/,
      }),
    ).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    expect(requests).toEqual([]);
    await context.close();
  }
});

test("illustrative routes switch walking scooter and car without GPS, tiles or a routing service", async ({
  page,
}, info) => {
  const requests = await setup(page);
  const external: string[] = [];
  await page.route(/valhalla|tiles\.openfreemap/, async (route) => {
    external.push(route.request().url());
    await route.abort();
  });
  await page
    .getByRole("link", { name: "看今日建議路線（4 個桶 · 模擬）", exact: true })
    .click();
  await expect(page.locator(".crew-route-stops li")).toHaveCount(4);
  await expect(page.locator(".crew-route-stops")).not.toContainText("D-021");
  const paths = new Set<string>();
  for (const [label, time] of [
    ["步行", 35],
    ["機車", 12],
    ["汽車", 18],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("img", {
        name: `${label}模擬清運路線，4 個停靠點`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`約 ${time} 分鐘`))).toBeVisible();
    paths.add((await page.locator(".crew-route-line").getAttribute("points"))!);
  }
  expect(paths.size).toBe(3);
  await page.screenshot({
    path: info.outputPath("p20-route.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "開始導航（模擬）", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "汽車模擬導航已開始", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "前往第一張派工單", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "新生南路一段 #A-012", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).crewHardwareCalls)).toBe(0);
  expect(external).toEqual([]);
  expect(requests).toEqual([]);
});
