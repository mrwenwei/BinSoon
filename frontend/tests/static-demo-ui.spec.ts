import { test, expect } from "@playwright/test";
import { locations } from "../src/data/locations";

test("snapshot map and my BinU work without API", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  const bin = locations.find(
    (item) => item.kind === "bin" && item.district === "大安區",
  )!;
  await page.goto("/#map");
  await expect(page.locator(".location-row").first()).toBeVisible();
  await page.goto(`/#bin/${bin.id}`);
  await expect(
    page.getByRole("heading", { name: bin.label, exact: true }),
  ).toBeVisible();
  await page.goto("/#login?next=adopt");
  await page.getByRole("button", { name: "以市民登入", exact: true }).click();
  await expect(page.locator(".citizen-bin-card")).toHaveCount(3);
  await expect(
    page.locator('.citizen-bin-card input[type="checkbox"]'),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".citizen-bin-card")).toHaveCount(3);
  const unclaimed = locations.filter(
    (item) => item.kind === "bin" && item.district === "大安區",
  )[4];
  await page.goto(`/#adopt/apply/${unclaimed.id}`);
  await expect(
    page.getByRole("heading", { name: "認領 BinU", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "BinU 通知", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('.binu-adoption-form input[type="checkbox"]'),
  ).toHaveCount(0);
  await page.getByLabel("BinU的私人桶名", { exact: true }).fill("下班買晚餐桶");
  await page.getByRole("button", { name: "預覽認領", exact: true }).click();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await expect(
    page.getByText("已認領「下班買晚餐桶」，桶名只有你看得到。", {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("static inventory preserves counts, search and same-stream nearest bins", async ({
  page,
}) => {
  await page.goto("/#map");
  const data = await page.evaluate(async () => {
    // @ts-expect-error Vite resolves the application module in the browser.
    const { request, allPages } = await import("/src/data/api.ts");
    const bins = await allPages(
      "/map/locations?district=all&kind=bin&include_proposed=true",
    );
    const places = await allPages("/map/locations?district=all&kind=place");
    const search = await allPages(
      "/map/locations?district=大安區&kind=bin&q=和平",
    );
    const nearest = await request(
      "/map/nearest-usable?latitude=25.026&longitude=121.536&waste_type=recycling",
    );
    return {
      existing: bins.filter(
        (item: { bin_type: string }) => item.bin_type === "existing",
      ).length,
      daan: bins.filter(
        (item: { bin_type: string; district: string }) =>
          item.bin_type === "existing" && item.district === "大安區",
      ).length,
      suggested: bins.filter(
        (item: { source_type: string }) =>
          item.source_type === "model_recommendation",
      ).length,
      places: places.length,
      search: search.map((item: { label: string; district: string }) => ({
        label: item.label,
        district: item.district,
      })),
      nearest: nearest.data.items,
    };
  });
  expect(data.existing).toBe(681);
  expect(data.daan).toBe(47);
  expect(data.suggested).toBe(10);
  expect(data.places).toBe(130);
  expect(data.search.length).toBeGreaterThan(0);
  for (const item of data.search) {
    expect(item.district).toBe("大安區");
    expect(item.label).toContain("和平");
  }
  expect(data.nearest).toHaveLength(3);
  for (const item of data.nearest) {
    expect(item.bin_status.waste_type).toBe("recycling");
    expect(item.bin_status.is_usable).toBe(true);
    expect(item.bin_type).toBe("existing");
  }
});

test("ranking month selector fits mobile and desktop and changes month", async ({
  page,
}, info) => {
  await page.goto("/#crew/login");
  await page.getByRole("button", { name: "以清潔員登入", exact: true }).click();
  await page.goto("/#crew/ranking");
  const month = page.getByLabel("月份", { exact: true });
  await expect(month).toBeVisible();
  const previous = await month.locator("option").nth(1).getAttribute("value");
  await month.selectOption(previous!);
  await expect(month).toHaveValue(previous!);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await month.boundingBox();
    const card = await page.locator(".crew-ranking .api-form").boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(card!.x + card!.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`ranking-${width}.png`),
      fullPage: true,
    });
  }
});
