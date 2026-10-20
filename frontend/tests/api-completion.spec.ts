import { test, expect } from "@playwright/test";
import { binId, workId, reportId, login } from "./api-fixtures";
import {
  completionFixture,
  completionId,
  photoFile,
} from "./api-completion-fixture";

test("staff attaches completion evidence before finishing and waits for administrator clearing", async ({
  page,
  context,
}) => {
  const fixture = completionFixture();
  await fixture.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByRole("button", { name: "提交完成", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("完成照片", { exact: true }).setInputFiles(photoFile);
  await page
    .getByRole("button", { name: "上傳並掛上完成照", exact: true })
    .click();
  await expect(page.getByText("完成照已保存", { exact: true })).toBeVisible();
  expect(fixture.state.evidenceCount).toBe(1);
  expect(fixture.state.finishCount).toBe(0);
  await page.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    page.getByText("工單狀態：待感測確認", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toHaveCount(0);
  const admin = await context.newPage();
  await fixture.setup(admin);
  await login(admin, "admin", `admin/work-orders/${workId}`);
  await admin.getByLabel("確認這是示範清空回傳，非真實 IoT").check();
  await admin
    .getByRole("button", { name: "送出示範清空", exact: true })
    .click();
  await expect(
    admin.getByText("工單狀態：已完成", { exact: true }),
  ).toBeVisible();
  await page.bringToFront();
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText(`完成紀錄 ${completionId}`, { exact: true }),
  ).toBeVisible();
  const citizen = await context.newPage();
  await fixture.setup(citizen);
  await login(citizen, "citizen", `bin/${binId}`);
  await expect(
    citizen
      .locator(".bin-action-panel .status-pill")
      .filter({ hasText: "餓了 · 0%" }),
  ).toBeVisible();
  await citizen
    .getByRole("button", { name: "謝謝清潔隊", exact: true })
    .click();
  await expect(
    citizen.getByRole("button", { name: "已感謝", exact: true }),
  ).toBeDisabled();
  expect(fixture.state.likeCount).toBe(1);
  await citizen.getByRole("link", { name: "導航過去", exact: true }).click();
  await expect(citizen).toHaveURL(
    (url) => url.hash === `#nav/${binId}?waste_type=general`,
  );
  await expect(
    citizen.getByRole("heading", { name: "步行導航", level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    citizen.getByRole("heading", {
      name: "滿桶流程測試桶",
      level: 2,
      exact: true,
    }),
  ).toBeVisible();
  expect(fixture.requests.map((r) => r.path.split("/").pop())).toEqual([
    "evidence",
    "finish",
    "demo-clear",
    "like",
  ]);
});

async function attach(page: import("@playwright/test").Page) {
  await page.getByLabel("完成照片", { exact: true }).setInputFiles(photoFile);
  await page
    .getByRole("button", { name: "上傳並掛上完成照", exact: true })
    .click();
}
async function clear(page: import("@playwright/test").Page) {
  await page.getByLabel("確認這是示範清空回傳，非真實 IoT").check();
  await page.getByRole("button", { name: "送出示範清空", exact: true }).click();
}

test("clearing before evidence changes capacity but never implies completion", async ({
  page,
  context,
}) => {
  const f = completionFixture();
  await f.setup(page);
  await login(page, "admin", `admin/work-orders/${workId}`);
  await clear(page);
  await expect(
    page.getByText("本工單已有清空回傳，不重複建立。"),
  ).toBeVisible();
  expect(f.state.completed).toBe(false);
  const citizen = await context.newPage();
  await f.setup(citizen);
  await login(citizen, "citizen", `bin/${binId}`);
  await expect(
    citizen
      .locator(".bin-action-panel .status-pill")
      .filter({ hasText: "餓了 · 0%" }),
  ).toBeVisible();
  await expect(citizen.getByText("尚無可驗證清運完成紀錄")).toBeVisible();
  await expect(
    citizen.getByRole("button", { name: "謝謝清潔隊", exact: true }),
  ).toHaveCount(0);
  await expect(citizen.locator(".api-history")).toContainText(
    "0% · collection · simulated",
  );
  await citizen.getByRole("link", { name: "← 返回地圖", exact: true }).click();
  await expect(
    citizen.getByRole("button", { name: /滿桶流程測試桶/ }).first(),
  ).toBeVisible();
  await citizen
    .getByRole("button", { name: /滿桶流程測試桶/ })
    .first()
    .click();
  await expect(
    citizen
      .locator(".bin-action-panel .status-pill")
      .filter({ hasText: "餓了 · 0%" })
      .first(),
  ).toBeVisible();
  await citizen.evaluate((id) => {
    window.location.hash = `review/${id}`;
  }, reportId);
  await expect(
    citizen.getByText("工單進度：已到場", { exact: true }),
  ).toBeVisible();
  const staff = await context.newPage();
  await f.setup(staff);
  await login(staff, "staff", `staff/tasks/${workId}`);
  await attach(staff);
  await expect(staff.getByText("完成照已保存", { exact: true })).toBeVisible();
  expect(f.state.completed).toBe(false);
  await expect(
    staff.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toHaveCount(0);
  await staff.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    staff.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible();
});

test("unknown evidence finish clear and like responses replay each original command only once", async ({
  page,
  context,
}) => {
  const f = completionFixture();
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  f.state.abortNext = "/evidence";
  await attach(page);
  await page
    .getByRole("button", { name: "重試原工單操作", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "提交完成", exact: true }),
  ).toBeEnabled();
  f.state.abortNext = "/finish";
  await page.getByRole("button", { name: "提交完成", exact: true }).click();
  await page
    .getByRole("button", { name: "重試原工單操作", exact: true })
    .click();
  await expect(
    page.getByText("工單狀態：待感測確認", { exact: true }),
  ).toBeVisible();
  const admin = await context.newPage();
  await f.setup(admin);
  await login(admin, "admin", `admin/work-orders/${workId}`);
  f.state.abortNext = "/demo-clear";
  await clear(admin);
  await admin
    .getByRole("button", { name: "重試原清空操作", exact: true })
    .click();
  await expect(
    admin.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible();
  const citizen = await context.newPage();
  await f.setup(citizen);
  await login(citizen, "citizen", `bin/${binId}`);
  f.state.abortNext = "/like";
  await citizen
    .getByRole("button", { name: "謝謝清潔隊", exact: true })
    .click();
  await citizen
    .getByRole("button", { name: "重試原按讚", exact: true })
    .click();
  await expect(
    citizen.getByRole("button", { name: "已感謝", exact: true }),
  ).toBeDisabled();
  expect([
    f.state.evidenceCount,
    f.state.finishCount,
    f.state.clearCount,
    f.state.likeCount,
  ]).toEqual([1, 1, 1, 1]);
  for (let i = 0; i < f.requests.length; i += 2)
    expect(f.requests[i + 1]).toEqual(f.requests[i]);
  expect(f.requests).toHaveLength(8);
});

test("admin conflict requires fresh read and explicit confirmation", async ({
  page,
}) => {
  const f = completionFixture();
  await f.setup(page);
  await login(page, "admin", `admin/work-orders/${workId}`);
  f.state.conflictNext = "/demo-clear";
  f.state.failReads = true;
  await clear(page);
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
    page.getByText("本工單已有清空回傳，不重複建立。"),
  ).toBeVisible();
  expect(f.requests[1].etag).toBe('"v4"');
  expect(f.requests[1].key).not.toBe(f.requests[0].key);
  expect(f.requests[1].body).toEqual(f.requests[0].body);
  expect(f.state.clearCount).toBe(1);
});

test("new report blocks finish on conflict and preserves attached evidence", async ({
  page,
}) => {
  const f = completionFixture();
  f.state.evidence = true;
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByRole("button", { name: "提交完成", exact: true }),
  ).toBeEnabled();
  f.state.newReport = true;
  await page.getByRole("button", { name: "提交完成", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "確認目前版本並重試", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("完成照已保存", { exact: true })).toBeVisible();
  await expect(
    page.getByText("查證狀態：查證屬實", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("查證狀態：查證中", { exact: true }),
  ).toBeVisible();
  expect(f.state.finishCount).toBe(0);
  expect(f.state.completed).toBe(false);
  expect(f.requests).toHaveLength(1);
  await page.getByRole("button", { name: "取消這次操作", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "查證結果", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "提交完成", exact: true }),
  ).toBeDisabled();
});

test("stale completion like refreshes latest and requires another citizen action", async ({
  page,
}) => {
  const f = completionFixture();
  Object.assign(f.state, {
    evidence: true,
    submitted: true,
    cleared: true,
    completed: true,
  });
  await f.setup(page);
  await login(page, "citizen", `bin/${binId}`);
  await expect(
    page.getByRole("button", { name: "謝謝清潔隊", exact: true }),
  ).toBeEnabled();
  f.state.completionId = "60000000-0000-4000-8000-000000000002";
  await page.getByRole("button", { name: "謝謝清潔隊", exact: true }).click();
  await expect(
    page.getByText("此成果已不是最新紀錄", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "謝謝清潔隊", exact: true }),
  ).toBeEnabled();
  expect(f.state.likeCount).toBe(0);
  expect(f.requests).toHaveLength(1);
  await page.getByRole("button", { name: "謝謝清潔隊", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已感謝", exact: true }),
  ).toBeDisabled();
  expect(f.state.likeCount).toBe(1);
  expect(f.requests[1].path).toContain(f.state.completionId);
  expect(f.requests[1].key).not.toBe(f.requests[0].key);
});

test("admin routes do not borrow other roles and completion screens fit narrow widths", async ({
  page,
}, testInfo) => {
  const f = completionFixture();
  await f.setup(page);
  let adminReads = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/admin/")) adminReads++;
  });
  await login(page, "citizen", `admin/work-orders/${workId}`);
  await expect(
    page.getByRole("link", { name: "管理員登入", exact: true }),
  ).toBeVisible();
  await login(page, "staff", `admin/work-orders/${workId}`);
  await expect(
    page.getByRole("link", { name: "管理員登入", exact: true }),
  ).toBeVisible();
  expect(adminReads).toBe(0);
  expect(f.requests).toHaveLength(0);
  await login(page, "admin", `admin/work-orders/${workId}`);
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 900 });
  await expect(
    page.getByRole("button", { name: "送出示範清空", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("確認這是示範清空回傳，非真實 IoT").focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "送出示範清空", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `../.scratch/frontend-api-integration/admin-completion-${testInfo.project.name}.png`,
    fullPage: true,
  });
  Object.assign(f.state, {
    evidence: true,
    submitted: true,
    cleared: true,
    completed: true,
  });
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByRole("heading", { name: "工作已完成", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "工單證據照片", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `../.scratch/frontend-api-integration/staff-completed-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

for (const role of ["admin", "citizen"] as const) {
  test(`${role} retries retained clear or like after same-actor reauthentication`, async ({
    page,
  }) => {
    const f = completionFixture();
    if (role === "citizen")
      Object.assign(f.state, {
        evidence: true,
        submitted: true,
        cleared: true,
        completed: true,
      });
    await f.setup(page);
    const next =
      role === "admin" ? `admin/work-orders/${workId}` : `bin/${binId}`;
    await login(page, role, next);
    f.state.expireNext = role === "admin" ? "/demo-clear" : "/like";
    if (role === "admin") await clear(page);
    else
      await page
        .getByRole("button", { name: "謝謝清潔隊", exact: true })
        .click();
    await expect(
      page.getByRole("button", { name: "登出", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("link", {
        name: role === "admin" ? "管理員登入" : "市民登入後感謝",
        exact: true,
      })
      .click();
    await page.getByLabel("帳號", { exact: true }).fill(`demo-${role}`);
    await page
      .getByLabel("密碼", { exact: true })
      .fill("fixture-only-not-a-real-password");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await page
      .getByRole("button", {
        name: role === "admin" ? "重試原清空操作" : "重試原按讚",
        exact: true,
      })
      .click();
    await expect
      .poll(() => (role === "admin" ? f.state.clearCount : f.state.likeCount))
      .toBe(1);
    expect(f.requests).toHaveLength(2);
    expect(f.requests[1]).toEqual(f.requests[0]);
  });
}

test("completion photo rejects invalid bytes and cannot finish without settled reports", async ({
  page,
}) => {
  const f = completionFixture();
  f.state.reviewed = false;
  await f.setup(page);
  await login(page, "staff", `staff/tasks/${workId}`);
  let uploads = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/media")) uploads++;
  });
  await page.getByLabel("完成照片", { exact: true }).setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("照片無法解碼，請重新選擇。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "上傳並掛上完成照", exact: true }),
  ).toBeDisabled();
  expect(uploads).toBe(0);
  await attach(page);
  await expect(page.getByText("完成照已保存", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "提交完成", exact: true }),
  ).toBeDisabled();
  expect(f.state.submitted).toBe(false);
  expect(f.state.completed).toBe(false);
});
