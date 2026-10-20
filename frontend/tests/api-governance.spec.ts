import { test, expect } from "@playwright/test";
import {
  apiFixture,
  envelope,
  login,
  binId,
  location,
  status,
} from "./api-fixtures";
import { proposal, proposalId } from "./api-engagement-fixture";

test("admin reviews only legal proposal stages with current ETags and the citizen sees the same installed Bin", async ({
  page,
}) => {
  let item = {
    ...proposal,
    status: "village",
    version: 2,
    mine: false,
    voting_closed_at: "2026-10-20T02:00:00Z",
  };
  const actions: string[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/map/locations") {
      await route.fulfill({
        json: envelope([
          {
            ...location,
            bin_type: "proposed",
            placement_status:
              item.status === "installed" ? "installed" : "proposed",
          },
        ]),
      });
      return true;
    }
    if (path === "/map/availability") {
      await route.fulfill({
        json: {
          radius_m: 300,
          has_existing_bin_within_radius: true,
          nearest_installed_bin: {
            ...location,
            bin_type: "proposed",
            placement_status: "installed",
          },
          bins: [
            {
              ...location,
              bin_type: "proposed",
              placement_status: "installed",
            },
          ],
          proposals: [],
        },
      });
      return true;
    }
    if (path === "/proposals") {
      await route.fulfill({ json: envelope([item]) });
      return true;
    }
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({
        headers: { ETag: `"v${item.version}"` },
        json: item,
      });
      return true;
    }
    if (path === `/admin/proposals/${proposalId}/review`) {
      expect(route.request().headers().authorization).toBe(
        "Bearer fixture-admin",
      );
      expect(route.request().headers()["if-match"]).toBe(`"v${item.version}"`);
      const action = route.request().postDataJSON().action;
      actions.push(action);
      item = {
        ...item,
        version: item.version + 1,
        status:
          action === "village_approve"
            ? "evaluation"
            : action === "evaluation_approve"
              ? "survey"
              : "installed",
      };
      await route.fulfill({
        headers: { ETag: `"v${item.version}"` },
        json: item,
      });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location: {
            ...location,
            bin_type: "proposed",
            placement_status: "installed",
          },
          status,
          compartments: [],
          adopter: null,
          can_report: false,
          latest_cleanup: null,
          my_adoption_id: null,
          can_apply_adoption: false,
        },
      });
      return true;
    }
  });
  await login(page, "admin", "admin/proposals");
  await page.getByRole("link", { name: "審查此提案", exact: true }).click();
  for (const label of ["通過里辦評議", "通過評估", "確認示範設置"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("button", { name: "確認送出", exact: true }).click();
  }
  expect(actions).toEqual([
    "village_approve",
    "evaluation_approve",
    "survey_approve",
  ]);
  await expect(
    page.getByText("示範設置 · DEMO · 大安區", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "拒絕提案", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "查看關聯 Bin", exact: true }).click();
  await expect(
    page.getByText("大安區 · 示範設置", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = "map";
  });
  await expect(page.locator(".location-row")).toContainText(
    "新增提案 · DEMO 示範設置，非現場驗收",
  );
  await login(page, "citizen", "vote/create");
  await page.getByLabel("緯度", { exact: true }).fill("25.033");
  await page.getByLabel("經度", { exact: true }).fill("121.5358");
  await page.getByRole("button", { name: "查詢周邊位置" }).click();
  await expect(
    page.getByText("新增提案 · DEMO 示範設置，非現場驗收", { exact: true }),
  ).toBeVisible();
});

test("proposal unknown response retains key and ETag; conflict requires new explicit confirmation", async ({
  page,
}) => {
  let version = 2;
  let phase = "village";
  const attempts: { key: string; etag: string; body: unknown }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({
        headers: { ETag: `"v${version}"` },
        json: { ...proposal, status: phase, version },
      });
      return true;
    }
    if (path === `/admin/proposals/${proposalId}/review`) {
      attempts.push({
        key: route.request().headers()["idempotency-key"],
        etag: route.request().headers()["if-match"],
        body: route.request().postDataJSON(),
      });
      if (attempts.length === 1) await route.abort("failed");
      else if (attempts.length === 2) {
        version = 3;
        await route.fulfill({
          status: 412,
          json: { detail: { code: "VERSION_CONFLICT", message: "版本衝突" } },
        });
      } else {
        version = 4;
        phase = "evaluation";
        await route.fulfill({
          headers: { ETag: '"v4"' },
          json: { ...proposal, status: phase, version },
        });
      }
      return true;
    }
  });
  await login(page, "admin", `admin/proposals/${proposalId}`);
  await page.getByRole("button", { name: "通過里辦評議", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("版本衝突");
  expect(attempts).toHaveLength(2);
  await page
    .getByRole("button", { name: "確認目前版本並重試", exact: true })
    .click();
  await expect(
    page.getByText("評估中 · DEMO · 大安區", { exact: true }),
  ).toBeVisible();
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[2].key).not.toBe(attempts[0].key);
  expect(attempts[2].etag).toBe('"v3"');
});

for (const phase of ["village", "evaluation", "survey"]) {
  test(`admin decline ${phase} requires a reason and never skips a stage`, async ({
    page,
  }) => {
    let declined = false;
    await apiFixture(page, async (route, path) => {
      if (path === `/proposals/${proposalId}`) {
        await route.fulfill({
          headers: { ETag: declined ? '"v3"' : '"v2"' },
          json: {
            ...proposal,
            status: declined ? "declined" : phase,
            version: declined ? 3 : 2,
            outcome_reason: declined ? "現場不適合" : null,
          },
        });
        return true;
      }
      if (path === `/admin/proposals/${proposalId}/review`) {
        expect(route.request().postDataJSON()).toEqual({
          action: "decline",
          reason: "現場不適合",
        });
        declined = true;
        await route.fulfill({
          json: {
            ...proposal,
            status: "declined",
            version: 3,
            outcome_reason: "現場不適合",
          },
        });
        return true;
      }
    });
    await login(page, "admin", `admin/proposals/${proposalId}`);
    await expect(
      page.getByRole("button", { name: "拒絕提案", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("審查原因", { exact: true }).fill("現場不適合");
    await page.getByRole("button", { name: "拒絕提案", exact: true }).click();
    await page.getByRole("button", { name: "確認送出", exact: true }).click();
    await expect(
      page.getByText("結果原因：現場不適合", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "確認示範設置", exact: true }),
    ).toHaveCount(0);
  });
}

test("owner requests, admin returns, owner resubmits, admin approves without replacing original or adopter names", async ({
  page,
}) => {
  let item = {
    ...proposal,
    status: "installed",
    version: 3,
    approved_name: "原核准桶名",
    pending_name: null as string | null,
    name_status: null as string | null,
  };
  await apiFixture(page, async (route, path) => {
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({
        headers: { ETag: `"v${item.version}"` },
        json: {
          ...item,
          mine: route.request().headers().authorization?.includes("citizen"),
        },
      });
      return true;
    }
    if (path === `/proposals/${proposalId}/name-requests`) {
      expect(route.request().headers()["if-match"]).toBe(`"v${item.version}"`);
      item = {
        ...item,
        version: item.version + 1,
        pending_name: route.request().postDataJSON().name,
        name_status: "pending",
      };
      await route.fulfill({ json: item });
      return true;
    }
    if (path === `/admin/proposals/${proposalId}/name-review`) {
      expect(route.request().headers()["if-match"]).toBe(`"v${item.version}"`);
      const body = route.request().postDataJSON();
      if (!body.approve) expect(body.reason).toBe("請改用較短名稱");
      item = {
        ...item,
        version: item.version + 1,
        name_status: body.approve ? "approved" : "returned",
        approved_name: body.approve ? item.pending_name! : item.approved_name,
      };
      await route.fulfill({ json: item });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location: {
            ...location,
            label: item.approved_name,
            placement_status: "installed",
            bin_type: "proposed",
          },
          status,
          compartments: [],
          adopter: { display_name: "認養公開名" },
          can_report: false,
          latest_cleanup: null,
          can_apply_adoption: false,
          my_adoption_id: null,
        },
      });
      return true;
    }
  });
  await login(page, "citizen", `proposals/${proposalId}`);
  await page.getByLabel("申請桶名", { exact: true }).fill("新申請名字");
  await page.getByRole("button", { name: "送出命名申請", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("已核准桶名：原核准桶名", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("申請桶名", { exact: true })).toHaveCount(0);
  await login(page, "admin", `admin/proposals/${proposalId}`);
  await expect(
    page.getByRole("button", { name: "退回命名", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("命名退回原因", { exact: true }).fill("請改用較短名稱");
  await page.getByRole("button", { name: "退回命名", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("命名狀態：已退回，可重新申請", { exact: true }),
  ).toBeVisible();
  await login(page, "citizen", `proposals/${proposalId}`);
  await page.getByLabel("申請桶名", { exact: true }).fill("新桶名");
  await page.getByRole("button", { name: "送出命名申請", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("命名狀態：待審核", { exact: true }),
  ).toBeVisible();
  await login(page, "admin", `admin/proposals/${proposalId}`);
  await page.getByRole("button", { name: "核准桶名", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("已核准桶名：新桶名", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`原提案名稱：${proposal.name}`, { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "查看關聯 Bin", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "新桶名", level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/認養：認養公開名/)).toBeVisible();
});

test("only original citizen on installed without pending can request a name; roles cannot borrow admin review", async ({
  page,
}) => {
  let mine = false,
    phase = "installed",
    naming: string | null = null;
  await apiFixture(page, async (route, path) => {
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({
        headers: { ETag: '"v1"' },
        json: { ...proposal, mine, status: phase, name_status: naming },
      });
      return true;
    }
  });
  await login(page, "citizen", `proposals/${proposalId}`);
  await expect(page.getByLabel("申請桶名", { exact: true })).toHaveCount(0);
  mine = true;
  phase = "survey";
  await page.reload();
  await expect(page.getByLabel("申請桶名", { exact: true })).toHaveCount(0);
  await login(page, "citizen", `proposals/${proposalId}`);
  await expect(page.getByLabel("申請桶名", { exact: true })).toHaveCount(0);
  phase = "installed";
  naming = "pending";
  await page.reload();
  await login(page, "citizen", `proposals/${proposalId}`);
  await expect(page.getByLabel("申請桶名", { exact: true })).toHaveCount(0);
  await page.evaluate((id) => {
    location.hash = `admin/proposals/${id}`;
  }, proposalId);
  await expect(
    page.getByRole("heading", { name: "請以管理員身份登入" }),
  ).toBeVisible();
});

test("name review conflict cannot approve a different concurrent name", async ({
  page,
}) => {
  let version = 1,
    currentName = "舊待審名稱",
    calls = 0;
  await apiFixture(page, async (route, path) => {
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({
        headers: { ETag: `"v${version}"` },
        json: {
          ...proposal,
          version,
          status: "installed",
          name_status: "pending",
          pending_name: currentName,
        },
      });
      return true;
    }
    if (path === `/admin/proposals/${proposalId}/name-review`) {
      calls++;
      version++;
      currentName = "另一個新申請";
      await route.fulfill({
        status: 412,
        json: {
          detail: { code: "VERSION_CONFLICT", message: "已有其他命名操作" },
        },
      });
      return true;
    }
  });
  await login(page, "admin", `admin/proposals/${proposalId}`);
  await page.getByRole("button", { name: "核准桶名", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("申請名稱：另一個新申請", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認目前版本並重試", exact: true }),
  ).toBeDisabled();
  expect(calls).toBe(1);
});

test("name request retains original parameters across expired session and competing pending request", async ({
  page,
}) => {
  const attempts: { key: string; etag: string; body: unknown }[] = [];
  let pending = false;
  await apiFixture(page, async (route, path) => {
    if (path === `/proposals/${proposalId}`) {
      await route.fulfill({
        headers: { ETag: pending ? '"v2"' : '"v1"' },
        json: {
          ...proposal,
          status: "installed",
          name_status: pending ? "pending" : null,
          pending_name: pending ? "原申請名" : null,
          version: pending ? 2 : 1,
        },
      });
      return true;
    }
    if (path === `/proposals/${proposalId}/name-requests`) {
      attempts.push({
        key: route.request().headers()["idempotency-key"],
        etag: route.request().headers()["if-match"],
        body: route.request().postDataJSON(),
      });
      if (attempts.length === 1) {
        pending = true;
        await route.fulfill({
          status: 401,
          json: { detail: { code: "SESSION_EXPIRED", message: "請重新登入" } },
        });
      } else
        await route.fulfill({
          json: {
            ...proposal,
            status: "installed",
            name_status: "pending",
            pending_name: "原申請名",
            version: 2,
          },
        });
      return true;
    }
  });
  await login(page, "citizen", `proposals/${proposalId}`);
  await page.getByLabel("申請桶名", { exact: true }).fill("原申請名");
  await page.getByRole("button", { name: "送出命名申請", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "登入已失效" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "登入參與投票", exact: true }).click();
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(
    page.getByText("命名狀態：待審核", { exact: true }),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
});
