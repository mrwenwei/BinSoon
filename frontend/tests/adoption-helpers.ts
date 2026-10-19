import { expect, type Page } from "@playwright/test";
import { locations } from "../src/data/locations";
import { binDemo } from "../src/data/binDemo";

// Da'an bins that start without a demo adopter and are not removed.
export const adoptableBins = locations.filter(
  (p) =>
    p.kind === "bin" &&
    p.district === "大安區" &&
    !binDemo(p).removed &&
    !binDemo(p).adopter,
);
export const adoptableBin = adoptableBins[0];

export const adoptLoginUrl = (binId = adoptableBin.id) =>
  `/#login?next=${encodeURIComponent(`bin/${binId}?adopt=1`)}`;

// Applies in place from the bin detail page; the user must already be logged in.
export async function applyForAdoption(
  page: Page,
  name: string,
  binId = adoptableBin.id,
) {
  await page.goto(`/#bin/${binId}`);
  await page
    .getByRole("button", { name: "成為這個桶的認養者", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "認養這個桶" });
  await panel.getByLabel("認養者公開名稱").fill(name);
  await panel
    .getByRole("button", { name: "送出認養申請", exact: true })
    .click();
  await expect(
    page.getByText("申請已送出，等待清潔隊審核。", { exact: false }),
  ).toBeVisible();
}
