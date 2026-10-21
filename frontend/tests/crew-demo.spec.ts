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
  const identity = page.getByRole("navigation", { name: "Demo 身份切換" });
  await expect(
    identity.getByRole("link", { name: "清潔隊", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "開啟選單" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "待處理 6", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".crew-task-list .crew-task-card")).toHaveCount(6);
  await page.screenshot({
    path: info.outputPath("p18-dispatch.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "處理中 1", exact: true }).click();
  await expect(page.locator(".crew-task-list .crew-task-card")).toHaveCount(1);
  await page.getByRole("button", { name: "已完成 12", exact: true }).click();
  await expect(page.locator(".crew-task-list .crew-task-card")).toHaveCount(12);
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
    page.getByRole("heading", { name: "結案完成", exact: true }),
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
    page.getByRole("button", { name: "待處理 5", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "已完成 13", exact: true }),
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
    page.getByRole("heading", { name: "結案完成", exact: true }),
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

test("S3 shares road planning, invalidates the old mode and shows completed bins and progress", async ({
  page,
}, info) => {
  const requests = await setup(page);
  const modes: string[] = [];
  await page.route(
    "https://valhalla1.openstreetmap.de/route",
    async (route) => {
      const body = route.request().postDataJSON();
      modes.push(body.costing);
      const legs = body.locations
        .slice(1)
        .map(() => ({
          shape: "_x{vn@gx}xfFu@|@qFCcAjA",
          summary: { length: 0.2, time: 60 },
          maneuvers: [
            {
              type: 8,
              instruction: "Continue",
              length: 0.2,
              travel_type: body.costing === "auto" ? "car" : "motor_scooter",
            },
          ],
        }));
      await route.fulfill({
        json: {
          trip: {
            status: 0,
            units: "kilometers",
            summary: { length: legs.length * 0.2, time: legs.length * 60 },
            legs,
          },
        },
      });
    },
  );
  await page.goto("/#crew/route");
  await expect(
    page.getByRole("heading", { name: "今日清運路線", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "已完成清運桶數" }),
  ).toHaveAttribute("value", "9");
  await expect(page.locator(".crew-completed-bins li")).toHaveCount(9);
  await expect(page.locator(".staff-route-list")).not.toContainText("D-021");
  for (const [label, costing] of [
    ["機車（一般機車）", "motor_scooter"],
    ["汽車", "auto"],
  ]) {
    await page.getByRole("radio", { name: label, exact: true }).check();
    await expect(page.locator(".road-route")).toHaveCount(0);
    await page
      .getByRole("button", { name: "產生路線指引", exact: true })
      .click();
    await expect(page.locator(".road-route")).toHaveCount(1);
    expect(modes).toContain(costing);
  }
  await page.screenshot({
    path: info.outputPath("s3-road-progress.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", {
      name: "即刻處理 · 滿溢 92%＋桶旁堆放 · 查看工單",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "新生南路一段 #A-012", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).crewHardwareCalls)).toBe(0);
  expect(requests).toEqual([]);
});
