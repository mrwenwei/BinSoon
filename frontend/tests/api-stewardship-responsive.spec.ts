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
import { adoption, adoptionId } from "./api-adoption-fixture";

test("proposal review, naming and adoption screens remain usable at desktop mobile and 320px", async ({
  page,
}, info) => {
  await apiFixture(page, async (route, path) => {
    let data: unknown;
    const admin = route.request().headers().authorization?.includes("admin");
    if (path === "/proposals")
      data = envelope([{ ...proposal, status: "survey" }]);
    else if (path === `/proposals/${proposalId}`)
      data = {
        ...proposal,
        status: "installed",
        mine: !admin,
        name_status: admin ? "pending" : null,
        pending_name: admin ? "待審新桶名" : null,
        approved_name: "已核准舊桶名",
      };
    else if (path === "/admin/adoptions" || path === "/me/adoptions")
      data = envelope([adoption]);
    else if (path === `/adoptions/${adoptionId}`)
      data = { ...adoption, status: admin ? "pending" : "active" };
    else if (path === `/bins/${binId}/view`)
      data = {
        location,
        status,
        compartments: [],
        adopter: null,
        latest_cleanup: null,
        can_apply_adoption: true,
        my_adoption_id: null,
      };
    else return;
    await route.fulfill({ headers: { ETag: '"v1"' }, json: data });
    return true;
  });
  for (const role of ["admin", "citizen"]) {
    await login(page, role, role === "admin" ? "admin/proposals" : "adopt");
    for (const width of info.project.name === "desktop" ? [1440, 320] : [393]) {
      await page.setViewportSize({ width, height: 900 });
      const routes =
        role === "admin"
          ? [
              "admin/proposals",
              `admin/proposals/${proposalId}`,
              "admin/adoptions",
              `admin/adoptions/${adoptionId}`,
            ]
          : [
              `proposals/${proposalId}`,
              "adopt",
              `adopt/${adoptionId}`,
              `adopt/apply/${binId}`,
            ];
      for (const hash of routes) {
        await page.evaluate((hash) => {
          window.location.hash = hash;
        }, hash);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(
          page.getByRole("status").filter({ hasText: "載入中" }),
        ).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`${hash.replaceAll("/", "-")}-${width}.png`),
          fullPage: true,
        });
      }
    }
    if (role === "citizen") {
      const input = page.getByLabel("公開名稱", { exact: true });
      await input.focus();
      await page.keyboard.type("鍵盤認養");
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("滿桶通知", { exact: true })).toBeFocused();
    }
  }
});

test("adoption list empty failure forbidden and other-owner detail remain explicit", async ({
  page,
}) => {
  let failed = false;
  await apiFixture(page, async (route, path) => {
    if (path === "/me/adoptions") {
      if (failed)
        await route.fulfill({
          status: 503,
          json: {
            detail: { code: "UNAVAILABLE", message: "無法讀取認養資料" },
          },
        });
      else await route.fulfill({ json: envelope([]) });
      return true;
    }
    if (path === `/adoptions/${adoptionId}`) {
      await route.fulfill({
        status: 404,
        json: { detail: { code: "NOT_FOUND", message: "找不到自己的認養" } },
      });
      return true;
    }
    if (path === "/admin/adoptions") {
      await route.fulfill({
        status: 403,
        json: { detail: { code: "FORBIDDEN", message: "沒有審核權限" } },
      });
      return true;
    }
  });
  await login(page, "citizen", "adopt");
  await expect(page.getByText("尚無認養紀錄", { exact: true })).toBeVisible();
  await page.evaluate((id) => {
    location.hash = `adopt/${id}`;
  }, adoptionId);
  await expect(page.getByRole("alert")).toContainText("找不到自己的認養");
  await expect(
    page.getByRole("button", { name: "結束認養", exact: true }),
  ).toHaveCount(0);
  failed = true;
  await page.evaluate(() => {
    location.hash = "adopt";
  });
  await expect(page.getByRole("alert")).toContainText("無法讀取認養資料");
  await login(page, "admin", "admin/adoptions");
  await expect(page.getByRole("alert")).toContainText("沒有審核權限");
});
