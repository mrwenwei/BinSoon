import { test, expect } from "@playwright/test";
import { apiFixture, envelope, login, binId, location } from "./api-fixtures";
import { proposal, proposalId, quota } from "./api-engagement-fixture";

test("citizen checks unfiltered availability and confirms a different nearby need with a new command", async ({
  page,
}, info) => {
  const commands: { key: string; body: Record<string, unknown> }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/me/proposal-quota") {
      await route.fulfill({ json: quota });
      return true;
    }
    if (path === "/map/availability") {
      const params = new URL(route.request().url()).searchParams;
      expect([...params.keys()].sort()).toEqual(["latitude", "longitude"]);
      expect(params.get("latitude")).toBe("25.033");
      await route.fulfill({
        json: {
          has_existing_bin_within_radius: true,
          radius_m: 300,
          nearest_installed_bin: { ...location, distance_m: 120 },
          bins: [{ ...location, distance_m: 120 }],
          proposals: [proposal],
        },
      });
      return true;
    }
    if (path === "/proposals" && route.request().method() === "POST") {
      commands.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      if (commands.length === 1)
        await route.fulfill({
          status: 409,
          json: {
            detail: {
              code: "NEARBY_PROPOSAL",
              message: "50 公尺內有提案，請確認不同需求",
              fields: [],
            },
          },
        });
      else
        await route.fulfill({
          status: 201,
          json: {
            proposal,
            quota: { ...quota, used: 1, remaining: 2 },
            warnings: [
              { code: "NEAR_EXISTING_BIN", distance_m: 120, bin_id: binId },
            ],
          },
        });
      return true;
    }
  });
  await login(page, "citizen", "vote/create");
  await page.getByLabel("提案名稱", { exact: true }).fill(proposal.name);
  await page.getByLabel("需求原因", { exact: true }).fill(proposal.reason);
  await page.getByLabel("緯度", { exact: true }).fill("25.033");
  await page.getByLabel("經度", { exact: true }).fill("121.5358");
  await page.getByRole("button", { name: "查詢周邊位置" }).click();
  await expect(
    page.getByText("API 未知桶", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("proposal-availability.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "送出提案", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("50 公尺");
  await page.getByRole("button", { name: "確認是不同需求並建立提案" }).click();
  await expect(page.getByRole("heading", { name: "提案已建立" })).toBeVisible();
  await expect(
    page.getByText("附近 120 公尺已有設置桶，仍須現勘。", { exact: true }),
  ).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[0].body).toEqual({
    name: proposal.name,
    reason: proposal.reason,
    latitude: 25.033,
    longitude: 121.5358,
    confirmed_nearby: false,
  });
  expect(commands[1].body).toEqual({
    ...commands[0].body,
    confirmed_nearby: true,
  });
  expect(commands[1].key).not.toBe(commands[0].key);
  await expect(
    page.getByRole("link", { name: "查看提案與投票" }),
  ).toHaveAttribute("href", `#proposals/${proposalId}`);
  await expect(
    page.getByRole("link", { name: "查看待現勘點位" }),
  ).toHaveAttribute("href", `#bin/${binId}`);
});

test("votes support, change, withdraw and use server closure at 60 without a local threshold", async ({
  page,
}) => {
  let current = {
    ...proposal,
    mine: false,
    support: 59,
    oppose: 0,
    total_votes: 59,
    support_ratio: 1,
    my_vote: null as string | null,
  };
  const votes: unknown[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({ json: current });
      return true;
    }
    if (path === `/proposals/${proposalId}/vote`) {
      const vote = route.request().postDataJSON().vote;
      votes.push(vote);
      if (votes.length === 4) {
        current = {
          ...current,
          support: 60,
          total_votes: 60,
          my_vote: "support",
          status: "evaluation",
          voting_closed_at: "2026-10-20T02:00:00Z",
        };
        await route.fulfill({
          status: 409,
          json: { detail: { code: "VOTING_CLOSED", message: "投票已關閉" } },
        });
      } else {
        current = {
          ...current,
          my_vote: vote,
          support: vote === "support" ? 60 : 59,
          oppose: vote === "oppose" ? 1 : 0,
          total_votes: vote ? 60 : 59,
          support_ratio: vote === "oppose" ? 59 / 60 : 1,
        };
        // A 60 fixture intentionally remains collecting: the frontend must follow server state.
        await route.fulfill({ json: current });
      }
      return true;
    }
  });
  await login(page, "citizen", `proposals/${proposalId}`);
  await page.getByRole("button", { name: "支持", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "你支持了這個點" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#vote-done\//);
  await page.getByRole("link", { name: "返回提案", exact: true }).click();
  await expect(page.getByText("我的票：支持", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "反對", exact: true }).click();
  await expect(page.getByText("我的票：反對", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "撤票", exact: true }).click();
  await expect(
    page.getByText("我的票：尚未投票", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "支持", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("投票已關閉");
  await expect(
    page.getByText("評估中 · DEMO · 大安區", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "支持", exact: true }),
  ).toHaveCount(0);
  expect(votes).toEqual(["support", "oppose", null, "support"]);
  await page.reload();
  await expect(
    page.getByText("評估中 · DEMO · 大安區", { exact: true }),
  ).toBeVisible();
});

for (const code of ["OUTSIDE_SUPPORTED_BOUNDARY", "MONTHLY_QUOTA_EXCEEDED"]) {
  test(`proposal ${code} preserves original coordinates and reason`, async ({
    page,
  }) => {
    await apiFixture(page, async (route, path) => {
      if (path === "/me/proposal-quota") {
        await route.fulfill({ json: quota });
        return true;
      }
      if (path === "/map/availability") {
        await route.fulfill({
          json: {
            has_existing_bin_within_radius: false,
            radius_m: 300,
            bins: [],
            proposals: [],
            nearest_installed_bin: null,
          },
        });
        return true;
      }
      if (path === "/proposals" && route.request().method() === "POST") {
        await route.fulfill({
          status: code.startsWith("OUTSIDE") ? 422 : 409,
          json: { detail: { code, message: code } },
        });
        return true;
      }
    });
    await login(page, "citizen", "vote/create");
    await page.getByLabel("提案名稱", { exact: true }).fill("保留輸入");
    await page.getByLabel("需求原因", { exact: true }).fill("不修改我的座標");
    await page.getByLabel("緯度", { exact: true }).fill("25.09");
    await page.getByLabel("經度", { exact: true }).fill("121.6");
    await page.getByRole("button", { name: "查詢周邊位置" }).click();
    await page.getByRole("button", { name: "送出提案", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(code);
    await expect(page.getByLabel("緯度", { exact: true })).toHaveValue("25.09");
    await expect(page.getByLabel("經度", { exact: true })).toHaveValue("121.6");
    await expect(page.getByLabel("需求原因", { exact: true })).toHaveValue(
      "不修改我的座標",
    );
    await expect(
      page.getByRole("button", { name: "確認目前版本並重試" }),
    ).toHaveCount(0);
  });
}

test("proposal unknown success retries original key after expiry and retains draft", async ({
  page,
}) => {
  const attempts: { key: string; body: string | null }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/me/proposal-quota") {
      await route.fulfill({ json: quota });
      return true;
    }
    if (path === "/map/availability") {
      await route.fulfill({
        json: {
          has_existing_bin_within_radius: false,
          radius_m: 300,
          bins: [],
          proposals: [],
          nearest_installed_bin: null,
        },
      });
      return true;
    }
    if (path === "/proposals" && route.request().method() === "POST") {
      attempts.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postData(),
      });
      if (attempts.length === 1)
        await route.fulfill({
          status: 401,
          json: { detail: { code: "SESSION_EXPIRED", message: "請重新登入" } },
        });
      else
        await route.fulfill({
          status: 201,
          json: { proposal, quota, warnings: [] },
        });
      return true;
    }
  });
  await login(page, "citizen", "vote/create");
  await page.getByLabel("提案名稱", { exact: true }).fill(proposal.name);
  await page.getByLabel("需求原因", { exact: true }).fill(proposal.reason);
  await page.getByLabel("緯度", { exact: true }).fill("25.033");
  await page.getByLabel("經度", { exact: true }).fill("121.5358");
  await page.getByRole("button", { name: "查詢周邊位置" }).click();
  await page.getByRole("button", { name: "送出提案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "請以市民身份登入" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "市民登入", exact: true }).click();
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.getByLabel("提案名稱", { exact: true })).toHaveValue(
    proposal.name,
  );
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(page.getByRole("heading", { name: "提案已建立" })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
});

test("public, own proposals and votes paginate; detail deep link keeps a null ratio", async ({
  page,
}) => {
  const paths: string[] = [];
  await apiFixture(page, async (route, path) => {
    if (["/proposals", "/me/proposals", "/me/votes"].includes(path)) {
      paths.push(path);
      const offset = Number(
        new URL(route.request().url()).searchParams.get("offset"),
      );
      const item = {
        ...proposal,
        name: offset ? "第二頁提案" : "第一頁提案",
        support: 0,
        oppose: 0,
        total_votes: 0,
        support_ratio: null,
      };
      await route.fulfill({
        json: { items: [item], page: { offset, limit: 20, total: 21 } },
      });
      return true;
    }
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({
        json: {
          ...proposal,
          support: 0,
          oppose: 0,
          total_votes: 0,
          support_ratio: null,
        },
      });
      return true;
    }
  });
  await page.goto("/#vote/all");
  await expect(page.getByRole("heading", { name: "第一頁提案" })).toBeVisible();
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await expect(page.getByRole("heading", { name: "第二頁提案" })).toBeVisible();
  await login(page, "citizen", "vote/mine");
  await expect(
    page.getByRole("heading", { name: "我的提案", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await expect(page.getByRole("heading", { name: "第二頁提案" })).toBeVisible();
  await page.getByRole("link", { name: "我的投票", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "投票紀錄", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await page.getByRole("link", { name: "查看提案與投票", exact: true }).click();
  await expect(page.getByText("支持率 無資料", { exact: true })).toBeVisible();
  expect(paths).toEqual(
    expect.arrayContaining(["/proposals", "/me/proposals", "/me/votes"]),
  );
});

test("map can select an initial point and recover from a nearby-proposal rejection", async ({
  page,
}) => {
  let attempts = 0;
  await apiFixture(page, async (route, path) => {
    if (path === "/me/proposal-quota") {
      await route.fulfill({ json: quota });
      return true;
    }
    if (path === "/map/availability") {
      await route.fulfill({
        json: {
          has_existing_bin_within_radius: false,
          radius_m: 300,
          bins: [],
          proposals: [],
          nearest_installed_bin: null,
        },
      });
      return true;
    }
    if (path === "/proposals" && route.request().method() === "POST") {
      expect(route.request().postDataJSON().confirmed_nearby).toBe(false);
      if (++attempts === 1)
        await route.fulfill({
          status: 409,
          json: {
            detail: { code: "NEARBY_PROPOSAL", message: "附近有其他提案" },
          },
        });
      else
        await route.fulfill({
          status: 201,
          json: { proposal, quota, warnings: [] },
        });
      return true;
    }
  });
  await login(page, "citizen", "vote/create");
  await page.getByLabel("提案名稱", { exact: true }).fill("重新選點");
  await page.getByLabel("需求原因", { exact: true }).fill("另一位置的需求");
  const map = page.getByRole("region", { name: "台北位置地圖", exact: true });
  await expect(map).toBeVisible();
  await map.click({ position: { x: 100, y: 100 } });
  await page.getByRole("button", { name: "查詢周邊位置" }).click();
  await page.getByRole("button", { name: "送出提案", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("附近有其他提案");
  await map.click({ position: { x: 150, y: 140 } });
  await page.getByRole("button", { name: "查詢周邊位置" }).click();
  await page.getByRole("button", { name: "送出提案", exact: true }).click();
  await expect(page.getByRole("heading", { name: "提案已建立" })).toBeVisible();
  expect(attempts).toBe(2);
});
