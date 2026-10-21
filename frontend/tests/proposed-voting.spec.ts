import { test, expect } from "@playwright/test";
import { apiFixture, binId, location, status, envelope } from "./api-fixtures";

const suggested = {
  ...location,
  label: "信義路建議設置點",
  bin_type: "proposed",
  placement_status: "proposed",
};

test("suggested Bin opens a shared local ballot with persistent change and withdrawal", async ({
  page,
}, testInfo) => {
  let writes = 0;
  await apiFixture(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") writes++;
      if (path === "/map/locations") {
        await route.fulfill({ json: envelope([suggested]) });
        return true;
      }
      if (path === `/bins/${binId}/view`) {
        await route.fulfill({
          json: {
            location: suggested,
            status,
            compartments: suggested.compartments,
            can_report: false,
            can_apply_adoption: false,
            adopter: null,
            latest_cleanup: null,
          },
        });
        return true;
      }
    },
    { demo: true },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "建議點", exact: true }).click();
  await page.locator(".location-row").click();
  const ballot = page.getByRole("region", { name: "設置點投票" });
  await expect(
    ballot.getByRole("heading", { name: suggested.label }),
  ).toBeVisible();
  await expect(
    ballot.getByRole("heading", { name: suggested.label }),
  ).toBeFocused();
  await expect(page.getByRole("region", { name: "各類桶槽" })).toHaveCount(0);
  await expect(page.getByText("尚無可驗證清運完成紀錄")).toHaveCount(0);
  await ballot.getByRole("link", { name: "查看提案進度" }).click();
  await page.reload();
  await expect(
    page.getByText("支持 0 · 反對 0 · 投票人數 0", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "查看待現勘或示範設置點位" }).click();
  await ballot.getByRole("link", { name: "登入參與投票" }).click();
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#bin/${binId}`));
  await ballot.getByRole("button", { name: "支持設桶", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "你支持了這個點" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "投票結果" })).toContainText(
    "1 / 60",
  );
  await expect(page.locator(".vote-done-cta a")).toHaveCount(1);
  await expect(page.locator(".vote-done-cta a")).toHaveText("回到地圖");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "你支持了這個點" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "投票結果" })).toContainText(
    "支持 1 · 反對 0",
  );
  await page.getByRole("link", { name: "返回設置點", exact: true }).click();
  await expect(ballot.getByRole("button", { name: "支持設桶" })).toBeDisabled();
  await ballot.getByRole("button", { name: "不要設這裡" }).click();
  await expect(
    ballot.getByText("支持 0 · 反對 1", { exact: true }),
  ).toBeVisible();
  await ballot.getByRole("button", { name: "撤回投票" }).click();
  await expect(
    ballot.getByText("支持 0 · 反對 0", { exact: true }),
  ).toBeVisible();
  await ballot.getByRole("button", { name: "支持設桶" }).click();
  await expect(
    page.getByRole("heading", { name: "你支持了這個點" }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/binsoon-vote-done-${testInfo.project.name}.png`,
    fullPage: true,
  });
  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 640 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.locator(".vote-done-cta a").click();
    await expect(page).toHaveURL(/#map/);
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto(`/#bin/${binId}`);
  } else {
    await page.getByRole("link", { name: "返回設置點", exact: true }).click();
  }
  await expect(
    ballot.getByText("支持 1 · 反對 0", { exact: true }),
  ).toBeVisible();
  await page.locator(".mx-panel-body").evaluate((el) => {
    el.scrollTop = 0;
  });
  if (testInfo.project.name === "mobile") {
    await expect
      .poll(async () =>
        page
          .locator(".mx-panel")
          .evaluate((el) => el.clientHeight / el.parentElement!.clientHeight),
      )
      .toBeGreaterThan(0.7);
  }
  await page.screenshot({
    path: `/tmp/binsoon-ballot-${testInfo.project.name}.png`,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  await ballot.getByRole("link", { name: "查看提案進度" }).click();
  await expect(
    page.getByText("支持 1 · 反對 0 · 投票人數 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "反對", exact: true }).click();
  await page.getByRole("link", { name: "查看待現勘或示範設置點位" }).click();
  await expect(
    ballot.getByText("支持 0 · 反對 1", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
});

test("server ballot matches Bin ID across pages and respects closed voting", async ({
  page,
}) => {
  const { proposal } = await import("./api-engagement-fixture");
  const offsets: number[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/map/locations") {
      await route.fulfill({ json: envelope([suggested]) });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location: suggested,
          status,
          compartments: suggested.compartments,
          can_report: false,
          can_apply_adoption: false,
          adopter: null,
          latest_cleanup: null,
        },
      });
      return true;
    }
    if (path === "/proposals") {
      const offset = Number(
        new URL(route.request().url()).searchParams.get("offset"),
      );
      offsets.push(offset);
      await route.fulfill({
        json: envelope(
          [{ ...proposal, bin_id: offset ? binId : "different-bin" }],
          offset,
          2,
        ),
      });
      return true;
    }
    if (path === `/proposals/${proposal.id}`) {
      await route.fulfill({
        json: {
          ...proposal,
          bin_id: binId,
          status: "evaluation",
          voting_closed_at: "2026-10-21T00:00:00Z",
        },
      });
      return true;
    }
  });
  await page.goto(`/#bin/${binId}`);
  const ballot = page.getByRole("region", { name: "設置點投票" });
  await expect(
    ballot.getByText("投票已關閉 · 評估中", { exact: true }),
  ).toBeVisible();
  await expect(ballot.getByRole("button", { name: "支持設桶" })).toHaveCount(0);
  expect(new Set(offsets)).toEqual(new Set([0, 1]));
});

test("support failure stays on the ballot and only a confirmed retry opens P12", async ({
  page,
}) => {
  const { login } = await import("./api-fixtures");
  const { proposal, proposalId } = await import("./api-engagement-fixture");
  let current = {
    ...proposal,
    my_vote: null as string | null,
    support: 0,
    total_votes: 0,
    support_ratio: null as number | null,
  };
  const keys: string[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({ json: current });
      return true;
    }
    if (path === `/proposals/${proposalId}/vote`) {
      keys.push(route.request().headers()["idempotency-key"]);
      if (keys.length === 1) {
        await route.fulfill({
          status: 500,
          json: {
            detail: { code: "UNAVAILABLE", message: "暫時無法確認投票" },
          },
        });
      } else {
        current = {
          ...current,
          my_vote: "support",
          support: 1,
          total_votes: 1,
          support_ratio: 1,
        };
        await route.fulfill({ json: current });
      }
      return true;
    }
  });
  await login(page, "citizen", `proposals/${proposalId}`);
  await page.getByRole("button", { name: "支持", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("暫時無法確認投票");
  await expect(page).toHaveURL(new RegExp(`#proposals/${proposalId}`));
  await expect(
    page.getByRole("heading", { name: "你支持了這個點" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "你支持了這個點" }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
