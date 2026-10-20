import { test, expect } from "@playwright/test";
import { binId, workId, reportId, login } from "./api-fixtures";
import { photoFile } from "./api-completion-fixture";
import { resolutionFixture } from "./api-resolution-fixture";

test("dirty work finishes with completion evidence without any clearing and the citizen reads the result", async ({
  page,
  context,
}) => {
  const f = resolutionFixture();
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await page.getByLabel("完成照片", { exact: true }).setInputFiles(photoFile);
  await page
    .getByRole("button", { name: "上傳並掛上完成照", exact: true })
    .click();
  await expect(page.getByText("完成照已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible();
  expect(f.uploads).toEqual(["completion"]);
  expect(f.requests.map((r) => r.path.split("/").pop())).toEqual([
    "evidence",
    "finish",
  ]);
  const citizen = await context.newPage();
  await f.setup(citizen);
  await login(citizen, "citizen", `review/${reportId}`);
  await expect(
    citizen.getByText("工單進度：已完成", { exact: true }),
  ).toBeVisible();
  await citizen.getByRole("link", { name: "查看這個桶", exact: true }).click();
  await expect(citizen.getByText("餓了 · 40%", { exact: true })).toBeVisible();
  await expect(
    citizen.getByRole("button", { name: "謝謝清潔隊", exact: true }),
  ).toBeEnabled();
});

test("broken work keeps repair restrictions until repaired without zeroing capacity", async ({
  page,
  context,
}) => {
  const f = resolutionFixture("broken");
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByRole("button", { name: "留待修繕", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("待修繕原因", { exact: true })
    .fill("鉸鏈損壞，等待備料");
  await page.getByRole("button", { name: "留待修繕", exact: true }).click();
  await expect(
    page.getByText("工單狀態：待修繕", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("處理原因：鉸鏈損壞，等待備料", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toHaveCount(0);
  const citizen = await context.newPage();
  await f.setup(citizen);
  await login(citizen, "citizen", `bin/${binId}`);
  await expect(citizen.locator(".bin-action-panel .status-pill")).toBeVisible();
  await expect(
    citizen.getByRole("link", { name: "導航過去", exact: true }),
  ).toHaveCount(0);
  await page.bringToFront();
  await page.getByLabel("完成照片", { exact: true }).setInputFiles(photoFile);
  await page
    .getByRole("button", { name: "上傳並掛上完成照", exact: true })
    .click();
  await expect(page.getByText("完成照已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible();
  await citizen.bringToFront();
  await expect(citizen.getByText("餓了 · 40%", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    citizen.getByRole("link", { name: "導航過去", exact: true }),
  ).toBeVisible();
  await expect(
    citizen.getByText("尚無可驗證清運完成紀錄", { exact: true }),
  ).toBeVisible();
  expect(f.state.fill).toBe(40);
  expect(f.requests.map((r) => r.path.split("/").pop())).toEqual([
    "defer-repair",
    "evidence",
    "finish",
  ]);
});

test("dismissal needs a site photo settled reports and reason and produces no completion", async ({
  page,
  context,
}) => {
  const f = resolutionFixture("other");
  f.state.reviewed = false;
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByRole("button", { name: "確認無需處理", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("無需處理原因", { exact: true })
    .fill("現場無堆積，已逐筆核對");
  await page.getByLabel("現況照片", { exact: true }).setInputFiles(photoFile);
  await page
    .getByRole("button", { name: "上傳並掛上現況照", exact: true })
    .click();
  await expect(page.getByText("現況照已保存", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認無需處理", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "查證結果", exact: true })
    .selectOption("rejected");
  await page.getByLabel("不實原因").fill("照片描述與現場不符");
  await page.getByRole("button", { name: "確認查證", exact: true }).click();
  await expect(
    page.getByText("查證狀態：查證不實", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("工單狀態：已到場", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "確認無需處理", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "已確認無需處理", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toHaveCount(0);
  expect(f.uploads).toEqual(["site"]);
  expect(f.state.fill).toBe(40);
  expect(f.state.otherOpen).toBe(true);
  const citizen = await context.newPage();
  await f.setup(citizen);
  await login(citizen, "citizen", `review/${reportId}`);
  await expect(
    citizen.getByText("工單進度：無需處理", { exact: true }),
  ).toBeVisible();
  await citizen.getByRole("link", { name: "查看這個桶", exact: true }).click();
  await expect(
    citizen.getByText("尚無可驗證清運完成紀錄", { exact: true }),
  ).toBeVisible();
  await expect(
    citizen.getByRole("button", { name: "謝謝清潔隊", exact: true }),
  ).toHaveCount(0);
});

async function attachPhoto(
  page: import("@playwright/test").Page,
  purpose = "completion",
) {
  const label = purpose === "site" ? "現況照片" : "完成照片",
    short = purpose === "site" ? "現況照" : "完成照";
  await page.getByLabel(label, { exact: true }).setInputFiles(photoFile);
  await page
    .getByRole("button", { name: `上傳並掛上${short}`, exact: true })
    .click();
  await expect(page.getByText(`${short}已保存`, { exact: true })).toBeVisible();
}

test("a rejected dumping report can still need work and another work order stays open", async ({
  page,
  context,
}) => {
  const f = resolutionFixture("dumping");
  f.state.reviewed = false;
  f.state.fill = 90;
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await page
    .getByRole("combobox", { name: "查證結果", exact: true })
    .selectOption("rejected");
  await page.getByLabel("不實原因").fill("照片描述與現場不符");
  await page.getByRole("button", { name: "確認查證", exact: true }).click();
  await expect(
    page.getByText("工單狀態：已到場", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("已入帳點數 0", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "提交完成", exact: true }),
  ).toBeDisabled();
  await attachPhoto(page);
  await page.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    location.hash = "staff/tasks/30000000-0000-4000-8000-000000000002";
  });
  await expect(
    page.getByText("工單狀態：已到場", { exact: true }),
  ).toBeVisible();
  const citizen = await context.newPage();
  await f.setup(citizen);
  await login(citizen, "citizen", `review/${reportId}`);
  await expect(
    citizen.getByText("查證狀態：查證不實", { exact: true }),
  ).toBeVisible();
  await expect(
    citizen.getByText("工單進度：已完成", { exact: true }),
  ).toBeVisible();
  await citizen.getByRole("link", { name: "查看這個桶", exact: true }).click();
  await expect(
    citizen.getByText("吃飽了 · 90%", { exact: true }),
  ).toBeVisible();
});

test("other work completes without clearing and another broken incident keeps the bin unavailable", async ({
  page,
  context,
}) => {
  const f = resolutionFixture("other");
  f.state.otherBroken = true;
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await attachPhoto(page);
  await page.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible();
  const citizen = await context.newPage();
  await f.setup(citizen);
  await login(citizen, "citizen", `bin/${binId}`);
  await expect(citizen.locator(".bin-action-panel .status-pill")).toBeVisible();
  await expect(
    citizen.getByRole("link", { name: "導航過去", exact: true }),
  ).toHaveCount(0);
  await expect(
    citizen.getByText("尚無可驗證清運完成紀錄", { exact: true }),
  ).toBeVisible();
  expect(f.state.fill).toBe(40);
  expect(f.requests.map((r) => r.path.split("/").pop())).toEqual([
    "evidence",
    "finish",
  ]);
});

test("unknown repair and dismissal replay the original reason body key and ETag and photo purposes stay separate", async ({
  page,
}) => {
  const f = resolutionFixture("broken");
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await page.getByLabel("待修繕原因", { exact: true }).fill("等待替換鉸鏈");
  f.state.abortNext = "/defer-repair";
  await page.getByRole("button", { name: "留待修繕", exact: true }).click();
  await page
    .getByRole("button", { name: "重試原工單操作", exact: true })
    .click();
  await expect(
    page.getByText("工單狀態：待修繕", { exact: true }),
  ).toBeVisible();
  expect(f.requests[1]).toEqual(f.requests[0]);
  await attachPhoto(page, "completion");
  await expect(
    page.getByRole("button", { name: "確認無需處理", exact: true }),
  ).toBeDisabled();
  await attachPhoto(page, "site");
  await page
    .getByLabel("無需處理原因", { exact: true })
    .fill("現場複查後確認不需處理");
  f.state.abortNext = "/dismiss";
  await page.getByRole("button", { name: "確認無需處理", exact: true }).click();
  await page
    .getByRole("button", { name: "重試原工單操作", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "已確認無需處理", exact: true }),
  ).toBeVisible();
  expect(f.uploads).toEqual(["completion", "site"]);
  const dismiss = f.requests.filter((r) => r.path.endsWith("/dismiss"));
  expect(dismiss).toHaveLength(2);
  expect(dismiss[1]).toEqual(dismiss[0]);
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toHaveCount(0);
});

test("dismiss conflict waits for a successful fresh read and explicit confirmation of the preserved reason", async ({
  page,
}) => {
  const f = resolutionFixture();
  f.state.site = true;
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await page
    .getByLabel("無需處理原因", { exact: true })
    .fill("現場已由其他作業處理");
  f.state.conflictNext = "/dismiss";
  f.state.failReads = true;
  await page.getByRole("button", { name: "確認無需處理", exact: true }).click();
  await expect(page.getByText("工單更新失敗", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認目前版本並重試", exact: true }),
  ).toBeDisabled();
  expect(f.requests).toHaveLength(1);
  f.state.failReads = false;
  await page.getByRole("button", { name: "重新載入", exact: true }).click();
  await expect(page.getByText("工單版本 v4", { exact: true })).toBeVisible();
  expect(f.requests).toHaveLength(1);
  await page
    .getByRole("button", { name: "確認目前版本並重試", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "已確認無需處理", exact: true }),
  ).toBeVisible();
  expect(f.requests[1].body).toEqual({ reason: "現場已由其他作業處理" });
  expect(f.requests[1].etag).toBe('"v4"');
  expect(f.requests[1].key).not.toBe(f.requests[0].key);
});

test("resolution actions require staff ownership arrival and nonblank reasons", async ({
  page,
}, testInfo) => {
  const f = resolutionFixture("broken");
  await f.setup(page);
  let mutations = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && !r.url().includes("/auth/")) mutations++;
  });
  for (const role of ["citizen", "admin"]) {
    await login(page, role, `staff/tasks/${workId}`);
    await expect(
      page.getByRole("link", { name: "隊員登入", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("現況照片", { exact: true })).toHaveCount(0);
  }
  f.state.assigned = "another-staff";
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(page.getByText("此工單不是由你接單，只能查看。")).toBeVisible();
  await expect(page.getByLabel("完成照片", { exact: true })).toHaveCount(0);
  f.state.assigned = "staff-uuid";
  f.state.arrived = false;
  f.state.workStatus = "processing";
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByRole("button", { name: "確認到場", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("現況照片", { exact: true })).toHaveCount(0);
  f.state.arrived = true;
  f.state.workStatus = "arrived";
  await login(page, "staff", `staff/tasks/${workId}`);
  await page.getByLabel("待修繕原因", { exact: true }).fill("   ");
  await expect(
    page.getByRole("button", { name: "留待修繕", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("無需處理原因", { exact: true }).fill("   ");
  await expect(
    page.getByRole("button", { name: "確認無需處理", exact: true }),
  ).toBeDisabled();
  expect(mutations).toBe(0);
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `../.scratch/frontend-api-integration/work-resolution-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

for (const operation of ["defer-repair", "dismiss"]) {
  test(`${operation} retains its original reason across same-actor reauthentication`, async ({
    page,
  }) => {
    const f = resolutionFixture("broken");
    f.state.site = true;
    await f.setup(page);
    await login(page, "staff", `staff/tasks/${workId}`);
    const dismiss = operation === "dismiss";
    await page
      .getByLabel(dismiss ? "無需處理原因" : "待修繕原因", { exact: true })
      .fill("現場核對後的處理原因");
    f.state.expireNext = `/${operation}`;
    await page
      .getByRole("button", {
        name: dismiss ? "確認無需處理" : "留待修繕",
        exact: true,
      })
      .click();
    await page.getByRole("link", { name: "隊員登入", exact: true }).click();
    await page.getByLabel("帳號", { exact: true }).fill("demo-staff");
    await page
      .getByLabel("密碼", { exact: true })
      .fill("fixture-only-not-a-real-password");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(
      page.getByText(
        `原操作已保留：${dismiss ? "確認無需處理" : "留待修繕"}：現場核對後的處理原因`,
        { exact: false },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "重試原工單操作", exact: true })
      .click();
    await expect(
      page.getByText(`工單狀態：${dismiss ? "無需處理" : "待修繕"}`, {
        exact: true,
      }),
    ).toBeVisible();
    expect(f.requests).toHaveLength(2);
    expect(f.requests[1]).toEqual(f.requests[0]);
  });
}

test("repairing one broken work cannot unlock a zero-capacity bin with another broken incident", async ({
  page,
  context,
}) => {
  const f = resolutionFixture("broken");
  f.state.otherBroken = true;
  f.state.fill = 0;
  f.state.completion = true;
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await page.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible();
  const citizen = await context.newPage();
  await f.setup(citizen);
  await login(citizen, "citizen", `bin/${binId}`);
  await expect(citizen.locator(".bin-action-panel .status-pill")).toBeVisible();
  await expect(citizen.getByText("0%（模擬）", { exact: true })).toBeVisible();
  await expect(
    citizen.getByRole("link", { name: "導航過去", exact: true }),
  ).toHaveCount(0);
  await citizen
    .getByRole("link", { name: "尋找可用桶並導航", exact: true })
    .click();
  await expect(
    citizen.getByText("目前沒有其他可用桶", { exact: false }),
  ).toBeVisible();
  await expect(
    citizen.getByRole("button", { name: "謝謝清潔隊", exact: true }),
  ).toHaveCount(0);
  expect(f.requests.map((r) => r.path.split("/").pop())).toEqual(["finish"]);
});
