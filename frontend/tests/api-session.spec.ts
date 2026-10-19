import { test, expect } from "@playwright/test";
import {
  apiFixture,
  expectAccountName,
  login,
  logoutButton,
  navLink,
} from "./api-fixtures";

test("citizen and staff tabs keep independent sessions and logout removes private data", async ({
  page,
  context,
}) => {
  await apiFixture(page);
  await login(page, "citizen", "member");
  await expect(page.getByText("可用點數 0", { exact: true })).toBeVisible();
  const crew = await context.newPage();
  await apiFixture(crew);
  await login(crew, "staff", "staff/tasks");
  await page.bringToFront();
  await expectAccountName(page, "測試citizen");
  await expect(page.getByText("可用點數 0", { exact: true })).toBeVisible();
  await (await logoutButton(page)).click();
  await expect(page.getByText("可用點數 0", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "請以市民身份登入" }),
  ).toBeVisible();
  await crew.bringToFront();
  await expectAccountName(crew, "測試staff");
  await expect(await logoutButton(crew)).toBeVisible();
  expect(await crew.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await crew.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
});

test("login refuses a different role and throttles without automatic retries", async ({
  page,
}) => {
  let attempts = 0;
  await apiFixture(page, async (route, path) => {
    if (path === "/auth/demo/login" && ++attempts === 1) {
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "60" },
        json: {
          detail: { code: "RATE_LIMITED", message: "請稍候再試", fields: [] },
        },
      });
      return true;
    }
  });
  await page.goto("/#staff/login");
  await page.getByLabel("帳號", { exact: true }).fill("demo-citizen");
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("請稍候再試");
  await expect(
    page.getByRole("button", { name: "請稍候再登入", exact: true }),
  ).toBeDisabled();
  expect(attempts).toBe(1);
  await page.reload();
  await page.getByLabel("帳號", { exact: true }).fill("demo-citizen");
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("沒有這個入口需要的角色");
  await expect(
    page.getByRole("button", { name: "登出", exact: true }),
  ).toHaveCount(0);
});

test("session expiry removes membership and requires login again", async ({
  page,
}) => {
  await apiFixture(page, async (route, path) => {
    if (path === "/auth/demo/login") {
      await route.fulfill({
        json: {
          access_token: "fixture-citizen",
          token_type: "bearer",
          expires_at: new Date(Date.now() + 2000).toISOString(),
          user: {
            id: "citizen-uuid",
            display_name: "即將過期",
            roles: ["citizen"],
            districts: [],
            auth_source: "demo",
          },
        },
      });
      return true;
    }
  });
  await login(page, "citizen", "member");
  await expect(page.getByText("可用點數 0", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "請以市民身份登入" }),
  ).toBeVisible({ timeout: 6000 });
  await expect(page.getByText("可用點數 0", { exact: true })).toHaveCount(0);
});

test("a late membership response after logout cannot restore private data", async ({
  page,
}) => {
  let release!: () => void;
  const delayed = new Promise<void>((r) => {
    release = r;
  });
  await apiFixture(page, async (route, path) => {
    if (path === "/me/membership") {
      await delayed;
      await route
        .fulfill({
          json: { available_points: 98765, current_tier: { name: "私有等級" } },
        })
        .catch(() => {});
      return true;
    }
  });
  await login(page, "citizen", "member");
  await (await logoutButton(page)).click();
  release();
  await expect(
    page.getByRole("heading", { name: "請以市民身份登入" }),
  ).toBeVisible();
  await expect(page.getByText("可用點數 98765", { exact: true })).toHaveCount(
    0,
  );
});

test("admin login does not grant citizen or staff capabilities", async ({
  page,
}) => {
  await apiFixture(page);
  await login(page, "admin", "admin");
  await expectAccountName(page, "測試admin");
  await (await navLink(page, "清潔隊工作台")).click();
  await expect(
    page.getByRole("link", { name: "隊員登入", exact: true }),
  ).toBeVisible();
  await (await navLink(page, "會員中心")).click();
  await expect(
    page.getByRole("heading", { name: "請以市民身份登入" }),
  ).toBeVisible();
});
