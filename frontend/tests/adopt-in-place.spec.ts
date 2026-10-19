import { test, expect } from "@playwright/test";
import { locations } from "../src/data/locations";
import { binDemo } from "../src/data/binDemo";
import {
  adoptableBin,
  adoptableBins,
  applyForAdoption,
} from "./adoption-helpers";

const binId = adoptableBin.id;
const adoptedBin = locations.find(
  (p) =>
    p.kind === "bin" &&
    p.district === "大安區" &&
    !binDemo(p).removed &&
    binDemo(p).adopter,
)!;

async function login(page: import("@playwright/test").Page) {
  await page.goto("/#login");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
}

test("logged-out visitors see what adopting means and log in before any field appears", async ({
  page,
}) => {
  await page.goto(`/#bin/${binId}`);
  await expect(
    page.getByText("認養：還沒有認養者", { exact: true }),
  ).toBeVisible();
  const toggle = page.getByRole("button", {
    name: "成為這個桶的認養者",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("region", { name: "認養這個桶" });
  await expect(panel).toContainText("你會做什麼");
  await expect(panel).toContainText("你會得到什麼");
  await expect(panel).toContainText("之後會怎樣");
  await expect(panel.getByLabel("認養者公開名稱")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "送出認養申請" })).toHaveCount(
    0,
  );
  // Still on the bin detail page: the bin heading and map location stay put.
  await expect(page).toHaveURL(new RegExp(`#bin/${binId}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: adoptableBin.label }),
  ).toBeVisible();
  await expect(page.getByText("查看地圖位置", { exact: true })).toBeVisible();
  const loginLink = panel.getByRole("link", {
    name: "登入後申請",
    exact: true,
  });
  await expect(loginLink).toHaveAttribute(
    "href",
    `#login?next=${encodeURIComponent(`bin/${binId}?adopt=1`)}`,
  );
  await loginLink.click();
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(page).toHaveURL(new RegExp(`#bin/${binId}\\?adopt=1$`));
  await expect(
    page
      .getByRole("region", { name: "認養這個桶" })
      .getByLabel("認養者公開名稱"),
  ).toBeVisible();
  await expect(page.getByLabel("認養者公開名稱")).toHaveAttribute(
    "placeholder",
    /會公開顯示，請勿填真實姓名或電話/,
  );
  await expect(page.getByLabel("要認養的桶")).toHaveCount(0);
});

test("submitting stays on the bin, shows the pending state and hides the apply button", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/#bin/${binId}`);
  await page
    .getByRole("button", { name: "成為這個桶的認養者", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "認養這個桶" });
  await panel.getByLabel("認養身分").selectOption("店家");
  await panel.getByLabel("店家介紹（選填）").fill("巷口的早餐店。");
  await panel.getByLabel("認養者公開名稱").fill("巷口早餐");
  await panel
    .getByRole("button", { name: "送出認養申請", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "申請已送出" }),
  ).toHaveText(/申請已送出，等待清潔隊審核。/);
  await expect(page).toHaveURL(new RegExp(`#bin/${binId}$`));
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByText("認養：你的認養申請審核中", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "成為這個桶的認養者" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("認養：你的認養申請審核中", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "成為這個桶的認養者" }),
  ).toHaveCount(0);
  // A bin someone else adopts never offers the application.
  await page.goto(`/#bin/${adoptedBin.id}?adopt=1`);
  await expect(
    page.getByText(`認養：${binDemo(adoptedBin).adopter}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "成為這個桶的認養者" }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "認養這個桶" })).toHaveCount(0);
});

test("my adoptions starts empty with a way to the map, and orders records by status", async ({
  page,
}) => {
  await page.goto("/#adopt");
  await expect(
    page.getByRole("heading", { level: 1, name: "我的認養" }),
  ).toBeVisible();
  const toMap = page.getByRole("link", { name: "到地圖挑一個桶", exact: true });
  await expect(toMap).toHaveAttribute("href", "#map");
  await expect(
    page.getByText("示範版以大安森林公園為起點，不讀取你的位置"),
  ).toBeVisible();
  await expect(page.getByLabel("要認養的桶")).toHaveCount(0);
  await expect(page.getByLabel("認養者公開名稱")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("link", { name: "我的投票進度" }),
  ).toHaveCount(0);

  await login(page);
  const [first, second, third] = adoptableBins;
  await applyForAdoption(page, "核准小隊", first.id);
  await applyForAdoption(page, "待審小隊", second.id);
  await applyForAdoption(page, "撤回小隊", third.id);
  await page.goto("/#adopt");
  const records = page.getByRole("article", { name: /認養申請：/ });
  await records
    .filter({ hasText: "撤回小隊" })
    .getByRole("button", { name: "撤回申請" })
    .click();
  await page.getByRole("button", { name: "確認撤回申請" }).click();
  await expect(page.locator(".participation-feedback")).toHaveText(
    "已撤回申請。",
  );
  const approved = records.filter({ hasText: "核准小隊" });
  await approved.getByText("展示控制：認養審批", { exact: true }).click();
  await approved.getByRole("button", { name: "核准認養", exact: true }).click();
  await expect(page.locator(".participation-feedback")).toHaveText(
    "已核准（示範）。",
  );
  await expect(records.nth(0)).toContainText("核准小隊");
  await expect(records.nth(1)).toContainText("待審小隊");
  await expect(records.nth(2)).toContainText("撤回小隊");
  await expect(records.nth(0).locator(".status-pill")).toHaveText("認養中");
  await expect(records.nth(0).locator(".status-pill")).not.toHaveClass(/half/);
  await expect(records.nth(1).locator(".status-pill")).toHaveClass(/half/);
  await expect(records.nth(0)).not.toContainText("結果原因");
  await expect(records.nth(2)).toContainText("結果原因：本人撤回申請");
  await expect(
    records.nth(2).getByRole("link", { name: "重新填寫申請" }),
  ).toHaveAttribute("href", `#bin/${third.id}?adopt=1`);
});

test("old #adopt/<id> links open the in-place form without an extra history entry", async ({
  page,
}) => {
  await login(page);
  await page.goto("/#map");
  await page.goto(`/#adopt/${binId}`);
  await expect(page).toHaveURL(new RegExp(`#bin/${binId}\\?adopt=1$`));
  await expect(
    page
      .getByRole("region", { name: "認養這個桶" })
      .getByLabel("認養者公開名稱"),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#map$/);
  // Only bin/<id>?adopt=1 is a new login destination; other queries fall back to the map.
  await page.goto(
    `/#login?next=${encodeURIComponent(`bin/${binId}?adopt=1&demo=1`)}`,
  );
  await page.getByRole("button", { name: "繼續體驗" }).click();
  await expect(page).toHaveURL(/#map$/);
});

test("the top navigation no longer links to adoption; member center offers my adoptions", async ({
  page,
}) => {
  await page.goto("/#map");
  await expect(page.getByRole("link", { name: "認養電子雞" })).toHaveCount(0);
  await page.goto("/#member");
  const mine = page.getByRole("link", { name: /我的認養/ });
  await expect(mine).toHaveAttribute("href", "#adopt");
});
