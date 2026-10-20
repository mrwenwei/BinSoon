import { test, expect } from "@playwright/test";
import {
  apiFixture,
  envelope,
  login,
  binId,
  location,
  status,
} from "./api-fixtures";
import { adoption, adoptionId } from "./api-adoption-fixture";

test("citizen applies using BinView permission and active owner explicitly patches all false preferences then ends", async ({
  page,
}) => {
  let item = { ...adoption };
  let applied = false;
  const calls: { method: string; body: unknown }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location,
          status,
          compartments: [],
          can_apply_adoption: !applied,
          my_adoption_id: applied ? adoptionId : null,
          adopter:
            item.status === "active"
              ? {
                  display_name: item.display_name,
                  role: item.role,
                  intro: item.intro,
                }
              : null,
          latest_cleanup: null,
          can_report: false,
          report_block_reason: null,
        },
      });
      return true;
    }
    if (path === "/adoptions") {
      const body = route.request().postDataJSON();
      expect(body).toEqual({
        bin_id: binId,
        role: "居民",
        display_name: "認養公開名",
        intro: "",
        preferences: { full: true, dumping: true, dirty: true },
      });
      applied = true;
      await route.fulfill({ status: 201, json: item });
      return true;
    }
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({
        headers: { ETag: `"v${item.version}"` },
        json: item,
      });
      return true;
    }
    if (
      path === `/adoptions/${adoptionId}/preferences` ||
      path === `/adoptions/${adoptionId}/end`
    ) {
      expect(route.request().headers()["if-match"]).toBe(`"v${item.version}"`);
      const body = route.request().postDataJSON();
      calls.push({ method: route.request().method(), body });
      item = {
        ...item,
        version: item.version + 1,
        ...(path.endsWith("/end")
          ? {
              status: "ended",
              preferences: { full: false, dumping: false, dirty: false },
            }
          : { preferences: body }),
      };
      await route.fulfill({
        headers: { ETag: `"v${item.version}"` },
        json: item,
      });
      return true;
    }
    if (path === "/me/adoptions") {
      await route.fulfill({ json: envelope([item]) });
      return true;
    }
  });
  await login(page, "citizen", `adopt/apply/${binId}`);
  await expect(
    page.getByRole("heading", { name: "申請認養", exact: true }),
  ).toBeVisible();
  await page.getByLabel("公開名稱", { exact: true }).fill("認養公開名");
  await page.getByRole("button", { name: "預覽認養申請", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("申請已送出，待審期間尚無認養權益。", { exact: true }),
  ).toBeVisible();
  item = { ...item, status: "active", version: 2 };
  await page.getByRole("link", { name: "查看我的認養", exact: true }).click();
  for (const label of ["滿桶通知", "桶旁堆放通知", "髒污通知"])
    await page.getByLabel(label, { exact: true }).uncheck();
  await page.getByRole("button", { name: "預覽更新偏好", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("目前通知：滿桶 關閉、堆放 關閉、髒污 關閉", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "結束認養", exact: true }).click();
  await expect(
    page.getByText(
      "結束後關閉通知偏好，新回報不再具有本次認養加倍資格；歷史保留。",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("認養狀態：已結束", { exact: true }),
  ).toBeVisible();
  expect(calls).toEqual([
    { method: "PATCH", body: { full: false, dumping: false, dirty: false } },
    { method: "POST", body: { reason: null } },
  ]);
});

for (const role of ["居民", "店家", "學校", "社區團體"]) {
  test(`${role} adoption sends complete preferences and non-store intro stays empty`, async ({
    page,
  }) => {
    await apiFixture(page, async (route, path) => {
      if (path === `/bins/${binId}/view`) {
        await route.fulfill({
          json: {
            location,
            status,
            can_apply_adoption: true,
            my_adoption_id: null,
            adopter: null,
            latest_cleanup: null,
          },
        });
        return true;
      }
      if (path === "/adoptions") {
        expect(route.request().postDataJSON()).toEqual({
          bin_id: binId,
          role,
          display_name: "公開名稱",
          intro: role === "店家" ? "店家介紹" : "",
          preferences: { full: true, dumping: true, dirty: true },
        });
        await route.fulfill({ status: 201, json: adoption });
        return true;
      }
    });
    await login(page, "citizen", `adopt/apply/${binId}`);
    await page.getByLabel("公開名稱", { exact: true }).fill("公開名稱");
    // A store introduction must not survive switching to a different role in the body.
    await page.getByLabel("認養身份", { exact: true }).selectOption("店家");
    await page.getByLabel("店家介紹", { exact: true }).fill("店家介紹");
    await page.getByLabel("認養身份", { exact: true }).selectOption(role);
    await page
      .getByRole("button", { name: "預覽認養申請", exact: true })
      .click();
    await page.getByRole("button", { name: "確認送出", exact: true }).click();
    await expect(
      page.getByText("申請已送出，待審期間尚無認養權益。", { exact: true }),
    ).toBeVisible();
  });
}

test("adoption permission comes from BinView and rejected duplicate application re-reads it", async ({
  page,
}) => {
  let allowed = false;
  let calls = 0;
  await apiFixture(page, async (route, path) => {
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location,
          status,
          can_apply_adoption: allowed,
          my_adoption_id: allowed ? null : adoptionId,
          adopter: null,
          latest_cleanup: null,
        },
      });
      return true;
    }
    if (path === "/adoptions") {
      calls++;
      allowed = false;
      await route.fulfill({
        status: 409,
        json: {
          detail: { code: "ADOPTION_CONFLICT", message: "已有待審或有效認養" },
        },
      });
      return true;
    }
  });
  await login(page, "citizen", `adopt/apply/${binId}`);
  await expect(
    page.getByRole("button", { name: "預覽認養申請", exact: true }),
  ).toHaveCount(0);
  allowed = true;
  await page.evaluate(() => {
    location.hash = "map";
  });
  await page.evaluate((id) => {
    location.hash = `adopt/apply/${id}`;
  }, binId);
  await page.getByLabel("公開名稱", { exact: true }).fill("競爭申請");
  await page.getByRole("button", { name: "預覽認養申請", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("已有待審或有效認養");
  await expect(
    page.getByRole("link", { name: "查看既有認養申請" }),
  ).toBeVisible();
  expect(calls).toBe(1);
});

test("admin pages pending adoptions, approves only the current version and rejects with a reason", async ({
  page,
}) => {
  let item = { ...adoption };
  const attempts: { key: string; etag: string }[] = [];
  await apiFixture(page, async (route, path) => {
    if (path === "/admin/adoptions") {
      const offset = Number(
        new URL(route.request().url()).searchParams.get("offset"),
      );
      await route.fulfill({
        json: { items: [item], page: { offset, limit: 20, total: 21 } },
      });
      return true;
    }
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({
        headers: { ETag: `"v${item.version}"` },
        json: item,
      });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location,
          status,
          adopter:
            item.status === "active"
              ? { display_name: item.display_name }
              : null,
        },
      });
      return true;
    }
    if (path === `/admin/adoptions/${adoptionId}/review`) {
      expect(route.request().headers().authorization).toBe(
        "Bearer fixture-admin",
      );
      attempts.push({
        key: route.request().headers()["idempotency-key"],
        etag: route.request().headers()["if-match"],
      });
      if (attempts.length === 1) {
        item.version = 2;
        await route.fulfill({
          status: 412,
          json: { detail: { code: "VERSION_CONFLICT", message: "版本已更新" } },
        });
      } else {
        const body = route.request().postDataJSON();
        item = {
          ...item,
          version: item.version + 1,
          status: body.decision,
          reason: body.reason || "",
        };
        await route.fulfill({ json: item });
      }
      return true;
    }
  });
  await login(page, "admin", "admin/adoptions");
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await expect(
    page.getByText("共 21 筆 · 第 2 頁", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "審核此認養", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "拒絕認養", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "核准認養", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await page
    .getByRole("button", { name: "確認目前版本並重試", exact: true })
    .click();
  await expect(
    page.getByText("認養狀態：認養中", { exact: true }),
  ).toBeVisible();
  expect(attempts[0].etag).toBe('"v1"');
  expect(attempts[1].etag).toBe('"v2"');
  expect(attempts[1].key).not.toBe(attempts[0].key);
  item = { ...adoption, version: 4 };
  await page.reload();
  await login(page, "admin", `admin/adoptions/${adoptionId}`);
  await page.getByLabel("認養審查原因", { exact: true }).fill("資料不足");
  await page.getByRole("button", { name: "拒絕認養", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(page.getByText("原因：資料不足", { exact: true })).toBeVisible();
});

test("approval competition re-reads public adopter and cannot silently re-approve", async ({
  page,
}) => {
  let occupied = false;
  let calls = 0;
  await apiFixture(page, async (route, path) => {
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({ headers: { ETag: '"v1"' }, json: adoption });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      await route.fulfill({
        json: {
          location,
          status,
          adopter: occupied ? { display_name: "另一位已核准者" } : null,
        },
      });
      return true;
    }
    if (path === `/admin/adoptions/${adoptionId}/review`) {
      calls++;
      occupied = true;
      await route.fulfill({
        status: 409,
        json: {
          detail: {
            code: "ADOPTION_CONFLICT",
            message: "此桶已被其他申請核准",
          },
        },
      });
      return true;
    }
  });
  await login(page, "admin", `admin/adoptions/${adoptionId}`);
  await page.getByRole("button", { name: "核准認養", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("目前公開認養：另一位已核准者", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認目前版本並重試", exact: true }),
  ).toBeDisabled();
  expect(calls).toBe(1);
});

test("owner withdraws pending and reads paginated server history; staff cannot read private adoption detail", async ({
  page,
}) => {
  let item = { ...adoption };
  await apiFixture(page, async (route, path) => {
    if (path === "/me/adoptions") {
      const offset = Number(
        new URL(route.request().url()).searchParams.get("offset"),
      );
      await route.fulfill({
        json: { items: [item], page: { offset, limit: 20, total: 21 } },
      });
      return true;
    }
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({
        headers: { ETag: `"v${item.version}"` },
        json: item,
      });
      return true;
    }
    if (path === `/adoptions/${adoptionId}/withdraw`) {
      expect(route.request().postDataJSON()).toEqual({});
      item = { ...item, status: "withdrawn", version: 2 };
      await route.fulfill({ json: item });
      return true;
    }
  });
  await login(page, "citizen", "adopt");
  await page.getByRole("button", { name: "下一頁", exact: true }).click();
  await page.getByRole("link", { name: "管理此認養", exact: true }).click();
  await page.getByRole("button", { name: "撤回申請", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("認養狀態：已撤回", { exact: true }),
  ).toBeVisible();
  await login(page, "citizen", `adopt/${adoptionId}`);
  await expect(
    page.getByText("認養狀態：已撤回", { exact: true }),
  ).toBeVisible();
  await login(page, "staff", "staff/tasks");
  await page.evaluate((id) => {
    location.hash = `adopt/${id}`;
  }, adoptionId);
  await expect(
    page.getByRole("heading", { name: "請以市民身份登入" }),
  ).toBeVisible();
});

test("expired unknown PATCH preferences replay original method body key and ETag after re-login", async ({
  page,
}) => {
  const attempts: {
    key: string;
    etag: string;
    method: string;
    body: unknown;
  }[] = [];
  let prefs = { ...adoption.preferences };
  await apiFixture(page, async (route, path) => {
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({
        headers: { ETag: '"v2"' },
        json: { ...adoption, status: "active", version: 2, preferences: prefs },
      });
      return true;
    }
    if (path === `/adoptions/${adoptionId}/preferences`) {
      const body = route.request().postDataJSON();
      attempts.push({
        key: route.request().headers()["idempotency-key"],
        etag: route.request().headers()["if-match"],
        method: route.request().method(),
        body,
      });
      if (attempts.length === 1)
        await route.fulfill({
          status: 401,
          json: { detail: { code: "SESSION_EXPIRED", message: "請重新登入" } },
        });
      else {
        prefs = body;
        await route.fulfill({
          json: {
            ...adoption,
            version: 3,
            status: "active",
            preferences: prefs,
          },
        });
      }
      return true;
    }
  });
  await login(page, "citizen", `adopt/${adoptionId}`);
  await page.getByLabel("滿桶通知", { exact: true }).uncheck();
  await page.getByRole("button", { name: "預覽更新偏好", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "請以市民身份登入" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "市民登入", exact: true }).click();
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.getByRole("button", { name: "重試原操作", exact: true }).click();
  await expect(
    page.getByText("目前通知：滿桶 關閉、堆放 開啟、髒污 開啟", {
      exact: true,
    }),
  ).toBeVisible();
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[1].method).toBe("PATCH");
});
