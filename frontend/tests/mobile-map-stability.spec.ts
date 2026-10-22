import { test, expect } from "@playwright/test";
import { apiFixture, envelope, location } from "./api-fixtures";
import snapshot from "../src/data/locations.json" with { type: "json" };

if (process.env.BINSOON_WEBKIT === "1") test.use({ browserName: "webkit" });

test("full-city map survives repeated phone reloads and mount/unmount cycles", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  const failures: string[] = [];
  page.on("crash", () => failures.push("page crashed"));
  page.on("pageerror", (error) => {
    // WebKit reports fixture fetches aborted by reload as access-control errors.
    // Every completed load below must still render the full, verified bin list.
    if (!error.message.endsWith(" due to access control checks."))
      failures.push(error.message);
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await apiFixture(
    page,
    async (route, path) => {
      if (path !== "/map/locations") return;
      const url = new URL(route.request().url());
      const offset = Number(url.searchParams.get("offset") || 0);
      const items = snapshot.map((item) => ({
        ...location,
        ...item,
        bin_type: item.kind === "bin" ? "existing" : null,
        placement_status: item.kind === "bin" ? "existing" : null,
        bin_status: item.kind === "bin" ? location.bin_status : null,
      }));
      await route.fulfill({
        json: envelope(items.slice(offset, offset + 100), offset, items.length),
      });
      return true;
    },
    { demo: true },
  );
  console.log("stress: navigation start");
  await page.goto("/#map", { waitUntil: "domcontentloaded" });
  console.log("stress: document ready");
  for (let i = 0; i < 3; i++) {
    console.log("stress iteration", i);
    if (i) await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".location-row")).toHaveCount(681);
    await expect(
      page.locator(
        "canvas.maplibregl-canvas, .map-raster-fallback.leaflet-layer",
      ),
    ).toHaveCount(1);
    await page.waitForTimeout(250);
    await page
      .getByRole("navigation", { name: "主要分頁" })
      .getByRole("link", { name: "我的", exact: true })
      .click();
    await expect(page.locator("canvas.maplibregl-canvas")).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "主要分頁" })
      .getByRole("link", { name: "地圖", exact: true })
      .click();
    await expect(page.locator(".location-row")).toHaveCount(681);
  }
  const canvas = page.locator("canvas.maplibregl-canvas");
  const pixels = (await canvas.count())
    ? await canvas.evaluate((el: HTMLCanvasElement) => ({
        width: el.width,
        height: el.height,
        cssWidth: el.clientWidth,
        cssHeight: el.clientHeight,
        dpr: devicePixelRatio,
      }))
    : { raster: true };
  console.log("mobile map canvas", JSON.stringify(pixels));
  expect(failures).toEqual([]);
  await page.screenshot({ path: info.outputPath("mobile-map-stress.png") });
});

test("phone basemap limits canvas pixel density", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await apiFixture(page, undefined, { demo: true });
  await page.goto("/#map");
  const canvas = page.locator("canvas.maplibregl-canvas");
  await expect(canvas).toHaveCount(1);
  const ratio = await canvas.evaluate(
    (el: HTMLCanvasElement) => el.width / el.clientWidth,
  );
  console.log("phone canvas density", ratio);
  expect(ratio).toBeLessThanOrEqual(1.51);
});

test("failed WebGL creation falls back without breaking later map mounts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (type: string, ...args: unknown[]) {
        return type.startsWith("webgl")
          ? null
          : Reflect.apply(getContext, this, [type, ...args]);
      },
    });
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await apiFixture(page, undefined, { demo: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#map");
  for (let i = 0; i < 3; i++) {
    await expect(
      page.locator(".map-raster-fallback.leaflet-layer"),
    ).toHaveCount(1);
    await expect(
      page.getByText("已切換輕量底圖。位置標記、搜尋與清單仍可使用。", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".location-row")).toHaveCount(1);
    await page
      .getByRole("navigation", { name: "主要分頁" })
      .getByRole("link", { name: "我的", exact: true })
      .click();
    await expect(
      page.locator(".map-raster-fallback.leaflet-layer"),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "主要分頁" })
      .getByRole("link", { name: "地圖", exact: true })
      .click();
  }
  expect(errors).toEqual([]);
});

test("nearby list mascots contain only their static face", async ({ page }) => {
  await apiFixture(page, undefined, { demo: true });
  await page.goto("/#map");
  await expect(page.locator(".location-row")).toHaveCount(1);
  console.log(
    "list hidden frames",
    await page.locator(".row-buddy .bot-fr").count(),
  );
  await expect(page.locator(".row-buddy .bot-fr")).toHaveCount(0);
  await expect(page.locator(".row-buddy .bot-idle")).toHaveCount(1);
});
