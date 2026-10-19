import { reviewAsStaff } from "./staff-helpers";
import { test, expect } from "@playwright/test";

test("P8 separates cumulative and available points and replaces the old stamp album", async ({
  page,
}) => {
  await page.goto("/#member");
  await expect(
    page.getByRole("heading", { name: "會員中心", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("累積點數 63", { exact: true })).toBeVisible();
  await expect(page.getByText("可用點數 63", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "獨當一面", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("再 87 點升到「高手」")).toBeVisible();
  for (const tier of ["見習生", "新手", "獨當一面", "高手", "專家", "教授"]) {
    await expect(
      page.getByRole("list", { name: "會員等級徽章" }),
    ).toContainText(tier);
  }
  await expect(page.getByText("大安區印章", { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "小車", exact: true }),
  ).toHaveCount(0);
});

test("P5 to P7 credits an approved report once and keeps its result after reload", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await page.locator(".location-row").first().click();
  await page.getByRole("link", { name: "回報問題", exact: true }).click();
  if (!isMobile)
    await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
  await page.getByRole("button", { name: "桶旁有堆放", exact: false }).click();
  await page
    .getByRole("button", { name: /拍一張示意照片|重拍示意照片/ })
    .click();
  await page.getByLabel("示意定位情境").selectOption("near");
  await page.getByRole("link", { name: "登入後繼續回報" }).click();
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await expect(
    page.getByRole("heading", { name: "謝謝你幫城市變乾淨！" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "看審核結果", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "回報審核結果" }),
  ).toBeVisible();
  await expect(page.getByText("可用點數 63", { exact: true })).toBeVisible();
  await reviewAsStaff(page, "processing");
  await expect(page.getByText("清潔員已接單，正前往現場。")).toBeVisible();
  await reviewAsStaff(page, "approved");
  await expect(page.getByText("審核通過 +1 點", { exact: true })).toBeVisible();
  await expect(page.getByLabel("示範案件狀態")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("可用點數 64", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "前往會員中心", exact: true }).click();
  await expect(page.getByText("累積點數 64", { exact: true })).toBeVisible();
  await expect(page.getByText("可用點數 64", { exact: true })).toBeVisible();
});

test("P9 redemption spends available points, preserves level and stores its receipt", async ({
  page,
}) => {
  await page.goto("/#login?next=rewards");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(
    page.getByRole("heading", { name: "兌換獎品", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "大獎", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "還差 937 點" }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "超商兌換券", exact: true }).click();
  const seven = page.getByRole("article", { name: "7-11 50 元兌換券" });
  await seven.getByRole("button", { name: "兌換", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("兌換後剩餘 33 點");
  await page.getByRole("button", { name: "再想一下" }).click();
  await expect(page.getByText("可用點數 63", { exact: true })).toBeVisible();
  await seven.getByRole("button", { name: "兌換", exact: true }).click();
  await page.getByRole("button", { name: "確認兌換 30 點" }).click();
  await expect(
    page.getByRole("heading", { name: "兌換成功", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("可用點數 33", { exact: true })).toBeVisible();
  await expect(seven).toContainText("本月剩 379 張");
  await expect(page.getByText(/DEMO-SEVEN-/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("可用點數 33", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回會員中心", exact: true }).click();
  await expect(page.getByText("累積點數 63", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "獨當一面", exact: true }),
  ).toBeVisible();
});

test("P4 reroutes a full destination and reports the replacement bin", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("list", { name: "最近三個可用桶" }).getByRole("link"),
  ).toHaveCount(3);
  await page.locator(".location-row").first().click();
  await page.getByRole("link", { name: "導航過去", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "步行導航", exact: true }),
  ).toBeVisible();
  const original = await page.locator(".navigation-destination").innerText();
  await page.getByRole("button", { name: "模擬目的桶吃飽" }).click();
  await expect(
    page.getByText("目的桶吃飽了，已改導另一個可用桶。", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".navigation-destination")).not.toHaveText(
    original,
  );
  const transferUrl = await page
    .locator(".navigation-qr .qr-link")
    .getAttribute("href");
  expect(transferUrl).toContain("?from=");
  await page.goto(transferUrl!);
  const transferredDestination = await page
    .locator(".navigation-destination")
    .innerText();
  await page.getByRole("link", { name: "登入", exact: true }).click();
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(page).toHaveURL(transferUrl!);
  await expect(page.locator(".navigation-destination")).toHaveText(
    transferredDestination,
  );
  const reportHref = await page
    .getByRole("link", { name: "抵達後回報", exact: true })
    .getAttribute("href");
  await page.getByRole("link", { name: "抵達後回報", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(reportHref!.slice(1)));
});

test("adopters earn two points, later reporters earn none, and three false reports suspend submissions", async ({
  page,
  isMobile,
}) => {
  await page.goto("/#login");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.goto("/#adopt");
  await page.getByLabel("認養者公開名稱").fill("A/B 接合示範認養者");
  await page.getByRole("button", { name: "送出認養申請", exact: true }).click();
  const adoption = page.getByRole("article", { name: /認養申請：/ }).first();
  await adoption.getByText("展示控制：認養審批", { exact: true }).click();
  await adoption.getByRole("button", { name: "核准認養", exact: true }).click();
  await adoption.getByRole("link", { name: "查看這個桶", exact: true }).click();
  const binUrl = page.url();
  async function submit(
    type: string,
    adopter: boolean,
    first: boolean,
    result: string,
  ) {
    await page.goto(binUrl);
    await page.getByRole("link", { name: "回報問題", exact: true }).click();
    if (!isMobile)
      await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
    await page.getByRole("button", { name: type, exact: false }).click();
    if (type === "其他")
      await page.getByLabel("補充說明（必填）").fill("這是示意回報說明。");
    await page
      .getByRole("button", { name: /拍一張示意照片|重拍示意照片/ })
      .click();
    await page.getByLabel("示意定位情境").selectOption("near");
    await expect(
      page.getByText(
        adopter
          ? "這個桶的核准認養者 · 屬實首報 +2 點"
          : "一般民眾 · 屬實首報 +1 點",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "送出示範回報" }).click();
    await expect(page).toHaveURL(/#report-done\//);
    const doneUrl = page.url();
    await page
      .getByRole("link", { name: "看審核結果", exact: true })
      .first()
      .click();
    await reviewAsStaff(page, result);
    if (result === "rejected") {
      const reviewUrl = page.url();
      await page.goto(doneUrl);
      await expect(page.locator(".done-points")).toHaveText("+0");
      await page.goto(reviewUrl);
    }
  }
  await submit("桶旁有堆放", true, true, "approved");
  await expect(page.getByText("審核通過 +2 點", { exact: true })).toBeVisible();
  await expect(page.getByText("可用點數 65", { exact: true })).toBeVisible();
  await page.goto("/#adopt");
  await adoption.getByRole("button", { name: "結束認養", exact: true }).click();
  await page.getByRole("button", { name: "確認結束認養", exact: true }).click();
  await submit("很髒", false, true, "rejected");
  await submit("損壞", false, true, "rejected");
  await submit("其他", false, true, "rejected");
  await expect(page.getByText("本機不實次數：3 · 已暫停回報")).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "前往會員中心", exact: true }).click();
  await expect(page.getByText("可用點數 65", { exact: true })).toBeVisible();
  await page.goto("/");
  await page.locator(".location-row").nth(1).click();
  await page.getByRole("link", { name: "回報問題", exact: true }).click();
  if (!isMobile)
    await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
  await expect(page.getByRole("alert")).toContainText("已暫停回報資格");
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeDisabled();
});

test("crossing 150 upgrades membership and redemption preserves the new level", async ({
  page,
}) => {
  // Seed a persisted ledger at the public storage boundary, then review through the UI.
  const { default: snapshot } = await import("../src/data/locations.json", {
    with: { type: "json" },
  });
  const bins = snapshot.filter((item) => item.kind === "bin");
  const createdAt = "2026-10-18T08:00:00.000Z";
  const reports = bins.slice(1, 44).map((bin, index) => ({
    id: `seed-${index}`,
    locationId: bin.id,
    type: "full",
    description: "示意既有紀錄",
    createdAt,
    reviewedAt: createdAt,
    status: "approved",
    adopter: true,
    firstReporter: true,
  }));
  await page.addInitScript(
    ({ reports, pending }) =>
      localStorage.setItem(
        "binsoon-a-flow-1018-v2",
        JSON.stringify({
          loggedIn: true,
          likes: [],
          redemptions: [],
          reports: [...reports, pending],
        }),
      ),
    {
      reports,
      pending: {
        id: "threshold-case",
        locationId: bins.find((bin) => bin.district === "大安區")!.id,
        type: "dirty",
        description: "升級測試案件",
        createdAt,
        status: "pending",
        adopter: false,
        firstReporter: true,
      },
    },
  );
  await page.goto("/#member");
  await expect(page.getByText("累積點數 149", { exact: true })).toBeVisible();
  await expect(page.getByText("再 1 點升到「高手」")).toBeVisible();
  await page.goto("/#review/threshold-case");
  await reviewAsStaff(page, "approved");
  await expect(
    page.getByRole("heading", { name: "高手", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "兌換獎品", exact: true }).click();
  await page
    .getByRole("article", { name: "7-11 50 元兌換券" })
    .getByRole("button", { name: "兌換", exact: true })
    .click();
  await page.getByRole("button", { name: "確認兌換 30 點" }).click();
  await page.getByRole("link", { name: "返回會員中心", exact: true }).click();
  await expect(page.getByText("累積點數 150", { exact: true })).toBeVisible();
  await expect(page.getByText("可用點數 120", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "高手", exact: true }),
  ).toBeVisible();
});
