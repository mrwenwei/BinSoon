import { test, expect } from "@playwright/test";

test("all A flow screens fit their viewport, including a 320px phone", async ({
  page,
  isMobile,
}, testInfo) => {
  async function capture(name: string) {
    const expected = name.startsWith("map")
      ? /附近哪裡/
      : name.startsWith("bin")
        ? /新生南路/
        : name === "report-qr"
          ? /回報要在現場/
          : name === "report-done"
            ? /謝謝你幫城市變乾淨/
            : name.startsWith("report")
              ? /回報這個桶/
              : name.startsWith("login")
                ? /先讓電子雞/
                : /把順手/;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(expected);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      name,
    ).toBeTruthy();
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
  }
  await page.goto("/");
  await expect(page.locator(".location-row")).toHaveCount(47);
  await capture("map");
  await page.getByRole("button", { name: "只看餓了的", exact: true }).click();
  await expect(page.locator(".location-row").first()).toContainText("餓了");
  for (const row of await page.locator(".location-row").all())
    await expect(row).toContainText("餓了");
  await page.getByRole("button", { name: "可丟狗便便", exact: true }).click();
  for (const row of await page.locator(".location-row").all())
    await expect(row).toContainText("可丟狗便便");
  await page.getByRole("button", { name: "全部桶況", exact: true }).click();
  await page.locator(".location-row").first().click();
  const binUrl = page.url();
  await capture("bin");
  await page.getByRole("link", { name: "回報問題", exact: true }).click();
  if (!isMobile) {
    await capture("report-qr");
    await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
  }
  await page.getByRole("button", { name: "其他", exact: false }).click();
  await page.getByRole("button", { name: "拍一張示意照片" }).click();
  await page.getByLabel("示意定位情境").selectOption("near");
  await page.getByRole("link", { name: "登入後繼續回報" }).click();
  await capture("login");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeDisabled();
  await page
    .getByLabel("補充說明（必填）")
    .fill("路旁垃圾桶需要協助，這是示範說明。");
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeEnabled();
  await capture("report");
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await capture("report-done");
  await page.getByRole("link", { name: "查看我的集章" }).click();
  await capture("stamps");
  await page.getByLabel("集章行政區").selectOption("信義區");
  await expect(
    page.getByRole("heading", { name: "信義區印章 0 / 20" }),
  ).toBeVisible();
  if (!isMobile) {
    for (const width of [768, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(binUrl);
      await capture(`bin-${width}`);
      await page.getByRole("link", { name: "回報問題", exact: true }).click();
      if (width > 760)
        await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
      await capture(`report-${width}`);
      await page.goto("/#login");
      await capture(`login-${width}`);
      await page.goto("/#stamps");
      await capture(`stamps-${width}`);
      await page.goto("/#map");
      await capture(`map-${width}`);
    }
  }
  await page.goto("/#report/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "找不到這個頁面" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回地圖", exact: true }).click();
  await expect(page.locator(".location-row")).toHaveCount(47);
});

test("invalid stored data recovers and unavailable storage keeps the flow usable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "binsoon-a-flow-v1",
      '{"loggedIn":true,"likes":[],"reports":[{}],"stamps":[],"redeemed":false}',
    ),
  );
  await page.goto("/#stamps");
  await expect(page.getByText("可用點數 230", { exact: true })).toBeVisible();
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("storage unavailable");
    };
  });
  await page.goto("/");
  await expect(
    page.getByText("瀏覽器無法儲存資料，重新整理後可能無法保留本次紀錄。"),
  ).toBeVisible();
  await page.locator(".location-row").first().click();
  await page.getByRole("button", { name: "按讚", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已按讚", exact: true }),
  ).toBeDisabled();
});
