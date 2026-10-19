import { test, expect } from "@playwright/test";
import { apiFixture, binId, envelope, location } from "./api-fixtures";

test("map reads every page, keeps unknown status and opens server history", async ({
  page,
}) => {
  await apiFixture(page, async (route, path) => {
    if (path === "/map/locations") {
      const offset = Number(
        new URL(route.request().url()).searchParams.get("offset"),
      );
      await route.fulfill({
        json: offset
          ? envelope(
              [
                {
                  ...location,
                  id: "10000000-0000-4000-8000-000000000002",
                  label: "第二頁的桶",
                },
              ],
              offset,
              101,
            )
          : envelope(
              Array.from({ length: 100 }, (_, i) => ({
                ...location,
                id: i
                  ? `10000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`
                  : binId,
                label: i ? `桶 ${i}` : location.label,
              })),
              0,
              101,
            ),
      });
      return true;
    }
    if (path.endsWith("/history")) {
      await route.fulfill({
        json: [
          {
            id: "reading",
            recorded_at: "2026-01-05T08:00:00Z",
            fill_level_pct: 42,
            event_type: "measurement",
            source_type: "simulated",
            generation: 0,
          },
        ],
      });
      return true;
    }
  });
  await page.goto("/");
  await expect(page.locator(".location-row")).toHaveCount(101);
  await expect(page.getByText("第二頁的桶", { exact: true })).toBeVisible();
  await page.locator(".location-row").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "API 未知桶",
  );
  // 後端 unknown 在前端三態顯示為「失聯」。
  await expect(page.getByText("失聯", { exact: true })).toBeVisible();
  await expect(page.getByText("42% · measurement · simulated")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "導航過去", exact: true }),
  ).toHaveCount(0);
  await page.getByText("來源與位置精度", { exact: true }).click();
  await expect(
    page.getByText("existing_bins_all_taipei.csv", { exact: false }),
  ).toBeVisible();
});

test("search cancels stale results and API failure never restores local demo data", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((r) => {
    release = r;
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "binsoon-demo-1019-v3",
      '{"loggedIn":true,"availablePoints":999}',
    ),
  );
  await apiFixture(page, async (route, path) => {
    if (path !== "/map/locations") return;
    const q = new URL(route.request().url()).searchParams.get("q");
    if (q === "舊") {
      await pending;
      await route
        .fulfill({ json: envelope([{ ...location, label: "過期搜尋" }]) })
        .catch(() => {});
      return true;
    }
    if (q === "錯誤") {
      await route.fulfill({
        status: 503,
        json: {
          detail: {
            code: "UNAVAILABLE",
            message: "暫時無法載入地圖",
            fields: [],
          },
        },
      });
      return true;
    }
    if (q === "新") {
      await route.fulfill({
        json: envelope([{ ...location, label: "最新搜尋" }]),
      });
      return true;
    }
  });
  await page.goto("/");
  await expect(page.locator(".location-row")).toHaveCount(1);
  await page.getByRole("searchbox").fill("舊");
  await page.getByRole("searchbox").fill("新");
  await expect(page.locator(".location-row")).toContainText("最新搜尋");
  release();
  await expect(page.getByText("過期搜尋", { exact: true })).toHaveCount(0);
  await page.getByRole("searchbox").fill("錯誤");
  await expect(page.getByRole("alert")).toContainText("暫時無法載入地圖");
  await expect(page.locator(".location-row")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("binsoon-demo-1019-v3")),
  ).toBe('{"loggedIn":true,"availablePoints":999}');
  await expect(
    page.getByRole("link", { name: "登入", exact: true }),
  ).toBeVisible();
});

test("place precision and proposed lifecycle are preserved with API filters", async ({
  page,
}) => {
  await apiFixture(page, async (route, path) => {
    if (path !== "/map/locations") return;
    const params = new URL(route.request().url()).searchParams;
    const proposed = {
      ...location,
      label: "待現勘提案桶",
      bin_type: "proposed",
      placement_status: "proposed",
    };
    const place = {
      ...location,
      id: "place-uuid",
      label: "場所代表點測試",
      kind: "place",
      bin_status: null,
      reported_count: 12,
      location_precision: "representative_point_only",
      source_file: "daan_hotspot_gap_screening.csv",
      bin_type: null,
      placement_status: null,
    };
    await route.fulfill({
      json: envelope(
        params.get("kind") === "place"
          ? [place]
          : params.get("include_proposed") === "true"
            ? [proposed]
            : [location],
      ),
    });
    return true;
  });
  await page.goto("/");
  await expect(page.locator("#district option")).toHaveCount(13);
  await page.getByLabel("包含建議點／待現勘").check();
  await expect(page.locator(".location-row")).toContainText("尚未設置");
  await page.getByRole("button", { name: "場所代表點", exact: true }).click();
  await page.locator(".location-row").click();
  await expect(page.getByRole("region", { name: "位置詳情" })).toContainText(
    "並非個別清潔箱位置",
  );
  await expect(page.getByRole("region", { name: "位置詳情" })).toContainText(
    "周邊 12 處",
  );
  await expect(
    page.getByRole("link", { name: "回報問題", exact: true }),
  ).toHaveCount(0);
});

test("history reads full bare-array pagination and navigation respects server usability", async ({
  page,
}) => {
  await apiFixture(page, async (route, path) => {
    if (path.endsWith("/history")) {
      const offset = Number(
        new URL(route.request().url()).searchParams.get("offset"),
      );
      await route.fulfill({
        json: offset
          ? [
              {
                id: "last-reading",
                recorded_at: "2026-01-06T08:00:00Z",
                fill_level_pct: 99,
                event_type: "collection",
                source_type: "simulated",
                generation: 1,
              },
            ]
          : Array.from({ length: 100 }, (_, i) => ({
              id: `r${i}`,
              recorded_at: "2026-01-05T08:00:00Z",
              fill_level_pct: 42,
              event_type: "measurement",
              source_type: "simulated",
              generation: 0,
            })),
      });
      return true;
    }
    if (path === "/map/nearest-usable") {
      await route.fulfill({
        json: {
          items: [
            {
              ...location,
              id: "10000000-0000-4000-8000-000000000003",
              label: "後端替代桶",
              bin_status: {
                ...location.bin_status,
                fill_level_pct: 12,
                fill_status: "hungry",
                is_usable: true,
              },
            },
          ],
        },
      });
      return true;
    }
  });
  await page.goto(`/#bin/${binId}`);
  await expect(page.locator(".api-history li")).toHaveCount(101);
  await expect(
    page.getByText("99% · collection · simulated", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "尋找可用桶並導航", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "後端替代桶" })).toBeVisible();
  await expect(page.locator(".demo-route")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "抵達後回報" })).toHaveAttribute(
    "href",
    "#report/10000000-0000-4000-8000-000000000003",
  );
});

test("a refresh failure preserves the last complete map and marks it stale", async ({
  page,
}) => {
  let fail = false;
  let recovering = false;
  let recoveryStarted = false;
  let release!: () => void;
  const recovery = new Promise<void>((resolve) => {
    release = resolve;
  });
  await apiFixture(page, async (route, path) => {
    if (path === "/map/locations" && fail) {
      await route.fulfill({
        status: 503,
        json: {
          detail: { code: "UNAVAILABLE", message: "刷新地圖失敗", fields: [] },
        },
      });
      return true;
    }
    if (path === "/map/locations" && recovering) {
      recoveryStarted = true;
      await recovery;
    }
  });
  await page.goto("/");
  await expect(page.locator(".location-row")).toHaveCount(1);
  fail = true;
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.getByRole("alert")).toContainText("刷新地圖失敗");
  await expect(page.locator(".location-row")).toHaveCount(1);
  await expect(
    page.getByText("先前讀取的資料可能已過期，請重新載入確認。", {
      exact: true,
    }),
  ).toBeVisible();
  fail = false;
  recovering = true;
  await page.getByRole("button", { name: "重新載入", exact: true }).click();
  await expect.poll(() => recoveryStarted).toBe(true);
  await expect(
    page.getByText("先前讀取的資料可能已過期，請重新載入確認。", {
      exact: true,
    }),
  ).toBeVisible();
  release();
  await expect(
    page.getByText("先前讀取的資料可能已過期，請重新載入確認。", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("two waste compartments map to three states, recycling-only navigation and the hungry filter", async ({
  page,
}) => {
  const slot = (
    waste_type: "general" | "recycling",
    fill_level_pct: number | null,
    fill_status: string,
  ) => ({
    ...location.bin_status,
    waste_type,
    classification_source: "demo_assumption",
    fill_level_pct,
    fill_status,
    is_usable: fill_status === "hungry" || fill_status === "half",
    unavailable_reasons:
      fill_status === "full"
        ? ["full"]
        : fill_status === "unknown"
          ? ["unknown"]
          : [],
  });
  const oneLeft = {
    ...location,
    label: "一般滿回收餓",
    bin_status: slot("general", 92, "full"),
    compartments: [slot("general", 92, "full"), slot("recycling", 60, "half")],
  };
  const bothFull = {
    ...location,
    id: "10000000-0000-4000-8000-000000000009",
    label: "兩桶都滿",
    bin_status: slot("general", 95, "full"),
    compartments: [slot("general", 95, "full"), slot("recycling", 88, "full")],
  };
  const views: string[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/map/locations") {
      await route.fulfill({ json: envelope([oneLeft, bothFull]) });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      views.push(new URL(route.request().url()).search);
      await route.fulfill({
        json: {
          location: oneLeft,
          status: oneLeft.bin_status,
          compartments: oneLeft.compartments,
          adopter: null,
          latest_cleanup: null,
          my_adoption_id: null,
          can_apply_adoption: false,
          can_report: false,
          report_block_reason: "login_required",
        },
      });
      return true;
    }
  });
  await page.goto("/");
  const rows = page.locator(".location-row");
  await expect(rows).toHaveCount(2);
  // 後端 half 在前端是「餓了」；只要一桶能丟，點位整體就是餓了。
  await expect(rows.first()).toContainText("餓了 · 1/2 桶能丟");
  await expect(rows.nth(1)).toContainText("吃飽了 · 0/2 桶能丟");
  await page.getByRole("button", { name: "餓了的桶", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("一般滿回收餓");
  await rows.first().click();
  await expect(page.getByText("資源回收還能丟", { exact: true })).toBeVisible();
  await expect(page.getByText("吃飽了 · 92%", { exact: true })).toBeVisible();
  await expect(page.getByText("餓了 · 60%", { exact: true })).toBeVisible();
  const go = page.getByRole("link", { name: "導航過去丟回收", exact: true });
  await expect(go).toHaveAttribute(
    "href",
    `#nav/${binId}?waste_type=recycling`,
  );
  await go.click();
  await expect(
    page.getByText("本次要丟：資源回收。", { exact: true }),
  ).toBeVisible();
  expect(views.at(-1)).toBe("?waste_type=recycling");
});
