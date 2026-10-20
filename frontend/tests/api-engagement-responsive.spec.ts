import { test, expect } from "@playwright/test";
import { apiFixture, envelope, login } from "./api-fixtures";
import {
  reward,
  redemption,
  proposal,
  proposalId,
  quota,
} from "./api-engagement-fixture";

test("rewards, voucher, proposal and outcomes support narrow layouts and keyboard access", async ({
  page,
}, info) => {
  await apiFixture(page, async (route, path) => {
    let data: unknown;
    if (path === "/rewards") data = envelope([reward]);
    else if (path === "/me/redemptions") data = envelope([redemption]);
    else if (path === `/redemptions/${redemption.id}`) data = redemption;
    else if (path === "/me/proposal-quota") data = quota;
    else if (path === "/proposals") data = envelope([proposal]);
    else if (path === `/proposals/${proposalId}`) data = proposal;
    else if (path === "/public/outcomes")
      data = {
        month: "2026-10",
        timezone: "Asia/Taipei",
        district: "大安區",
        completed_count: 0,
        like_count: 0,
      };
    else return;
    await route.fulfill({ json: data });
    return true;
  });
  await login(page, "citizen", "rewards");
  for (const width of info.project.name === "desktop" ? [1440, 320] : [393]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, hash] of [
      ["rewards", "rewards"],
      ["voucher", `redemptions/${redemption.id}`],
      ["proposals", "vote"],
      ["proposal-detail", `proposals/${proposalId}`],
      ["proposal-create", "vote/create"],
      ["outcomes", "outcomes"],
    ]) {
      await page.evaluate((hash) => {
        window.location.hash = hash;
      }, hash);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: "載入中" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.evaluate(() => {
    location.hash = "vote/create";
  });
  const name = page.getByLabel("提案名稱", { exact: true });
  await name.focus();
  await page.keyboard.type("鍵盤提案");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("需求原因", { exact: true })).toBeFocused();
  await page.keyboard.type("可使用鍵盤操作");
  await expect(name).toHaveValue("鍵盤提案");
});

test("API failure and private access denial stay explicit without fixture fallback", async ({
  page,
}) => {
  await apiFixture(page, async (route, path) => {
    if (
      path === "/public/outcomes" ||
      path === "/proposals" ||
      path === "/rewards"
    ) {
      await route.fulfill({
        status: 503,
        json: { detail: { code: "UNAVAILABLE", message: "服務暫時無法使用" } },
      });
      return true;
    }
    if (path === "/staff/statistics") {
      await route.fulfill({
        status: 403,
        json: { detail: { code: "FORBIDDEN", message: "無權查看此責任區" } },
      });
      return true;
    }
    if (path === `/redemptions/${redemption.id}`) {
      await route.fulfill({
        status: 404,
        json: { detail: { code: "NOT_FOUND", message: "找不到自己的兌換" } },
      });
      return true;
    }
  });
  await page.goto("/#outcomes");
  await expect(page.getByRole("alert")).toContainText("服務暫時無法使用");
  await expect(page.getByText("完成件數 0", { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    location.hash = "vote";
  });
  await expect(page.getByRole("alert")).toContainText("服務暫時無法使用");
  await expect(page.getByRole("heading", { name: proposal.name })).toHaveCount(
    0,
  );
  await login(page, "citizen", "rewards");
  await expect(page.getByRole("alert")).toContainText("服務暫時無法使用");
  await page.evaluate((hash) => {
    location.hash = hash;
  }, `redemptions/${redemption.id}`);
  await expect(page.getByRole("alert")).toContainText("找不到自己的兌換");
  await expect(
    page.getByText(redemption.voucher_code, { exact: true }),
  ).toHaveCount(0);
  await login(page, "staff", "staff/statistics");
  await expect(page.getByRole("alert")).toContainText("無權查看此責任區");
  await expect(page.getByRole("list", { name: "隊員排名" })).toHaveCount(0);
});
