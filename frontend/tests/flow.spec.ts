import { test, expect } from "@playwright/test";

test("find a bin, inspect its demo status and preserve source distinctions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "搜尋地點" }).fill("找不到的地點");
  await expect(page.getByText("沒有符合的地點")).toBeVisible();
  await page.getByRole("searchbox", { name: "搜尋地點" }).fill("");
  const first = page.locator(".location-row").first();
  const label = await first.locator("strong").innerText();
  await first.click();
  await expect(
    page.getByRole("heading", { level: 1, name: label, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("今天的飽足度")).toBeVisible();
  await expect(page.getByRole("link", { name: "導航過去" })).toHaveAttribute(
    "href",
    /#nav\//,
  );
  await expect(
    page.getByRole("button", { name: "按讚", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("尚無可驗證清運完成紀錄", { exact: true }),
  ).toBeVisible();
  const detailUrl = page.url();
  await page.getByRole("link", { name: "登入", exact: true }).click();
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(page).toHaveURL(detailUrl);
  await page.getByRole("link", { name: "返回地圖", exact: true }).click();
  await page.getByRole("button", { name: "場所代表點", exact: true }).click();
  await page.locator(".location-row").first().click();
  await expect(page.getByRole("region", { name: "位置詳情" })).toContainText(
    "並非個別清潔箱位置",
  );
  await expect(page.getByRole("link", { name: "回報問題" })).toHaveCount(0);
});

test("report requires photo, proximity and login, then keeps a pending report without duplicate rewards", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await page.locator(".location-row").first().click();
  await page.getByRole("link", { name: "回報問題", exact: true }).click();
  if (!isMobile) {
    await expect(
      page.getByRole("img", { name: "手機回報 QR Code" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
  }
  await page.getByRole("button", { name: "桶旁有堆放", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "拍一張示意照片" }).click();
  await page.getByLabel("示意定位情境").selectOption("far");
  await expect(
    page.getByText("示意距離 78 公尺，超過 50 公尺限制。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeDisabled();
  await page.getByLabel("示意定位情境").selectOption("near");
  await page.getByRole("link", { name: "登入後繼續回報" }).click();
  await page.getByLabel("手機號碼", { exact: true }).fill("0912345678");
  await page.getByRole("button", { name: "傳送示範驗證碼" }).click();
  await page.getByLabel("簡訊驗證碼").fill("000000");
  await page.getByRole("button", { name: "驗證並綁定" }).click();
  await expect(page.getByRole("alert")).toContainText("123456");
  await page.getByLabel("簡訊驗證碼").fill("123456");
  await page.getByRole("button", { name: "驗證並綁定" }).click();
  await expect(
    page.getByRole("button", { name: "桶旁有堆放", exact: false }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await expect(
    page.getByRole("heading", { name: "謝謝你幫城市變乾淨！" }),
  ).toBeVisible();
  await expect(page.getByText("+1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "謝謝你幫城市變乾淨！" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "前往會員中心", exact: true }).click();
  await expect(page.getByText("+1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "會員中心", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("可用點數 63", { exact: true })).toBeVisible();
  await page.locator(".report-history a").first().click();
  await page.getByRole("link", { name: "查看這個桶", exact: true }).click();
  await page.getByRole("link", { name: "回報問題", exact: true }).click();
  if (!isMobile)
    await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
  await page.getByRole("button", { name: "桶旁有堆放", exact: false }).click();
  await expect(
    page.getByText("這個問題已有示範回報，請勿重複送出。", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeDisabled();
});

test("P2 lifecycle filters show usable bins and keep removed bins out of reporting", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新設的桶", exact: true }).click();
  const rows = page.locator(".location-row");
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) await expect(row).toContainText("新設");
  await page.getByRole("button", { name: "還能裝的桶", exact: true }).click();
  for (const row of await rows.all()) {
    await expect(row).toContainText(/餓了|半飽/);
    await expect(row).not.toContainText(/已撤除|吃飽了/);
  }
  await page.getByRole("button", { name: "全部桶況", exact: true }).click();
  await rows.filter({ hasText: "已撤除" }).first().click();
  await expect(
    page.getByRole("link", { name: "回報問題", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "尋找可用桶並導航", exact: true })
    .click();
  await expect(
    page.getByText("原目的桶已撤除，已改導另一個可用桶。", { exact: true }),
  ).toBeVisible();
});
