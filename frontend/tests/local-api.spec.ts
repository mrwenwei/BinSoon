import { test, expect } from "@playwright/test";
import { envelope, location } from "./api-fixtures";

test("local app reads API through its own origin rather than a CORS-restricted cloud origin", async ({page, baseURL}) => {
  const origins: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    origins.push(url.origin);
    if (url.origin !== new URL(baseURL!).origin) {
      await route.abort("failed"); return;
    }
    await route.fulfill({json: envelope([location])});
  });
  await page.goto("/");
  await expect(page.locator(".location-row")).toHaveCount(1);
  expect(origins.length).toBeGreaterThan(0);
  expect(new Set(origins)).toEqual(new Set([new URL(baseURL!).origin]));
  await expect(page.getByText("連線未完成，請檢查網路後重試；原操作已保留。")).toHaveCount(0);
});
