import { test, expect } from "@playwright/test";
import {
  apiFixture,
  login,
  envelope,
  reportId,
  workId,
  report,
  logoutButton,
} from "./api-fixtures";
import { adoptionId } from "./api-adoption-fixture";

const notificationId = "90000000-0000-4000-8000-000000000001";
const notification = {
  id: notificationId,
  type: "report_reviewed",
  title: "回報已查證",
  message: "請查看案件結果",
  created_at: "2026-10-20T01:00:00Z",
  read_at: null,
  waste_type: "general",
  target: { kind: "report", id: reportId },
};

test("inbox reads server pages and unread filter; unknown read retries original key and target uses report UUID", async ({
  page,
}) => {
  const commands: { key: string; body: unknown }[] = [];
  let read = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/me/notifications") {
      const url = new URL(route.request().url());
      const offset = Number(url.searchParams.get("offset"));
      const unread = url.searchParams.get("unread_only") === "true";
      await route.fulfill({
        json: {
          items:
            unread && read
              ? []
              : [
                  {
                    ...notification,
                    read_at: read ? "2026-10-20T02:00:00Z" : null,
                  },
                ],
          page: { limit: 20, offset, total: unread && read ? 0 : 21 },
        },
      });
      return true;
    }
    if (path === `/me/notifications/${notificationId}/read`) {
      commands.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      read = true;
      if (commands.length === 1) await route.abort();
      else
        await route.fulfill({
          json: { ...notification, read_at: "2026-10-20T02:00:00Z" },
        });
      return true;
    }
    if (path === `/reports/${reportId}`) {
      await route.fulfill({ json: report });
      return true;
    }
  });
  await login(page, "citizen", "notifications");
  await expect(
    page.getByRole("heading", { name: "站內通知", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await expect(page.getByText("共 21 筆 · 第 2 頁")).toBeVisible();
  await page.getByLabel("只看未讀").check();
  await expect(page.getByText("共 21 筆 · 第 1 頁")).toBeVisible();
  await page.getByRole("button", { name: "標為已讀", exact: true }).click();
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  expect(commands).toHaveLength(2);
  expect(commands[1]).toEqual(commands[0]);
  expect(commands[0].body).toEqual({});
  await expect(page.getByText("目前沒有通知", { exact: true })).toBeVisible();
  await page.getByLabel("只看未讀").uncheck();
  await page.getByRole("link", { name: "查看案件", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`#review/${reportId}\\?waste_type=general$`),
  );
});

test("read command survives expiry and reauthentication with original read_at, key and body", async ({
  page,
}) => {
  const calls: unknown[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/me/notifications") {
      await route.fulfill({ json: envelope([notification]) });
      return true;
    }
    if (path.endsWith("/read")) {
      calls.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      await route.fulfill(
        calls.length === 1
          ? {
              status: 401,
              json: {
                detail: {
                  code: "SESSION_EXPIRED",
                  message: "登入已失效",
                  fields: [],
                },
              },
            }
          : { json: { ...notification, read_at: "2026-10-20T02:00:00Z" } },
      );
      return true;
    }
  });
  await login(page, "citizen", "notifications");
  await page.getByRole("button", { name: "標為已讀", exact: true }).click();
  await page
    .getByRole("main")
    .getByRole("link", { name: "登入", exact: true })
    .click();
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(page.getByText(/已讀時間：/)).toBeVisible();
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
});

test("inbox polls only in foreground and cancels on leave; late previous identity cannot refill", async ({
  page,
}) => {
  await page.clock.install();
  let reads = 0,
    holding = false;
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await apiFixture(page, async (route, path) => {
    if (path === "/me/notifications") {
      reads++;
      const oldIdentity = holding;
      if (oldIdentity) await held;
      await route
        .fulfill({
          json: envelope([
            {
              ...notification,
              title: oldIdentity ? "舊身份通知" : "目前身份通知",
            },
          ]),
        })
        .catch(() => {});
      return true;
    }
  });
  await login(page, "citizen", "notifications");
  await expect(page.getByText("目前身份通知", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = reads;
  await page.clock.fastForward(30000);
  expect(reads).toBe(before);
  holding = true;
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads).toBeGreaterThan(before);
  holding = false;
  await (await logoutButton(page)).click();
  await login(page, "staff", "staff/notifications");
  await expect(page.getByText("目前身份通知", { exact: true })).toBeVisible();
  release!();
  await expect(page.getByText("舊身份通知", { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    location.hash = "staff/tasks";
  });
  await expect(
    page.getByRole("heading", { name: "清潔隊工作台", exact: true }),
  ).toBeVisible();
  const after = reads;
  await page.clock.fastForward(30000);
  expect(reads).toBe(after);
});

test("generic admin inbox keeps adoption target on admin route and unavailable report does not guess another ID", async ({
  page,
}) => {
  await apiFixture(page, async (route, path) => {
    if (path === "/me/notifications") {
      await route.fulfill({
        json: envelope([
          { ...notification, target: { kind: "adoption", id: adoptionId } },
        ]),
      });
      return true;
    }
  });
  await login(page, "admin", "notifications");
  await expect(
    page.getByRole("link", { name: "查看案件", exact: true }),
  ).toHaveAttribute("href", `#admin/adoptions/${adoptionId}`);
  await login(page, "citizen", `review/${reportId}`);
  await expect(page.getByRole("alert")).toContainText("找不到資料");
  await expect(page.getByText("已入帳點數 0", { exact: true })).toHaveCount(0);
});

test("typed notification targets keep IDs and staff destination requires staff login", async ({
  page,
}) => {
  await apiFixture(page, async (route, path) => {
    if (path === "/me/notifications") {
      await route.fulfill({
        json: envelope([
          { ...notification, target: { kind: "work_order", id: workId } },
          {
            ...notification,
            id: "n2",
            target: { kind: "proposal", id: "proposal-target" },
          },
          {
            ...notification,
            id: "n3",
            target: { kind: "adoption", id: adoptionId },
          },
        ]),
      });
      return true;
    }
  });
  await login(page, "citizen", "notifications");
  await expect(
    page.getByRole("link", { name: "查看案件" }).nth(1),
  ).toHaveAttribute("href", "#proposals/proposal-target");
  await expect(
    page.getByRole("link", { name: "查看案件" }).nth(2),
  ).toHaveAttribute("href", `#adopt/${adoptionId}`);
  await page.getByRole("link", { name: "查看案件" }).first().click();
  await expect(page).toHaveURL(new RegExp(`#staff/tasks/${workId}`));
  await expect(
    page.getByText("請以責任區隊員身份登入。", { exact: true }),
  ).toBeVisible();
});
