import { test, expect, type Page } from "@playwright/test";
import { apiFixture, binId, location, status, envelope } from "./api-fixtures";

async function setup(page: Page) {
  const writes: string[] = [];
  await apiFixture(
    page,
    async (route, path) => {
      if (route.request().method() !== "GET") writes.push(path);
      // Another citizen already claims this Bin: this must not block our claim.
      if (path.endsWith("/view")) {
        await route.fulfill({
          json: {
            location: { ...location, id: path.split("/")[2] },
            status,
            compartments: location.compartments,
            can_report: true,
            can_apply_adoption: false,
            my_adoption_id: null,
            adopter: {
              display_name: "別人的公開身份",
              role: "居民",
              intro: "",
            },
            latest_cleanup: null,
            report_block_reason: null,
          },
        });
        return true;
      }
      if (path === "/map/locations") {
        await route.fulfill({ json: envelope([location]) });
        return true;
      }
    },
    { demo: true },
  );
  await page.goto("/#login?next=adopt");
  await page
    .getByRole("button", { name: "以展示市民登入", exact: true })
    .click();
  return writes;
}
async function claim(page: Page, id: string, name: string) {
  await page.goto(`/#adopt/apply/${id}`);
  await page.getByLabel("Bin友的私人桶名", { exact: true }).fill(name);
  await page.getByRole("button", { name: "預覽認領", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText(`已認領「${name}」，桶名只有你看得到。`, { exact: true }),
  ).toBeVisible();
}

test("claims have private editable names, allow another adopter and survive reload without public writes", async ({
  page,
}, info) => {
  const writes = await setup(page);
  for (const name of ["全家炸雞桶", "下班等公車桶", "早餐店轉角桶"])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await claim(page, binId, "宵夜買鹽酥雞桶");
  await page.getByRole("link", { name: "查看我的認養", exact: true }).click();
  await page.getByLabel("Bin友的私人桶名", { exact: true }).fill("趕末班車桶");
  await page.getByRole("button", { name: "預覽更名", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "趕末班車桶", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "趕末班車桶", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "查看 Bin友", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "趕末班車桶", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("private-bin-name.png"),
    fullPage: true,
  });
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toContainText("趕末班車桶");
  // Anonymous view of the same browser does not receive the personal alias.
  await page.evaluate(() =>
    sessionStorage.removeItem("binsoon-demo-signed-in"),
  );
  await page.reload();
  await expect(page.locator(".location-row")).toContainText(location.label);
  await expect(page.getByText("趕末班車桶", { exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("five-claim limit is enforced across tabs and ending a claim releases its slot", async ({
  page,
  context,
}) => {
  const writes = await setup(page);
  await claim(page, binId, "午休買咖啡桶");
  // Keep a form open before the fifth claim completes, then submit it stale.
  const second = await context.newPage();
  await setup(second);
  const otherId = "10000000-0000-4000-8000-000000000002";
  await second.goto(`/#adopt/apply/${otherId}`);
  await second.getByLabel("Bin友的私人桶名", { exact: true }).fill("第六個桶");
  await second.getByRole("button", { name: "預覽認領", exact: true }).click();
  await claim(page, "10000000-0000-4000-8000-000000000003", "遛狗轉角桶");
  await expect(
    second.getByRole("button", { name: "確認送出", exact: true }),
  ).toBeDisabled();
  await expect(
    second.getByText("每人至多認領 5 個桶，請先結束現有認領。", {
      exact: true,
    }),
  ).toBeVisible();
  // Also verify the local command boundary, independent of the disabled UI.
  const rejected = await second.evaluate(async (id) => {
    const modulePath = "/src/data/api.ts";
    const { request } = await import(modulePath);
    try {
      await request("/adoptions", {
        method: "POST",
        token: "binsoon-local-citizen",
        key: crypto.randomUUID(),
        body: {
          bin_id: id,
          role: "居民",
          private_bin_name: "第六個桶",
          preferences: {},
        },
      });
      return "accepted";
    } catch (error) {
      return (error as { code: string }).code;
    }
  }, otherId);
  expect(rejected).toBe("ADOPTION_LIMIT");
  await page.goto(`/#adopt/apply/${otherId}`);
  await expect(
    page.getByText("已認領 5 / 5 個桶（含待審申請）", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Bin友的私人桶名", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/#adopt/demo-adoption-1");
  await page.getByRole("button", { name: "結束認養", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await claim(page, otherId, "下雨躲騎樓桶");
  expect(writes).toEqual([]);
});
