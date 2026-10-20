import { test, expect } from "@playwright/test";
import {
  apiFixture,
  login,
  binId,
  location,
  status,
  envelope,
  arrivedWork,
  workId,
} from "./api-fixtures";
import { adoption, adoptionId } from "./api-adoption-fixture";

test("availability requery excludes removed installed bins without applying map UI filters", async ({
  page,
}) => {
  let removed = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/map/availability") {
      expect(
        [...new URL(route.request().url()).searchParams.keys()].sort(),
      ).toEqual(["latitude", "longitude"]);
      await route.fulfill({
        json: {
          has_existing_bin_within_radius: !removed,
          radius_m: 300,
          nearest_installed_bin: removed ? null : location,
          bins: removed ? [] : [location],
          proposals: [],
        },
      });
      return true;
    }
  });
  await login(page, "citizen", "vote/create");
  await page.getByLabel("緯度", { exact: true }).fill("25.033");
  await page.getByLabel("經度", { exact: true }).fill("121.5358");
  await page.getByRole("button", { name: "查詢周邊位置", exact: true }).click();
  await expect(
    page.getByText("API 未知桶", { exact: true }).first(),
  ).toBeVisible();
  removed = true;
  await page.getByRole("button", { name: "查詢周邊位置", exact: true }).click();
  await expect(
    page.getByText(
      "300 公尺內無已設置未撤除桶；包含滿桶、未知及維修，未設置提案與場所不算桶。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("API 未知桶", { exact: true })).toHaveCount(0);
});
const lifecycle = {
  bin_id: binId,
  version: 7,
  operational_status: "normal",
  placement_status: "existing",
  installed_at: null,
  removed_at: null,
  reason: null,
};

test("admin removal refreshes adopter rights and removes stop plus existing road guidance in other tabs", async ({
  page,
  context,
}) => {
  let removed = false;
  const setup = (target: import("@playwright/test").Page) =>
    apiFixture(target, async (route, path) => {
      if (path === `/bins/${binId}/lifecycle`) {
        await route.fulfill({
          headers: { ETag: removed ? '"v8"' : '"v7"' },
          json: {
            ...lifecycle,
            version: removed ? 8 : 7,
            operational_status: removed ? "removed" : "normal",
          },
        });
        return true;
      }
      if (path === `/admin/bins/${binId}/lifecycle`) {
        removed = true;
        await route.fulfill({
          json: { ...lifecycle, version: 8, operational_status: "removed" },
        });
        return true;
      }
      if (path === `/adoptions/${adoptionId}`) {
        await route.fulfill({
          json: {
            ...adoption,
            status: removed ? "ended" : "active",
            preferences: { full: !removed, dumping: !removed, dirty: !removed },
          },
        });
        return true;
      }
      if (path === "/staff/route-stops") {
        await route.fulfill({
          json: {
            origin: {
              latitude: 25.0321,
              longitude: 121.5341,
              source: "demo_fixed",
            },
            stops: removed
              ? []
              : [
                  {
                    bin_id: binId,
                    label: "待撤桶",
                    latitude: 25.033,
                    longitude: 121.5358,
                    work_order_ids: [workId],
                    waste_types: ["general"],
                    priority: "normal",
                  },
                ],
            generated_at: "2026-10-20T03:00:00Z",
          },
        });
        return true;
      }
    });
  await setup(page);
  await login(page, "staff", "staff/route");
  await page.route("https://valhalla1.openstreetmap.de/route", (route) =>
    route.fulfill({
      json: {
        trip: {
          status: 0,
          units: "kilometers",
          summary: { length: 1.2, time: 240 },
          legs: [
            {
              shape: "_x{vn@gx}xfFu@|@qFCcAjA",
              summary: { length: 1.2, time: 240 },
              maneuvers: [
                {
                  type: 10,
                  instruction: "Turn right",
                  street_names: ["信義路"],
                  length: 1.2,
                  travel_type: "motor_scooter",
                },
              ],
            },
          ],
        },
      },
    }),
  );
  await page.getByRole("button", { name: "產生路線指引" }).click();
  await expect(page.getByText("道路里程 1.2 公里")).toBeVisible();
  const owner = await context.newPage();
  await setup(owner);
  await login(owner, "citizen", `adopt/${adoptionId}`);
  await expect(
    owner.getByRole("link", { name: "認養快捷通報", exact: true }),
  ).toBeVisible();
  const admin = await context.newPage();
  await setup(admin);
  await login(admin, "admin", `admin/bins/${binId}`);
  await admin.getByLabel("撤除原因", { exact: true }).fill("道路工程");
  await admin.getByRole("button", { name: "預覽撤除", exact: true }).click();
  await admin.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    admin.getByText("已撤除，保留歷史紀錄", { exact: true }),
  ).toBeVisible();
  await owner.bringToFront();
  await expect(
    owner.getByText("認養狀態：已結束", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    owner.getByText("目前通知：滿桶 關閉、堆放 關閉、髒污 關閉", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    owner.getByRole("link", { name: "認養快捷通報", exact: true }),
  ).toHaveCount(0);
  await expect(
    owner.getByRole("button", { name: "預覽更新偏好", exact: true }),
  ).toHaveCount(0);
  await page.bringToFront();
  await page.getByRole("button", { name: "更新待辦站點", exact: true }).click();
  await expect(
    page.getByText("今日已無待清運站點。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("道路里程 1.2 公里")).toHaveCount(0);
  await expect(page.locator(".road-route")).toHaveCount(0);
});

test("admin removes with independent lifecycle ETag and confirmation; unknown retry uses original command", async ({
  page,
}) => {
  let removed = false;
  const commands: { body: unknown; key: string; etag: string }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/bins/${binId}/lifecycle`) {
      await route.fulfill({
        headers: { ETag: removed ? '"v8"' : '"v7"' },
        json: {
          ...lifecycle,
          version: removed ? 8 : 7,
          operational_status: removed ? "removed" : "normal",
          reason: removed ? "現場工程撤桶" : null,
          removed_at: removed ? "2026-10-20T03:00:00Z" : null,
        },
      });
      return true;
    }
    if (path === `/admin/bins/${binId}/lifecycle`) {
      commands.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
        etag: route.request().headers()["if-match"],
      });
      removed = true;
      if (commands.length === 1) await route.abort();
      else
        await route.fulfill({
          json: {
            ...lifecycle,
            version: 8,
            operational_status: "removed",
            reason: "現場工程撤桶",
            removed_at: "2026-10-20T03:00:00Z",
          },
        });
      return true;
    }
  });
  await login(page, "admin", `admin/bins/${binId}`);
  await expect(
    page.getByRole("heading", { name: "撤除桶管理", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "預覽撤除", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("撤除原因", { exact: true }).fill("現場工程撤桶");
  await page.getByRole("button", { name: "預覽撤除", exact: true }).click();
  expect(commands).toHaveLength(0);
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(
    page.getByText("已撤除，保留歷史紀錄", { exact: true }),
  ).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[1]).toEqual(commands[0]);
  expect(commands[0].etag).toBe('"v7"');
  expect(commands[0].body).toEqual({
    action: "remove",
    reason: "現場工程撤桶",
  });
  await expect(
    page.getByRole("button", { name: "預覽撤除", exact: true }),
  ).toHaveCount(0);
});

test("another admin tab removal rejects stale confirmation and rereads without restoring or auto retry", async ({
  page,
  context,
}) => {
  let removed = false;
  const calls: string[] = [];
  const setup = (target: import("@playwright/test").Page) =>
    apiFixture(target, async (route, path) => {
      if (path === `/bins/${binId}/lifecycle`) {
        await route.fulfill({
          headers: { ETag: removed ? '"v8"' : '"v7"' },
          json: {
            ...lifecycle,
            version: removed ? 8 : 7,
            operational_status: removed ? "removed" : "normal",
          },
        });
        return true;
      }
      if (path === `/admin/bins/${binId}/lifecycle`) {
        calls.push(route.request().headers()["if-match"]);
        if (removed)
          await route.fulfill({
            status: 412,
            json: {
              detail: {
                code: "VERSION_CONFLICT",
                message: "版本已更新",
                fields: [],
              },
            },
          });
        else {
          removed = true;
          await route.fulfill({
            json: { ...lifecycle, version: 8, operational_status: "removed" },
          });
        }
        return true;
      }
    });
  await setup(page);
  await login(page, "admin", `admin/bins/${binId}`);
  await page.getByLabel("撤除原因", { exact: true }).fill("舊頁原因");
  await page.getByRole("button", { name: "預覽撤除", exact: true }).click();
  const other = await context.newPage();
  await setup(other);
  await login(other, "admin", `admin/bins/${binId}`);
  await other.getByLabel("撤除原因", { exact: true }).fill("先行撤除");
  await other.getByRole("button", { name: "預覽撤除", exact: true }).click();
  await other.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    other.getByText("已撤除，保留歷史紀錄", { exact: true }),
  ).toBeVisible();
  // Keep the first page stale until its explicit command is rejected by the server.
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("版本已更新");
  await expect(
    page.getByText("已撤除，保留歷史紀錄", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認目前版本並重試", exact: true }),
  ).toBeDisabled();
  expect(calls).toEqual(['"v7"', '"v7"']);
});

for (const role of ["citizen", "staff"]) {
  test(`${role} cannot open lifecycle management with its own session`, async ({
    page,
  }) => {
    let lifecycleReads = 0;
    await apiFixture(page, async (_route, path) => {
      if (path.endsWith("/lifecycle")) lifecycleReads++;
    });
    await login(page, role, `admin/bins/${binId}`);
    await expect(
      page.getByRole("heading", { name: "請以管理員身份登入", exact: true }),
    ).toBeVisible();
    expect(lifecycleReads).toBe(0);
  });
}

test("removed bins remain marked in backend map projection and cannot report or navigate; unfinished work blocked", async ({
  page,
}) => {
  const removedStatus = {
    ...status,
    operational_status: "removed",
    unavailable_reasons: ["removed"],
    removed_at: "2026-10-20T03:00:00Z",
  };
  const removedLocation = {
    ...location,
    bin_status: removedStatus,
    compartments: [removedStatus],
  };
  let allRemoved = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/map/locations") {
      allRemoved =
        new URL(route.request().url()).searchParams.get("include_removed") ===
        "true";
      await route.fulfill({ json: envelope([removedLocation]) });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location: removedLocation,
          status: removedStatus,
          can_report: false,
          report_block_reason: "removed",
          can_apply_adoption: false,
          my_adoption_id: null,
          adopter: null,
        },
      });
      return true;
    }
    if (path === `/staff/work-orders/${workId}`) {
      await route.fulfill({
        headers: { ETag: '"v3"' },
        json: {
          work_order: {
            ...arrivedWork,
            status: "processing",
            blocked_by_removed_bin: true,
          },
          location,
          reports: [],
          evidence: [],
          completion_requirements: { missing: [] },
        },
      });
      return true;
    }
    if (path === `/staff/work-orders/${workId}/reports`) {
      await route.fulfill({ json: envelope([]) });
      return true;
    }
  });
  await page.goto("/#map");
  await page.getByLabel("包含所有撤除紀錄").check();
  await expect.poll(() => allRemoved).toBe(true);
  await expect(
    page.locator(".location-row").filter({ hasText: "API 未知桶" }),
  ).toContainText("已撤除");
  await page.locator(".location-row").filter({ hasText: "API 未知桶" }).click();
  await expect(
    page.getByRole("link", { name: "回報問題", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("暫不能回報：已撤除")).toBeVisible();
  await page
    .getByRole("link", { name: "尋找可用桶並導航", exact: true })
    .click();
  await expect(page.getByText("目前沒有其他可用桶")).toBeVisible();
  await login(page, "staff", `staff/tasks/${workId}`);
  await expect(
    page.getByText("桶已撤除，工單操作受阻擋；未自動結案。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認到場", exact: true }),
  ).toBeDisabled();
});
