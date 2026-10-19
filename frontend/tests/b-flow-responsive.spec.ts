import { test, expect } from "@playwright/test";

test("P10-P16 fit desktop and phone and keep the keyboard form when tiles fail", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/tests/legacy/index.html#login?next=adopt");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.getByLabel("認養者公開名稱").fill("畫面驗收小隊");
  await page.getByRole("button", { name: "送出認養申請", exact: true }).click();
  const application = page.getByRole("article", { name: /認養申請：/ }).first();
  await application.getByText("展示控制：認養審批", { exact: true }).click();
  await application
    .getByRole("button", { name: "核准認養", exact: true })
    .click();
  const quickUrl = await application
    .getByRole("link", { name: "一鍵通報附近清潔隊", exact: true })
    .getAttribute("href");
  const routes = [
    "#nearby",
    "#vote",
    "#vote-done/xinyi",
    "#vote-progress/heping",
    "#adopt",
    quickUrl!,
  ];
  for (const width of isMobile ? [412] : [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`/tests/legacy/index.html${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (route === "#nearby") {
        await expect(page.getByLabel("提案緯度")).toBeVisible();
        await expect(
          page.getByText("底圖暫時無法完整載入", { exact: false }),
        ).toBeVisible({ timeout: 20000 });
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBeTruthy();
      await page.screenshot({
        path: testInfo.outputPath(
          `${route.replace(/[^a-z-]/g, "")}-${width}.png`,
        ),
        fullPage: true,
      });
    }
  }
});
