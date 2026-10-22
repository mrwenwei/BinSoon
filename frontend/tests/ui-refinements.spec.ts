import { test, expect } from "@playwright/test";
import { apiFixture, binId } from "./api-fixtures";

test("M5 has a BinU hero, private naming and only an optional full notification", async ({
  page,
}, info) => {
  await apiFixture(page, undefined, { demo: true });
  await page.goto(`/#login?next=adopt/apply/${binId}`);
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  const hero = page.getByRole("region", {
    name: "等你認領的 BinU",
    exact: true,
  });
  await expect(
    hero.getByRole("img", { name: "等你認領的 BinU 吉祥物" }),
  ).toBeVisible();
  await expect(page.getByLabel("認養身份", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  const notification = page.getByRole("checkbox", {
    name: "吃飽了（80% 以上）",
    exact: true,
  });
  await notification.uncheck();
  for (const width of [320, 393, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`binu-m5-${width}.png`),
      fullPage: true,
    });
  }
  await page
    .getByLabel("BinU的私人桶名", { exact: true })
    .fill("我的早餐 BinU");
  await page.getByRole("button", { name: "預覽認領", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await page.getByRole("link", { name: "查看我的認養", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("目前通知：吃飽了（80% 以上）關閉", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(1);
});

test("report history shows different handlers, bin-shaped demo media and a single crew login", async ({
  page,
}, info) => {
  await apiFixture(page, undefined, { demo: true });
  await page.goto("/#login?next=reports");
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  for (const name of ["阿順", "阿清", "阿安"])
    await expect(
      page.getByRole("button", { name: `幫清潔員${name}按讚`, exact: true }),
    ).toBeVisible();
  await page.goto("/#review/demo-report-4");
  const photo = page.locator("main img");
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(640);
  const svg = decodeURIComponent((await photo.getAttribute("src"))!);
  expect(svg).toContain("<path");
  expect(svg).toContain("非現場證據");
  await page.screenshot({
    path: info.outputPath("binu-demo-photo.png"),
    fullPage: true,
  });
  await page.goto("/#vote/votes");
  await expect(
    page.getByRole("link", { name: "建立提案", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "我的提案", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#crew/login");
  await expect(page.getByText(/阿順/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "以模擬清潔員登入", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("combobox")).toHaveCount(0);
});
