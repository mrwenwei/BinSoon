import { expect, type Page, type Route } from "@playwright/test";

export const binId = "10000000-0000-4000-8000-000000000001";
export const reportId = "20000000-0000-4000-8000-000000000001";
export const workId = "30000000-0000-4000-8000-000000000001";
export const eventId = "40000000-0000-4000-8000-000000000001";
export const status = {
  waste_type: "general",
  classification_source: "legacy_assumed_general",
  fill_level_pct: null,
  fill_status: "unknown",
  is_usable: false,
  operational_status: "normal",
  unavailable_reasons: ["unknown"],
  is_new: false,
  installed_at: null,
  removed_at: null,
  reading_source_type: "simulated",
  observed_at: null,
  received_at: null,
  last_emptied_at: null,
  capacity_liters: 120,
  estimated_used_liters: null,
  risk_priority: null,
  estimated_hours_to_90_pct: null,
};
export const location = {
  id: binId,
  kind: "bin",
  district: "大安區",
  label: "API 未知桶",
  address: "信義路",
  longitude: 121.5358,
  latitude: 25.033,
  note: "",
  source_type: "existing_bin",
  source_row: 1,
  source_file: "existing_bins_all_taipei.csv",
  location_precision: "point_as_published",
  reported_count: null,
  bin_type: "existing",
  placement_status: "existing",
  distance_m: 20,
  walking_estimate_seconds: 30,
  bin_status: status,
  compartments: [
    status,
    {
      ...status,
      waste_type: "recycling",
      classification_source: "demo_assumption",
    },
  ],
};
export function envelope(items: unknown[], offset = 0, total = items.length) {
  return { items, page: { limit: 100, offset, total } };
}
export function user(role = "citizen") {
  return {
    id: `${role}-uuid`,
    display_name: `測試${role}`,
    roles: [role],
    districts: role === "staff" ? ["大安區"] : [],
    auth_source: "demo",
  };
}
export async function apiFixture(
  page: Page,
  override?: (route: Route, path: string) => Promise<boolean | void>,
) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (await override?.(route, path)) return;
    const token = route.request().headers().authorization || "";
    const role = token.includes("staff")
      ? "staff"
      : token.includes("admin")
        ? "admin"
        : "citizen";
    let data: unknown;
    if (path === "/auth/demo/login") {
      const account = route.request().postDataJSON().account;
      const r = account.replace("demo-", "");
      data = {
        access_token: `fixture-${r}`,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        token_type: "bearer",
        user: user(r),
      };
    } else if (path === "/auth/session") {
      await route.fulfill({ status: 204 });
      return;
    } else if (path === "/me") data = user(role);
    else if (path === "/map/locations") data = envelope([location]);
    else if (path === "/map/nearest-usable") data = { items: [] };
    else if (path === `/bins/${binId}/view`)
      data = {
        location,
        status,
        adopter: null,
        latest_cleanup: null,
        my_adoption_id: null,
        can_apply_adoption: false,
        can_report: Boolean(token) && role === "citizen",
        report_block_reason: token ? null : "login_required",
      };
    else if (path.endsWith("/access"))
      data = {
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMwTnMBAAGtAN6NqpJ+AAAAAElFTkSuQmCC",
        expires_at: new Date(Date.now() + 300000).toISOString(),
      };
    else if (path.endsWith("/history")) data = [];
    else if (path === "/me/membership")
      data = {
        cumulative_points: 0,
        available_points: 0,
        pending_points: 0,
        approved_report_count: 0,
        rejected_report_count: 0,
        reporting_suspended: false,
        current_tier: { code: "beginner", name: "見習生", threshold: 0 },
        next_tier: { code: "new", name: "新手", threshold: 10 },
        points_to_next_tier: 10,
      };
    else if (
      path === "/me/reports" ||
      path === "/me/point-entries" ||
      path === "/staff/work-orders"
    )
      data = envelope([]);
    else {
      await route.fulfill({
        status: 404,
        json: {
          detail: { code: "NOT_FOUND", message: "找不到資料", fields: [] },
        },
      });
      return;
    }
    await route.fulfill({ json: data });
  });
}
export async function login(page: Page, role = "citizen", next = "map") {
  await page.goto(
    `/#${role === "citizen" ? "login" : `${role}/login`}?next=${encodeURIComponent(next)}`,
  );
  await page.getByLabel("帳號", { exact: true }).fill(`demo-${role}`);
  await page
    .getByLabel("密碼", { exact: true })
    .fill("fixture-only-not-a-real-password");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expectSignedIn(page);
}
// 手機版頂欄只有「地圖｜要桶投票」與點數按鈕，其他入口與帳號都在左側漢堡選單。
export async function isCompactNav(page: Page) {
  return !(await page.locator(".desktop-nav").isVisible());
}
export async function openMenu(page: Page) {
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
export async function closeMenu(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
}
// 確認登入成功：桌面在頂欄看到登出；手機打開側邊欄看到登出後再用 Esc 關閉。
export async function expectSignedIn(page: Page) {
  if (await isCompactNav(page)) {
    await expect(page.locator(".topbar-right")).not.toContainText("登入");
    await openMenu(page);
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "登出", exact: true }),
    ).toBeVisible();
    await closeMenu(page);
  } else
    await expect(
      page.getByRole("button", { name: "登出", exact: true }),
    ).toBeVisible();
}
// 點選頂欄或側邊欄的入口（手機需先打開側邊欄）。
export async function navLink(page: Page, name: string) {
  if (await isCompactNav(page)) {
    await openMenu(page);
    return page.getByRole("dialog").getByRole("link", { name, exact: true });
  }
  return page
    .getByRole("navigation", { name: "主選單" })
    .getByRole("link", { name, exact: true });
}
export async function logoutButton(page: Page) {
  if (await isCompactNav(page)) await openMenu(page);
  return page.getByRole("button", { name: "登出", exact: true });
}
export async function expectAccountName(page: Page, name: string) {
  if (await isCompactNav(page)) {
    await openMenu(page);
    await expect(
      page.getByRole("dialog").getByText(name, { exact: true }),
    ).toBeVisible();
    await closeMenu(page);
  } else
    await expect(
      page.getByRole("banner").getByText(name, { exact: true }),
    ).toBeVisible();
}

export const report = {
  waste_type: "general",
  classification_source: "legacy_assumed_general",
  id: reportId,
  bin_id: binId,
  event_id: eventId,
  work_order_id: workId,
  type: "full",
  description: "",
  photo_ids: ["50000000-0000-4000-8000-000000000001"],
  status: "pending",
  work_status: "pending",
  assignment_status: "assigned",
  event_status: "open",
  first_reporter: false,
  adopter: false,
  quick: false,
  pending_points: 0,
  awarded_points: 0,
  rejection_reason: null,
  created_at: "2026-10-19T08:00:00Z",
  accepted_at: null,
  reviewed_at: null,
  settled_at: null,
};

export const arrivedWork = {
  waste_type: "general",
  classification_source: "legacy_assumed_general",
  id: workId,
  bin_id: binId,
  event_id: eventId,
  type: "full",
  status: "arrived",
  version: 3,
  district: "大安區",
  source: "citizen",
  priority: "high",
  assigned_staff_id: "staff-uuid",
  created_at: report.created_at,
  accepted_at: report.created_at,
  arrived_at: report.created_at,
  target_at: null,
  is_overdue: false,
  reason: null,
  blocked_by_removed_bin: false,
};
