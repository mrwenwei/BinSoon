import { test, expect } from "@playwright/test";
import { apiFixture, envelope, login } from "./api-fixtures";

import { reward, redemption, membership } from "./api-engagement-fixture";

test("citizen redeems by reward UUID and reads server balance, stock and DEMO voucher", async ({
  page,
}) => {
  let redeemed = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/me/membership") {
      await route.fulfill({
        json: { ...membership, available_points: redeemed ? 50 : 80 },
      });
      return true;
    }
    if (path === "/rewards") {
      await route.fulfill({
        json: envelope([{ ...reward, stock: redeemed ? 1 : 2 }]),
      });
      return true;
    }
    if (path === "/redemptions") {
      expect(route.request().postDataJSON()).toEqual({ reward_id: reward.id });
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      redeemed = true;
      await route.fulfill({
        status: 201,
        json: {
          redemption,
          membership: { ...membership, available_points: 50 },
          reward: { ...reward, stock: 1 },
        },
      });
      return true;
    }
    if (path === "/me/redemptions") {
      await route.fulfill({ json: envelope(redeemed ? [redemption] : []) });
      return true;
    }
    if (path === `/redemptions/${redemption.id}`) {
      await route.fulfill({ json: redemption });
      return true;
    }
  });
  await login(page, "citizen", "rewards");
  await expect(
    page.getByRole("heading", { name: "兌換獎勵", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "選擇 伺服器展示券" }).click();
  await page.getByRole("button", { name: "確認兌換", exact: true }).dblclick();
  await expect(page.getByText("兌換成功", { exact: true })).toBeVisible();
  await expect(page.getByText("可用點數 50", { exact: true })).toBeVisible();
  await expect(page.getByText("庫存 1", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "查看本次展示券" }).click();
  await expect(
    page.getByText("DEMO-FIXTURE-ONLY", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("僅供 DEMO 展示，無真實核銷能力。", { exact: true }),
  ).toBeVisible();
});

test("unknown redemption keeps its key through re-login and never trusts local balance", async ({
  page,
}) => {
  const attempts: { key: string; body: string | null }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/me/membership") {
      await route.fulfill({ json: membership });
      return true;
    }
    if (path === "/rewards") {
      await route.fulfill({ json: envelope([reward]) });
      return true;
    }
    if (path === "/redemptions") {
      attempts.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postData(),
      });
      if (attempts.length === 1) await route.abort("failed");
      else if (attempts.length === 2)
        await route.fulfill({
          status: 401,
          json: { detail: { code: "SESSION_EXPIRED", message: "請重新登入" } },
        });
      else
        await route.fulfill({
          status: 201,
          headers: { "Idempotency-Replayed": "true" },
          json: {
            redemption,
            membership: { ...membership, available_points: 50 },
            reward: { ...reward, stock: 1 },
          },
        });
      return true;
    }
  });
  await login(page, "citizen", "rewards");
  await page.getByRole("button", { name: "選擇 伺服器展示券" }).click();
  await page.getByRole("button", { name: "確認兌換", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("連線未完成");
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "請以市民身份登入" }),
  ).toBeVisible();
  // Use the return link: no reload, preserving the original memory-only command.
  await page.getByRole("link", { name: "市民登入", exact: true }).click();
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(page.getByText("兌換成功", { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(3);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[2]).toEqual(attempts[0]);
});

test("insufficient points and sold-out responses refresh the catalogue without deduction", async ({
  page,
}) => {
  let rejected = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/me/membership") {
      await route.fulfill({
        json: { ...membership, available_points: rejected ? 0 : 80 },
      });
      return true;
    }
    if (path === "/rewards") {
      await route.fulfill({
        json: envelope([
          { ...reward, stock: rejected ? 0 : 2, available: !rejected },
        ]),
      });
      return true;
    }
    if (path === "/redemptions") {
      rejected = true;
      await route.fulfill({
        status: 409,
        json: { detail: { code: "OUT_OF_STOCK", message: "獎品已售罄" } },
      });
      return true;
    }
  });
  await login(page, "citizen", "rewards");
  await page.getByRole("button", { name: "選擇 伺服器展示券" }).click();
  await page.getByRole("button", { name: "確認兌換", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("獎品已售罄");
  await expect(
    page.getByRole("button", { name: "選擇 伺服器展示券" }),
  ).toBeDisabled();
  await expect(page.getByText("可用點數 0", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認目前版本並重試" }),
  ).toHaveCount(0);
});

test("catalogue categories, pagination, insufficient balance and own redemption deep links use API pages", async ({
  page,
}) => {
  const seen: string[] = [];
  let insufficient = false;
  await apiFixture(page, async (route, path) => {
    const params = new URL(route.request().url()).searchParams;
    if (path === "/me/membership") {
      await route.fulfill({
        json: { ...membership, available_points: insufficient ? 1 : 80 },
      });
      return true;
    }
    if (path === "/rewards") {
      seen.push(`${params.get("category")}/${params.get("offset")}`);
      await route.fulfill({
        json: {
          items: [
            {
              ...reward,
              name: Number(params.get("offset")) ? "後頁獎品" : reward.name,
            },
          ],
          page: { offset: Number(params.get("offset")), limit: 20, total: 21 },
        },
      });
      return true;
    }
    if (path === "/redemptions") {
      insufficient = true;
      await route.fulfill({
        status: 409,
        json: {
          detail: { code: "INSUFFICIENT_POINTS", message: "可用點數不足" },
        },
      });
      return true;
    }
    if (path === "/me/redemptions") {
      await route.fulfill({
        json: {
          items: [redemption],
          page: { limit: 20, offset: Number(params.get("offset")), total: 21 },
        },
      });
      return true;
    }
    if (path === `/redemptions/${redemption.id}`) {
      await route.fulfill({ json: redemption });
      return true;
    }
  });
  await login(page, "citizen", "rewards");
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await expect(page.getByRole("heading", { name: "後頁獎品" })).toBeVisible();
  await page.getByRole("combobox").selectOption("coupon");
  await expect(
    page.getByRole("heading", { name: reward.name, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: `選擇 ${reward.name}` }).click();
  await page.getByRole("button", { name: "確認兌換", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("可用點數不足");
  await expect(page.getByText("可用點數 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `選擇 ${reward.name}` }),
  ).toBeDisabled();
  expect(seen).toEqual(expect.arrayContaining(["all/0", "all/20", "coupon/0"]));
  await page.getByRole("link", { name: "我的兌換", exact: true }).click();
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await expect(
    page.getByText("共 21 筆 · 第 2 頁", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: `查看展示券 ${redemption.id}`, exact: true })
    .click();
  await expect(
    page.getByText(redemption.voucher_code, { exact: true }),
  ).toBeVisible();
});
