import { asPhone, captureReport } from "./phone-report-fixture";
import { test, expect } from "@playwright/test";
import {
  apiFixture,
  binId,
  reportId,
  workId,
  eventId,
  login,
  envelope,
  report,
} from "./api-fixtures";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMwTnMBAAGtAN6NqpJ+AAAAAElFTkSuQmCC",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await asPhone(page);
});

test("citizen submits a simulated phone capture and retries the same report command after lost response", async ({
  page,
}) => {
  const commands: { key?: string; body: unknown }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/media") {
      expect(
        route
          .request()
          .postDataBuffer()
          ?.includes(Buffer.from("demo-report.png")),
      ).toBeTruthy();
      await route.fulfill({ status: 201, json: { id: report.photo_ids[0] } });
      return true;
    }
    if (path === "/reports") {
      commands.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      if (commands.length === 1) await route.abort("failed");
      else await route.fulfill({ status: 200, json: report });
      return true;
    }
    if (path === `/reports/${reportId}`) {
      await route.fulfill({ json: report });
      return true;
    }
    if (path === "/me/reports") {
      await route.fulfill({ json: envelope([report]) });
      return true;
    }
    if (path.endsWith("/access")) {
      await route.fulfill({
        json: {
          url: "data:image/png;base64," + png.toString("base64"),
          expires_at: new Date(Date.now() + 300000).toISOString(),
        },
      });
      return true;
    }
  });
  await login(page, "citizen", `report/${binId}`);
  // 後端照片回報依 waste_type 指定哪一槽；預設一般垃圾，這裡改選資源回收。
  await expect(page.getByRole("radio", { name: "一般垃圾" })).toBeChecked();
  await page.getByRole("radio", { name: "資源回收" }).check();
  await captureReport(page);
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("連線未完成");
  await page.getByRole("button", { name: "重試原回報", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#report-done/${reportId}$`));
  await expect(page.getByText("待確認點數 0", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[1]).toEqual(commands[0]);
  expect(commands[0].body).toEqual({
    bin_id: binId,
    waste_type: "recycling",
    type: "full",
    description: expect.stringContaining("模擬測試"),
    photo_ids: report.photo_ids,
    position: { latitude: 25.033, longitude: 121.5358 },
    quick: false,
  });
  await expect(
    page.getByText("工單進度：待接單", { exact: true }),
  ).toBeVisible();
});

test("expired login preserves the original report key and body through reauthentication", async ({
  page,
}) => {
  const commands: unknown[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/media") {
      await route.fulfill({ status: 201, json: { id: report.photo_ids[0] } });
      return true;
    }
    if (path === "/reports") {
      commands.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      await route.fulfill(
        commands.length === 1
          ? {
              status: 401,
              json: {
                detail: {
                  code: "SESSION_EXPIRED",
                  message: "登入逾時",
                  fields: [],
                },
              },
            }
          : {
              status: 201,
              json: {
                ...report,
                work_order_id: null,
                work_status: null,
                assignment_status: "unassigned",
              },
            },
      );
      return true;
    }
    if (path === `/reports/${reportId}`) {
      await route.fulfill({
        json: {
          ...report,
          work_order_id: null,
          work_status: null,
          assignment_status: "unassigned",
        },
      });
      return true;
    }
  });
  await login(page, "citizen", `report/${binId}`);
  await captureReport(page);
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await page.getByRole("link", { name: "登入後繼續回報", exact: true }).click();
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.getByRole("button", { name: "重試原回報", exact: true }).click();
  await expect(
    page.getByText("工單進度：尚未派工", { exact: true }),
  ).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[1]).toEqual(commands[0]);
});

test("photo and server proximity errors retain the form without claiming success", async ({
  page,
}) => {
  let reports = 0;
  await apiFixture(page, async (route, path) => {
    if (path === "/media") {
      await route.fulfill({ status: 201, json: { id: report.photo_ids[0] } });
      return true;
    }
    if (path === "/reports") {
      reports++;
      await route.fulfill({
        status: 422,
        json: {
          detail: {
            code: "PROXIMITY_TOO_FAR",
            message: "距離超過 50 公尺",
            fields: [{ field: "position", message: "請確認現場座標" }],
          },
        },
      });
      return true;
    }
  });
  await login(page, "citizen", `report/${binId}`);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "確認送出回報", exact: true }),
  ).toBeDisabled();
  await captureReport(page);
  await page
    .getByRole("combobox", { name: "問題類型", exact: true })
    .selectOption("other");
  await expect(
    page.getByRole("button", { name: "確認送出回報", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "說明", exact: true })
    .fill("保留我的說明");
  await page.getByRole("button", { name: "確認送出回報", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("距離超過 50 公尺");
  await expect(
    page.getByRole("textbox", { name: "說明", exact: true }),
  ).toHaveValue("保留我的說明");
  await expect(
    page.getByRole("img", { name: "待送出的照片" }),
  ).toBeVisible();
  expect(reports).toBe(1);
});
