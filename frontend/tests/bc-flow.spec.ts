import { test, expect, type Page } from "@playwright/test";
import { apiFixture, binId, location, status, envelope } from "./api-fixtures";
import { asPhone, captureReport } from "./phone-report-fixture";

async function setup(page: Page) {
  let writes = 0;
  await apiFixture(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") writes++;
      if (path === "/map/locations") {
        await route.fulfill({ json: envelope([location]) });
        return true;
      }
      const view = path.match(/^\/bins\/([^/]+)\/view$/);
      if (view) {
        await route.fulfill({
          json: {
            location: { ...location, id: view[1] },
            status,
            compartments: location.compartments,
            can_report: true,
            can_apply_adoption: true,
            my_adoption_id: null,
            adopter: null,
            latest_cleanup: null,
            report_block_reason: null,
          },
        });
        return true;
      }
    },
    { demo: true },
  );
  return () => writes;
}
async function citizen(page: Page, next = "member") {
  await page.goto(`/#login?next=${encodeURIComponent(next)}`);
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
}
async function crew(page: Page) {
  await page.goto("/#crew/login");
  await page
    .getByRole("button", { name: "以模擬清潔員登入", exact: true })
    .click();
}

test("B U1-U4 retain points, private bins and shared M4; coffee costs three points", async ({
  page,
}, info) => {
  await asPhone(page);
  const writes = await setup(page);
  await citizen(page);
  await expect(
    page.getByRole("heading", { name: "我的", exact: true }),
  ).toBeVisible();
  for (const name of ["我的 BinU", "回報紀錄", "投票紀錄"])
    await expect(
      page
        .getByRole("navigation", { name: "我的功能" })
        .getByRole("link", { name: new RegExp(name) }),
    ).toBeVisible();
  await page.getByRole("link", { name: /^我的 BinU/ }).click();
  await expect(
    page.getByRole("heading", { name: "我的 BinU", exact: true }),
  ).toBeVisible();
  const card = page.locator(".citizen-bin-card").first();
  await expect(card).toContainText("全家炸雞桶");
  await expect(
    card.getByRole("list", { name: "一般垃圾與資源回收" }),
  ).toBeVisible();
  const reportHref = await card
    .getByRole("link", { name: "這隻有狀況？回報桶況／問題", exact: true })
    .getAttribute("href");
  expect(reportHref).toMatch(/^#report\/.+\?waste_type=general$/);
  await card
    .getByRole("link", { name: "這隻有狀況？回報桶況／問題", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "回報桶況／問題", exact: true }),
  ).toBeVisible();
  await page.goto("/#adopt");
  await card
    .getByRole("checkbox", { name: "吃飽了（80% 以上）通知我", exact: true })
    .uncheck();
  await expect(
    card.getByRole("status").filter({ hasText: "通知偏好已儲存" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".citizen-bin-card").first().getByRole("checkbox"),
  ).not.toBeChecked();
  await page.screenshot({
    path: info.outputPath("u4-my-bins.png"),
    fullPage: true,
  });
  await page.goto("/#rewards");
  await expect(page.getByText("DEMO · 3 點", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "選擇 超商咖啡（試營運展示）", exact: true })
    .click();
  await page.getByRole("button", { name: "確認兌換", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "兌換成功", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "會員中心，目前 90 點", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("u2-coffee.png"),
    fullPage: true,
  });
  await page.goto("/#member");
  await expect(page.getByRole("region", { name: "我的點數" })).toContainText(
    "90",
  );
  await expect(page.getByRole("region", { name: "我的點數" })).toContainText(
    "累積 128 點",
  );
  await page.screenshot({
    path: info.outputPath("u1-mine.png"),
    fullPage: true,
  });
  expect(writes()).toBe(0);
});

test("B V1 public proposals share Bin IDs and votes appear with V2 progress", async ({
  page,
}, info) => {
  const writes = await setup(page);
  await citizen(page, "vote");
  await expect(
    page.getByRole("heading", { name: "要桶投票", exact: true }),
  ).toBeVisible();
  const row = page
    .locator(".location-row")
    .filter({ hasText: "公園入口 BinU提案" });
  await expect(row).toBeVisible();
  await row.click();
  await page.getByRole("button", { name: "支持設桶", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "你支持了這個點", exact: true }),
  ).toBeVisible();
  await page.goto("/#vote/votes");
  await expect(
    page.getByRole("heading", { name: "投票紀錄", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "設桶進度：公園入口 BinU提案" }),
  ).toContainText("第 2 / 4 步");
  await page.reload();
  await expect(
    page.locator('.proposal-flow-progress [aria-current="step"]'),
  ).toHaveText("2市民投票");
  await page.screenshot({
    path: info.outputPath("v2-votes.png"),
    fullPage: true,
  });
  expect(writes()).toBe(0);
});

test("M4 to S2 settlement and S3 completion connect U3 staff kudos to S4 exactly once", async ({
  page,
}, info) => {
  await asPhone(page);
  const writes = await setup(page);
  await citizen(page, `report/${binId}`);
  await captureReport(page);
  await expect(
    page.getByRole("status").filter({ hasText: "已幫你選好" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "問題類型", exact: true })
    .selectOption("full");
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(page).toHaveURL(/#report-done\//);
  const reportId = page.url().split("#report-done/")[1];
  await crew(page);
  await page
    .locator(".crew-task-card")
    .filter({
      has: page.getByRole("heading", { name: location.label, exact: true }),
    })
    .click();
  await page
    .getByRole("button", { name: "確認到場，開始處理（模擬）", exact: true })
    .click();
  await page.getByRole("button", { name: "屬實", exact: true }).click();
  await page.getByRole("button", { name: "行人垃圾", exact: true }).click();
  await page
    .getByRole("button", { name: "拍完成照（模擬）", exact: true })
    .click();
  await page.getByRole("button", { name: "完成清運", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "結案完成", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("s2-completed.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "主要分頁" })
    .getByRole("link", { name: "路線", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "今日清運路線", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "已完成清運桶數" }),
  ).toBeVisible();
  await expect(page.locator(".crew-completed-bins")).toContainText(
    location.label,
  );
  await page.screenshot({
    path: info.outputPath("s3-progress.png"),
    fullPage: true,
  });
  await page.goto("/#crew/ranking");
  const own = page.locator(".crew-ranking-list .current");
  const before = Number((await own.locator("p").innerText()).match(/\d+/)![0]);
  const rank = await own.locator(":scope > strong").first().innerText();
  await citizen(page, "reports");
  const report = page
    .locator(".citizen-report-row")
    .filter({ has: page.locator(`a[href="#review/${reportId}"]`) });
  await expect(report).toContainText("已入帳 +1 點");
  await report
    .getByRole("button", { name: "幫清潔員阿順按讚", exact: true })
    .click();
  await expect(
    report.getByRole("button", { name: "已感謝清潔員阿順", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    report.getByRole("button", { name: "已感謝清潔員阿順", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: info.outputPath("u3-kudos.png"),
    fullPage: true,
  });
  await page.goto("/#member");
  await expect(
    page
      .getByRole("region", { name: "我的點數" })
      .getByText("94", { exact: true }),
  ).toBeVisible();
  await page.goto("/#crew/ranking");
  await expect(own.locator("p")).toHaveText(`市民給的讚 ${before + 1}`);
  await expect(own.locator(":scope > strong").first()).toHaveText(rank);
  await page.screenshot({
    path: info.outputPath("s4-ranking.png"),
    fullPage: true,
  });
  await page.goto(`/#bin/${binId}?waste_type=general`);
  await expect(
    page.locator(".compartment").filter({ hasText: "一般垃圾" }),
  ).toContainText("0%");
  expect(writes()).toBe(0);
});

test("B and C pages fit 320px and desktop; no G1 or L1 paths are introduced", async ({
  page,
}, info) => {
  await setup(page);
  await citizen(page);
  await crew(page);
  for (const width of info.project.name === "desktop" ? [1440, 320] : [393]) {
    await page.setViewportSize({ width, height: 900 });
    for (const hash of [
      "member",
      "rewards",
      "reports",
      "adopt",
      "vote/votes",
      "crew",
      "crew/route",
      "crew/ranking",
    ]) {
      await page.goto(`/#${hash}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`bc-${hash.replaceAll("/", "-")}-${width}.png`),
        fullPage: true,
      });
    }
  }
});
