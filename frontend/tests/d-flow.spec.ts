import { test, expect } from "@playwright/test";
import { adoptLoginUrl } from "./adoption-helpers";
test("citizen report is verified and completed by staff while both tabs stay synchronized", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/#login");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.locator(".location-row").first().click();
  const binUrl = page.url();
  await expect(
    page.getByText("尚無可驗證清運完成紀錄", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/上次清運 3 小時前/)).toHaveCount(0);
  await page.goto(binUrl.replace("#bin/", "#report/") + "?demo=1");
  await page.getByRole("button", { name: "滿了", exact: false }).click();
  await page.getByRole("button", { name: "拍一張示意照片" }).click();
  await page.getByLabel("示意定位情境").selectOption("near");
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await page
    .getByRole("link", { name: "看審核結果", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("示範案件狀態")).toHaveCount(0);
  const staffHref = await page
    .getByRole("link", { name: "切換隊員查看此工單" })
    .getAttribute("href");
  const crew = await context.newPage();
  await crew.goto("/" + staffHref);
  await crew.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await crew.getByRole("button", { name: "接單", exact: true }).click();
  await crew.getByRole("button", { name: "示範已到場" }).click();
  await crew.getByRole("button", { name: "確認屬實", exact: true }).click();
  await expect(page.getByText("可用點數 64", { exact: true })).toBeVisible();
  await crew.getByRole("button", { name: "拍一張完成示意照片" }).click();
  await crew.getByRole("button", { name: "提交完成證據" }).click();
  await expect(crew.getByTestId("task-status")).toHaveText("待感測確認");
  await crew.screenshot({
    path: testInfo.outputPath("staff-detail-waiting.png"),
    fullPage: true,
  });
  await crew.getByRole("button", { name: "示範收到清空回傳" }).click();
  await expect(crew.getByTestId("task-status")).toHaveText("處理完成");
  await page.goto(binUrl);
  await expect(page.getByText("餓了 · 0%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "按讚", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已按讚", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByText(/本次感謝 1 讚/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "已按讚", exact: true }),
  ).toBeDisabled();
  await page.goto("/#map");
  await page.locator(".location-row").nth(1).click();
  await expect(page.getByText(/本次感謝 0 讚/)).toBeVisible();
});

test("legacy data survives migration and incompatible ledgers are never overwritten", async ({
  page,
}) => {
  const { default: snapshot } = await import("../src/data/locations.json", {
    with: { type: "json" },
  });
  const bin = snapshot.find(
    (p) => p.kind === "bin" && p.district === "大安區",
  )!;
  const legacy = JSON.stringify({
    loggedIn: true,
    likes: [bin.id],
    reports: [
      {
        id: "legacy-approved",
        locationId: bin.id,
        type: "dirty",
        description: "舊紀錄",
        createdAt: "2026-10-18T08:00:00.000Z",
        reviewedAt: "2026-10-18T08:10:00.000Z",
        status: "approved",
        adopter: true,
        firstReporter: true,
      },
    ],
    redemptions: [],
  });
  await page.addInitScript(
    (value) => localStorage.setItem("binsoon-a-flow-1018-v2", value),
    legacy,
  );
  await page.goto("/#member");
  await expect(page.getByText("可用點數 65", { exact: true })).toBeVisible();
  await page.goto("/#staff/tasks");
  await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await page.goto("/#member");
  await expect(page.getByText("可用點數 65", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("binsoon-a-flow-1018-v2")),
  ).toBe(legacy);
  await page.evaluate(() =>
    localStorage.setItem("binsoon-demo-1019-v3", '{"tasks":[{}]}'),
  );
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: "未建立空帳本覆寫" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("binsoon-demo-1019-v3")),
  ).toBe('{"tasks":[{}]}');
});

test("staff workspace has no citizen chrome and remains usable at narrow widths", async ({
  page,
}, testInfo) => {
  await page.goto("/#staff/tasks");
  await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await expect(
    page.getByRole("heading", { name: "今日派工", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "會員中心", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("staff-tasks-original.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  for (const route of [
    "#staff/tasks",
    "#staff/notifications",
    "#staff/route",
    "#staff/honor",
  ]) {
    await page.goto("/" + route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`${route.slice(1).replaceAll("/", "-")}.png`),
      fullPage: true,
    });
  }
});

test("two tabs redeem against the same latest balance without overspending", async ({
  page,
  context,
}) => {
  await page.goto("/#login?next=rewards");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  const other = await context.newPage();
  await other.goto("/#rewards");
  for (const tab of [page, other])
    await tab
      .getByRole("article", { name: "全家 50 元兌換券" })
      .getByRole("button", { name: "兌換", exact: true })
      .click();
  await Promise.allSettled(
    [page, other].map((tab) =>
      tab
        .getByRole("button", { name: "確認兌換 50 點" })
        .click({ timeout: 2000 }),
    ),
  );
  await page.goto("/#member");
  await expect(page.getByText("可用點數 13", { exact: true })).toBeVisible();
  await other.goto("/#member");
  await expect(other.getByText("可用點數 13", { exact: true })).toBeVisible();
});

test("a member joins a fixture event as a later reporter without gaining another award", async ({
  page,
}) => {
  await page.goto("/#staff/tasks");
  await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await page
    .locator(".staff-task-card")
    .filter({ hasText: "3 筆" })
    .first()
    .click();
  const crewUrl = page.url();
  await page.getByRole("link", { name: "切回市民桶詳情" }).click();
  const binUrl = page.url();
  await page.goto("/#login?next=" + encodeURIComponent(binUrl.split("#")[1]));
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.goto(binUrl.replace("#bin/", "#report/") + "?demo=1");
  await page.getByRole("button", { name: "桶旁有堆放", exact: false }).click();
  await page.getByRole("button", { name: "拍一張示意照片" }).click();
  await page.getByLabel("示意定位情境").selectOption("near");
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await expect(page.locator(".done-points")).toHaveText("+0");
  await page.goto(crewUrl);
  await page.getByRole("button", { name: "接單", exact: true }).click();
  await page.getByRole("button", { name: "示範已到場" }).click();
  const own = page
    .getByRole("article", { name: /回報證據：/ })
    .filter({ hasText: "本機示範市民" });
  await own.getByRole("button", { name: "確認屬實", exact: true }).click();
  await page.goto("/#member");
  await expect(page.getByText("可用點數 63", { exact: true })).toBeVisible();
  await expect(page.locator(".report-history li")).toHaveCount(1);
});

test("submission rechecks persisted adoption even when the displayed form has not received its update", async ({
  page,
}) => {
  await page.goto(adoptLoginUrl());
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.getByLabel("認養者公開名稱").fill("提交資格測試");
  await page.getByRole("button", { name: "送出認養申請", exact: true }).click();
  await expect(
    page.getByText("申請已送出，等待清潔隊審核。", { exact: false }),
  ).toBeVisible();
  await page.goto("/#adopt");
  const adoption = page.getByRole("article", { name: /認養申請：/ }).first();
  await adoption.getByText("展示控制：認養審批", { exact: true }).click();
  await adoption.getByRole("button", { name: "核准認養", exact: true }).click();
  await adoption.getByRole("link", { name: "查看這個桶", exact: true }).click();
  const binUrl = page.url();
  await page.goto(binUrl.replace("#bin/", "#report/") + "?demo=1");
  await page.getByRole("button", { name: "很髒", exact: false }).click();
  await page.getByRole("button", { name: "拍一張示意照片" }).click();
  await page.getByLabel("示意定位情境").selectOption("near");
  await expect(
    page.getByText("這個桶的核准認養者 · 屬實首報 +2 點"),
  ).toBeVisible();
  // Persisted boundary: represent a newer adoption result before this view gets its notification.
  await page.evaluate(() => {
    const key = "binsoon-b-flow-1018-v1";
    const stored = JSON.parse(localStorage.getItem(key)!);
    stored.adoptions = stored.adoptions.map((a: { status: string }) => ({
      ...a,
      status: "ended",
    }));
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await expect(page.locator(".done-points")).toHaveText("+1");
});
