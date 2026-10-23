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
// 地圖瀏覽：在看得到的地圖區（手機為抽屜上方）找一個離標記與控制項都遠的空白點。
export async function emptyMapPoint(page: Page) {
  const point = await page.evaluate(() => {
    const map = document
      .querySelector(".mx-map .leaflet-container")!
      .getBoundingClientRect();
    const panel = document.querySelector(".mx-panel")!.getBoundingClientRect();
    // 手機抽屜蓋在地圖下半部；桌面面板在地圖左邊，不重疊。
    const bottom = panel.right > map.left + 1 ? panel.top : map.bottom;
    const busy = [
      ...document.querySelectorAll(
        ".leaflet-marker-icon, .leaflet-control, .mx-home-toolbar",
      ),
    ].map((el) => el.getBoundingClientRect());
    for (let y = map.top + 40; y < bottom - 40; y += 24)
      for (let x = map.left + 40; x < map.right - 40; x += 24) {
        const near = busy.some(
          (r) =>
            x > r.left - 40 &&
            x < r.right + 40 &&
            y > r.top - 40 &&
            y < r.bottom + 40,
        );
        const hit = document.elementFromPoint(x, y);
        if (!near && hit?.closest(".leaflet-container")) return { x, y };
      }
    return null;
  });
  expect(point, "找不到可點的地圖空白處").not.toBeNull();
  return point!;
}
// 點地圖空白處關閉桶／地標詳情（取代原本的「← 返回清單」連結）；有觸控就用觸控點擊。
export async function tapEmptyMap(page: Page) {
  const { x, y } = await emptyMapPoint(page);
  if (await page.evaluate(() => "ontouchstart" in window))
    await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "list");
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
  options: { demo?: boolean } = {},
) {
  await page.addInitScript(
    (demo) =>
      sessionStorage.setItem("binsoon-data-mode", demo ? "demo" : "backend"),
    Boolean(options.demo),
  );
  // No live public routing calls during API tests; route-specific tests override this.
  await page.route("https://valhalla1.openstreetmap.de/route", (route) =>
    route.abort(),
  );
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
    else if (path.endsWith("/monthly-summary"))
      data = {
        adoption_id: path.split("/")[2],
        month: url.searchParams.get("month"),
        timezone: "Asia/Taipei",
        reports_submitted: 0,
        reports_approved: 0,
        points_awarded: 0,
        is_partial_month: false,
        source_type: "demo",
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
  // Same-document role switches can still display the previous session's logout
  // button. Wait for the authenticated return navigation before inspecting it.
  await expect(page).not.toHaveURL(/#(?:staff\/|admin\/)?login(?:\?|$)/);
  await expectSignedIn(page);
}
// M flow：帳號在共用頂欄，三分頁在桌面頂部／手機底部。
export async function expectSignedIn(page: Page) {
  await expect(
    page.getByRole("button", { name: "登出", exact: true }),
  ).toBeVisible();
}
export async function navLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "主要分頁" }).getByRole("link", {
    name: name === "會員中心" ? "我的" : name === "找垃圾桶" ? "地圖" : name,
    exact: true,
  });
}
export async function logoutButton(page: Page) {
  return page.getByRole("button", { name: "登出", exact: true });
}
export async function expectAccountName(page: Page, name: string) {
  await expect(
    page.getByRole("banner").getByText(name, { exact: true }),
  ).toHaveText(name);
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
