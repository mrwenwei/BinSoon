import { expect, type Page } from "@playwright/test";

// Report API/ledger tests now exercise the phone-only simulated capture flow.
// Desktop blocking is tested separately with an unmodified desktop user agent.
export async function asPhone(page: Page) {
  const phone = () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 1,
    });
  };
  await page.addInitScript(phone);
  await page.evaluate(phone);
}
export async function captureReport(page: Page) {
  await page
    .getByRole("button", { name: "現場拍照", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "待送出的照片" }),
  ).toBeVisible();
}
