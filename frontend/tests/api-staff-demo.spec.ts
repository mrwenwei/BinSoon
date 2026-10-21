import { test, expect } from "@playwright/test";
import {
  apiFixture,
  arrivedWork,
  location,
  report,
  workId,
  reportId,
  login,
} from "./api-fixtures";

test("one-click verification data is explicit and never sends a review before confirmation", async ({
  page,
}, info) => {
  const calls: { path: string; body: unknown }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/staff/work-orders/${workId}`) {
      await route.fulfill({
        headers: { ETag: '"v3"' },
        json: {
          work_order: arrivedWork,
          location,
          reports: [report],
          evidence: [],
          completion_requirements: {
            missing: [
              "reports_reviewed",
              "completion_photo",
              "fresh_clear_reading",
            ],
          },
        },
      });
      return true;
    }
    if (
      route.request().method() === "POST" &&
      path.startsWith("/staff/work-orders/")
    ) {
      calls.push({ path, body: route.request().postDataJSON() });
      await route.abort("failed");
      return true;
    }
  });
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByRole("button", { name: "填入模擬屬實資料", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "填入模擬屬實資料", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "查證結果", exact: true }),
  ).toHaveValue("approved");
  await page
    .getByRole("button", { name: "填入模擬不實資料", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "查證結果", exact: true }),
  ).toHaveValue("rejected");
  await expect(
    page.getByRole("textbox", { name: "不實原因", exact: true }),
  ).toHaveValue("[模擬測試] 示範不實回報，非現場查證結論。");
  expect(calls).toHaveLength(0);
  await page
    .getByRole("region", { name: "模擬查證資料" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath(`staff-verification-${info.project.name}.png`),
  });
  await page.getByRole("button", { name: "確認查證", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重試原工單操作", exact: true }),
  ).toBeEnabled();
  expect(calls).toEqual([
    {
      path: `/staff/work-orders/${workId}/reports/${reportId}/review`,
      body: {
        decision: "rejected",
        reason: "[模擬測試] 示範不實回報，非現場查證結論。",
      },
    },
  ]);
  await expect(
    page.getByRole("button", { name: "填入模擬屬實資料", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "重試原工單操作", exact: true })
    .click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1]).toEqual(calls[0]);
});

test("demo work photos and reasons prefill independently without uploading or finishing the work", async ({
  page,
}, info) => {
  let version = 3;
  const evidence: {
    id: string;
    media_id: string;
    purpose: string;
    created_at: string;
  }[] = [];
  const uploads: string[] = [];
  const actions: {
    path: string;
    body: { media_id: string; purpose: string };
  }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/staff/work-orders/${workId}`) {
      await route.fulfill({
        headers: { ETag: `"v${version}"` },
        json: {
          work_order: { ...arrivedWork, type: "broken", version },
          location,
          reports: [{ ...report, status: "approved" }],
          evidence,
          completion_requirements: {
            missing: evidence.some((e) => e.purpose === "completion")
              ? []
              : ["completion_photo"],
          },
        },
      });
      return true;
    }
    if (path === "/media") {
      const payload = route.request().postDataBuffer()!;
      expect(
        payload.includes(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      ).toBeTruthy();
      const purpose = payload.includes(Buffer.from("\r\nsite\r\n"))
        ? "site"
        : "completion";
      expect(payload.includes(Buffer.from(`demo-${purpose}.png`))).toBeTruthy();
      uploads.push(purpose);
      await route.fulfill({ status: 201, json: { id: `media-${purpose}` } });
      return true;
    }
    if (
      route.request().method() === "POST" &&
      path.startsWith("/staff/work-orders/")
    ) {
      const body = route.request().postDataJSON();
      actions.push({ path, body });
      expect(path).toBe(`/staff/work-orders/${workId}/evidence`);
      evidence.push({
        id: `evidence-${body.purpose}`,
        ...body,
        created_at: report.created_at,
      });
      version++;
      await route.fulfill({ json: { ...arrivedWork, version } });
      return true;
    }
  });
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByRole("button", { name: "產生模擬完成照", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "產生模擬完成照", exact: true })
    .click();
  await page
    .getByRole("button", { name: "產生模擬現況照", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "待送出的模擬完成照片" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "待送出的模擬現況照片" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "填入模擬待修繕原因", exact: true })
    .click();
  await page
    .getByRole("button", { name: "填入模擬無需處理原因", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "待修繕原因", exact: true }),
  ).toHaveValue("[模擬測試] 示範零件待更換，非現場檢查結果。");
  await expect(
    page.getByRole("textbox", { name: "無需處理原因", exact: true }),
  ).toHaveValue("[模擬測試] 示範現場無需處理，非現場檢查結果。");
  expect(uploads).toHaveLength(0);
  expect(actions).toHaveLength(0);
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: info.outputPath(`staff-demo-${info.project.name}.png`),
    fullPage: true,
  });
  await page
    .getByRole("region", { name: "模擬完成照", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath(`staff-photo-tools-${info.project.name}.png`),
  });
  await page
    .getByRole("button", { name: "上傳並掛上完成照", exact: true })
    .click();
  await expect(page.getByText("完成照已保存", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "待送出的模擬現況照片" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "上傳並掛上現況照", exact: true })
    .click();
  await expect(page.getByText("現況照已保存", { exact: true })).toBeVisible();
  expect(uploads).toEqual(["completion", "site"]);
  expect(actions.map((a) => a.body)).toEqual([
    { media_id: "media-completion", purpose: "completion" },
    { media_id: "media-site", purpose: "site" },
  ]);
});

for (const scenario of ["not-arrived", "other-owner", "removed"] as const) {
  test(`demo tools cannot bypass work restrictions: ${scenario}`, async ({
    page,
  }) => {
    await apiFixture(page, async (route, path) => {
      if (path === `/staff/work-orders/${workId}`) {
        await route.fulfill({
          headers: { ETag: '"v3"' },
          json: {
            work_order: {
              ...arrivedWork,
              arrived_at:
                scenario === "not-arrived" ? null : arrivedWork.arrived_at,
              status: scenario === "not-arrived" ? "processing" : "arrived",
              assigned_staff_id:
                scenario === "other-owner" ? "another-staff" : "staff-uuid",
              blocked_by_removed_bin: scenario === "removed",
            },
            location,
            reports: [report],
            evidence: [],
            completion_requirements: {
              missing: ["reports_reviewed", "completion_photo"],
            },
          },
        });
        return true;
      }
    });
    await login(page, "staff", `staff/tasks/${workId}`);
    await expect(
      page.getByRole("button", { name: "填入模擬屬實資料", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "填入模擬不實資料", exact: true }),
    ).toBeDisabled();
    if (scenario === "removed")
      await expect(
        page.getByRole("button", { name: "產生模擬完成照", exact: true }),
      ).toBeDisabled();
    else
      await expect(
        page.getByRole("button", { name: "產生模擬完成照", exact: true }),
      ).toHaveCount(0);
  });
}
