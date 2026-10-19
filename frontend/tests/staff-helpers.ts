import { expect, type Page } from "@playwright/test";
// Regression tests now perform the same public crew actions as the D workflow.
export async function reviewAsStaff(page: Page, verdict: string) {
  const citizenUrl = page.url();
  const reportId = citizenUrl.split("#review/")[1];
  const link = page.getByRole("link", { name: "切換隊員查看此工單" });
  await link.click();
  await expect(
    page
      .getByRole("button", { name: "使用大安區示範隊員" })
      .or(page.getByTestId("task-status")),
  ).toBeVisible();
  if (await page.getByRole("button", { name: "使用大安區示範隊員" }).count())
    await page.getByRole("button", { name: "使用大安區示範隊員" }).click();
  await expect(page.getByTestId("task-status")).toBeVisible();
  const accept = page.getByRole("button", { name: "接單", exact: true });
  if ((await page.getByTestId("task-status").textContent()) === "待接單") {
    await accept.click();
    await expect(page.getByTestId("task-status")).toHaveText("處理中");
  }
  if (verdict === "processing") {
    await page.goto(citizenUrl);
    return;
  }
  const arrive = page.getByRole("button", { name: "示範已到場" });
  if ((await page.getByTestId("task-status").textContent()) === "處理中") {
    await arrive.click();
    await expect(page.getByTestId("task-status")).toHaveText("已到場");
  }
  await expect(page.getByTestId("task-status")).toHaveText("已到場");
  const records = page.getByRole("article", { name: /回報證據：/ });
  for (const record of await records.all()) {
    if (
      await record
        .getByRole("button", { name: "確認屬實", exact: true })
        .count()
    ) {
      if (
        verdict === "rejected" &&
        (await record.getAttribute("aria-label")) === `回報證據：${reportId}`
      ) {
        await record.getByRole("textbox").fill("示範：證據與現場不符");
        await record
          .getByRole("button", { name: "確認不實", exact: true })
          .click();
      } else
        await record
          .getByRole("button", { name: "確認屬實", exact: true })
          .click();
      await expect(record.locator(".staff-verdict")).toBeVisible();
    }
  }
  const photo = page.getByRole("button", { name: "拍一張完成示意照片" });
  if (await photo.count()) await photo.click();
  await page.getByRole("button", { name: "提交完成證據" }).click();
  if ((await page.getByTestId("task-status").textContent()) === "待感測確認")
    await page.getByRole("button", { name: "示範收到清空回傳" }).click();
  await expect(page.getByTestId("task-status")).toHaveText("處理完成");
  await page.goto(citizenUrl);
}
