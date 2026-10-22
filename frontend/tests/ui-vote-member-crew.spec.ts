import { test, expect, type Page } from "@playwright/test";
import { apiFixture, binId, location, status, envelope } from "./api-fixtures";
import { asPhone } from "./phone-report-fixture";

const proposedId = "10000000-0000-4000-8000-000000000002";
const proposed = {
  ...location,
  id: proposedId,
  label: "信義路建議設置點",
  bin_type: "proposed",
  placement_status: "proposed",
};
async function citizen(page: Page, next = "member") {
  await page.goto(`/#login?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "以市民登入", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await asPhone(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await apiFixture(
    page,
    async (route, path) => {
      if (path === "/map/locations") {
        await route.fulfill({ json: envelope([location, proposed]) });
        return true;
      }
      const match = path.match(/^\/bins\/([^/]+)\/view$/);
      if (match) {
        const bin =
          match[1] === proposedId ? proposed : { ...location, id: match[1] };
        await route.fulfill({
          json: {
            location: bin,
            status,
            compartments: location.compartments,
            can_report: true,
            can_apply_adoption: true,
            report_block_reason: null,
            adopter: null,
            my_adoption_id: null,
            latest_cleanup: null,
          },
        });
        return true;
      }
    },
    { demo: true },
  );
});

test("shorter sheet and focused V1 vote, LINE share and V2 history", async ({
  page,
}) => {
  await citizen(page, "map");
  await expect(page.locator(".location-row")).toHaveCount(1);
  const layout = await page.locator(".mx-layout").boundingBox(),
    sheet = await page.locator(".mx-panel").boundingBox();
  expect(sheet!.height / layout!.height).toBeLessThan(0.44);
  await page.goto("/#vote");
  await expect(page.locator(".mx-vote-intro")).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "建立提案", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".location-row")
    .filter({ hasText: proposed.label })
    .click();
  const ballot = page.getByRole("region", { name: "設置點投票" });
  await expect(
    ballot.getByRole("button", { name: "支持", exact: true }),
  ).toBeVisible();
  await expect(
    ballot.getByRole("button", { name: "不支持", exact: true }),
  ).toBeVisible();
  await expect(ballot.getByText(/私人|支持率|未送交|命名/)).toHaveCount(0);
  expect((await page.locator(".mx-panel").boundingBox())!.height).toBeLessThan(
    layout!.height * 0.6,
  );
  const supportBox = await ballot
    .getByRole("button", { name: "支持", exact: true })
    .boundingBox();
  const tabBox = await page.locator(".m-tabs").boundingBox();
  expect(supportBox!.y + supportBox!.height).toBeLessThanOrEqual(tabBox!.y);
  await page.screenshot({ path: "/tmp/binsoon-v1.png" });
  await ballot.getByRole("button", { name: "不支持", exact: true }).click();
  await expect(
    ballot.getByRole("button", { name: "不支持", exact: true }),
  ).toBeDisabled();
  await ballot.getByRole("button", { name: "支持", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "你投了支持票", exact: true }),
  ).toBeVisible();
  const share = new URL(
    (await page
      .getByRole("link", { name: "分享到 LINE" })
      .getAttribute("href"))!,
  );
  expect(share.hostname).toBe("social-plugins.line.me");
  expect(share.searchParams.get("url")).toContain(`#bin/${proposedId}`);
  await expect(page.locator(".vote-done-timeline li")).toHaveCount(4);
  await page.screenshot({ path: "/tmp/binsoon-v1-done.png" });
  await page.getByRole("link", { name: "看投票紀錄", exact: true }).click();
  await expect(page.locator(".vote-history-card")).toHaveCount(1);
  await expect(page.locator(".proposal-progress-track > span")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "更新提案" })).toHaveCount(0);
  await expect(page.locator(".api-footer, .api-pagination")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/binsoon-v2.png" });
  await page.evaluate(() => {
    const key = "binsoon-citizen-demo-v1",
      value = JSON.parse(localStorage.getItem(key)!);
    const voted = value.proposals.find((p: { my_vote: string }) => p.my_vote);
    value.proposals = Array.from({ length: 25 }, (_, i) => ({
      ...voted,
      id: `history-fixture-${i}`,
      bin_id: `history-bin-${i}`,
      name: `歷史投票 ${i + 1}`,
    }));
    localStorage.setItem(key, JSON.stringify(value));
  });
  await page.reload();
  await expect(page.locator(".vote-history-card")).toHaveCount(25);
});

test("U1-U4 are compact and all U2 offers use preserved ledger and stock", async ({
  page,
}) => {
  await citizen(page);
  await expect(
    page.getByRole("navigation", { name: "我的功能" }).getByRole("link"),
  ).toHaveCount(3);
  await expect(
    page.locator(".api-footer, .member-how, .api-pagination"),
  ).toHaveCount(0);
  await page.screenshot({ path: "/tmp/binsoon-u1.png" });
  await page.getByRole("link", { name: /^我的 BinU/ }).click();
  await expect(page.locator(".citizen-bin-name .mascot")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "通報清潔隊", exact: true }),
  ).toHaveCount(3);
  await page.goto("/#reports");
  await expect(page.locator(".citizen-report-row")).toHaveCount(4);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  const like = page.getByRole("button", {
    name: "幫清潔員阿安按讚",
    exact: true,
  });
  await expect(like).toHaveText("幫清潔員阿安按讚");
  await like.click();
  await expect(
    page.getByRole("button", { name: "已感謝清潔員阿安", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "/tmp/binsoon-u3.png" });
  await page.goto("/#rewards");
  await expect(page.locator(".reward-catalog-row")).toHaveCount(5);
  await expect(
    page.locator(".api-footer, .member-how, .reward-coming-soon"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "選擇 iPhone 18", exact: true }),
  ).toBeDisabled();
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("binsoon-citizen-demo-v1")!),
  );
  await page.screenshot({ path: "/tmp/binsoon-u2.png" });
  await page
    .getByRole("button", { name: "選擇 超商購物金", exact: true })
    .click();
  await page.getByRole("button", { name: "確認兌換", exact: true }).click();
  await expect(page.getByText("兌換成功", { exact: true })).toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("binsoon-citizen-demo-v1")!),
  );
  expect(after.redemptions.length).toBe(before.redemptions.length + 1);
  expect(after.redemptions.at(-1).cost).toBe(5);
  expect(after.entries.slice(0, before.entries.length)).toEqual(before.entries);
});

test("S2 complete only has next task, S3 has three fixture completions and right-side actions; S4 month fits", async ({
  page,
}) => {
  await page.goto("/#crew/login");
  await page.getByRole("button", { name: "以清潔員登入", exact: true }).click();
  await page.goto("/#crew/task/A-012");
  await expect(page.locator(".crew-progress")).toHaveCount(0);
  await page
    .getByRole("button", { name: "確認到場，開始處理", exact: true })
    .click();
  await page.getByRole("button", { name: "屬實", exact: true }).click();
  await page.getByRole("button", { name: "行人垃圾", exact: true }).click();
  await page.getByRole("button", { name: "拍完成照", exact: true }).click();
  await page.getByRole("button", { name: "完成清運", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "結案完成", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".crew-complete .button")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "下一張單", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/binsoon-s2-done.png" });
  // A fresh context's route has three fixed completed fixtures; this newly completed task remains visible as well.
  await page.goto("/#crew/route");
  await expect(page.locator(".crew-completed-bins > li")).toHaveCount(4);
  const row = page.locator(".crew-route-stop").first();
  const title = await row.locator("h3").boundingBox(),
    action = await row.locator(".crew-stop-actions").boundingBox();
  expect(action!.x).toBeGreaterThan(title!.x);
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/binsoon-s3.png" });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/#crew/ranking");
  const month = page.getByLabel("月份", { exact: true });
  await expect(month).toBeVisible();
  const input = await month.boundingBox();
  expect(input!.x + input!.width).toBeLessThanOrEqual(320);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/binsoon-s4.png" });
});
