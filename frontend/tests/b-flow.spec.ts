import { reviewAsStaff } from "./staff-helpers";
import { test, expect } from "@playwright/test";
test.use({ actionTimeout: 10000 });

test("P11 votes count people, support changes and withdrawal survive reload", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#login?next=vote");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(
    page.getByRole("heading", { name: "這裡需要桶", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "查看提案：信義路三段 × 新生南路口" })
    .click();
  const detail = page.getByRole("region", { name: "選取的提案" });
  await expect(detail).toContainText("總投票人數 49 / 60");
  await detail.getByRole("button", { name: "支持設桶", exact: true }).click();
  await page.getByRole("link", { name: "查看此提案進度", exact: true }).click();
  await expect(page.getByRole("region", { name: "選取的提案" })).toContainText(
    "總投票人數 50 / 60",
  );
  await expect(page.getByRole("region", { name: "選取的提案" })).toContainText(
    "支持率 94%",
  );
  await page.getByRole("button", { name: "改投反對", exact: true }).click();
  await expect(page.getByRole("region", { name: "選取的提案" })).toContainText(
    "總投票人數 50 / 60",
  );
  await expect(
    page.getByRole("button", { name: "改投支持", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "改投支持", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "撤回這一票", exact: true }).click();
  await expect(page.getByRole("region", { name: "選取的提案" })).toContainText(
    "總投票人數 49 / 60",
  );
});

test("a newly created proposal can demonstrate qualifying community votes through installation", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#login?next=vote");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.getByRole("button", { name: "標一個新的點", exact: true }).click();
  await page.getByLabel("提案位置名稱").fill("新提案完整流程");
  await page.getByLabel("需要桶的原因").fill("測試新提案也能走完展示流程。");
  await page.getByLabel("提案緯度").fill("25.02");
  await page.getByLabel("提案經度").fill("121.56");
  await page.getByRole("button", { name: "確認新增提案", exact: true }).click();
  await page.getByText("展示控制：提案評估與命名", { exact: true }).click();
  await expect(page.getByLabel("示意其他市民支持票")).toBeVisible();
  await page.getByLabel("示意其他市民支持票").fill("59");
  await page.getByLabel("示意其他市民反對票").fill("0");
  await page.getByRole("button", { name: "套用示意票數", exact: true }).click();
  const detail = page.getByRole("region", { name: "選取的提案" });
  await expect(detail).toContainText("總投票人數 60 / 60");
  await expect(detail).toContainText("送評估");
  await page.getByRole("button", { name: "評估通過，進入會勘" }).click();
  await page.getByRole("button", { name: "會勘通過，完成示範設置" }).click();
  await expect(page.getByLabel("為電子雞取名")).toBeVisible();
});

test("a final report allows a new event and retains both awards across reload", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#login");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.locator(".location-row").first().click();
  const binUrl = page.url();
  for (let index = 0; index < 2; index++) {
    await page.goto(binUrl.replace("#bin/", "#report/") + "?demo=1");
    await page
      .getByRole("button", { name: "桶旁有堆放", exact: false })
      .click();
    await page.getByRole("button", { name: "拍一張示意照片" }).click();
    await page.getByLabel("示意定位情境").selectOption("near");
    await page.getByRole("button", { name: "送出示範回報" }).click();
    await page
      .getByRole("link", { name: "看審核結果", exact: true })
      .first()
      .click();
    await reviewAsStaff(page, "approved");
    await page.reload();
    await expect(
      page.getByText(`可用點數 ${64 + index}`, { exact: true }),
    ).toBeVisible();
  }
  await page.goto("/tests/legacy/index.html#member");
  await expect(page.locator(".report-history li")).toHaveCount(2);
});

test("a new event requires a fresh photo and proximity check without reloading the app", async ({
  page,
  isMobile,
}) => {
  await page.goto("/tests/legacy/index.html#login");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page.locator(".location-row").first().click();
  await page.getByRole("link", { name: "回報問題", exact: true }).click();
  if (!isMobile)
    await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
  await page.getByRole("button", { name: "很髒", exact: false }).click();
  await page.getByRole("button", { name: "拍一張示意照片" }).click();
  await page.getByLabel("示意定位情境").selectOption("near");
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await page
    .getByRole("link", { name: "看審核結果", exact: true })
    .first()
    .click();
  await reviewAsStaff(page, "approved");
  await page.getByRole("link", { name: "查看這個桶", exact: true }).click();
  await page.getByRole("link", { name: "回報問題", exact: true }).click();
  if (!isMobile)
    await page.getByRole("link", { name: "在電腦體驗示範回報" }).click();
  await page.getByRole("button", { name: "很髒", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "拍一張示意照片", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("示意定位情境")).toHaveValue("unchecked");
});

test("P14 approval grants A/B adopter rewards and ending adoption preserves submitted eligibility", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#login?next=adopt");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await expect(
    page.getByRole("heading", { name: "我的電子雞", exact: true }),
  ).toBeVisible();
  await page.getByLabel("認養者公開名稱").fill("巷口日常小隊");
  await page.getByRole("button", { name: "送出認養申請", exact: true }).click();
  const application = page.getByRole("article", { name: /認養申請：/ }).first();
  await expect(application).toContainText("待審");
  await application.getByText("展示控制：認養審批", { exact: true }).click();
  await application
    .getByRole("button", { name: "核准認養", exact: true })
    .click();
  await expect(application).toContainText("認養中");
  await application
    .getByRole("link", { name: "查看這個桶", exact: true })
    .click();
  await expect(
    page.getByText("認養：巷口日常小隊", { exact: true }),
  ).toBeVisible();
  await page.goto("/tests/legacy/index.html#adopt");
  await application
    .getByRole("link", { name: "一鍵通報附近清潔隊", exact: true })
    .click();
  await page.getByRole("button", { name: "桶旁有堆放", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "送出示範回報" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "拍一張示意照片" }).click();
  await page.getByLabel("示意定位情境").selectOption("near");
  await page.getByRole("button", { name: "送出示範回報" }).click();
  await expect(
    page.getByRole("heading", { name: "快捷通報已受理（示範）" }),
  ).toBeVisible();
  await expect(page.locator(".done-points")).toHaveText("+2");
  await expect(page).toHaveURL(/#report-done\//);
  const doneUrl = page.url();
  await page.goto("/tests/legacy/index.html#adopt");
  await application
    .getByRole("button", { name: "結束認養", exact: true })
    .click();
  await page.getByRole("button", { name: "確認結束認養", exact: true }).click();
  await expect(application).toContainText("已結束");
  await page.goto(doneUrl);
  await page
    .getByRole("link", { name: "看審核結果", exact: true })
    .first()
    .click();
  await reviewAsStaff(page, "approved");
  await expect(page.getByText("可用點數 65", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("可用點數 65", { exact: true })).toBeVisible();
});

test("P13 freezes a qualifying vote and advances review, survey and naming without creating real bins", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#login?next=vote");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  const proposal = page.getByRole("button", {
    name: "查看提案：和平東路示範提案",
  });
  await expect(proposal).toBeVisible();
  await proposal.click();
  await page.getByRole("button", { name: "支持設桶", exact: true }).click();
  await page.getByRole("link", { name: "查看此提案進度", exact: true }).click();
  const detail = page.getByRole("region", { name: "選取的提案" });
  await expect(detail).toContainText("總投票人數 60 / 60");
  await expect(detail).toContainText("支持率 60%");
  await expect(detail).toContainText("送評估");
  await expect(page.getByRole("button", { name: "撤回這一票" })).toHaveCount(0);
  await page.getByText("展示控制：提案評估與命名", { exact: true }).click();
  await page.getByRole("button", { name: "評估通過，進入會勘" }).click();
  await page.getByRole("button", { name: "會勘通過，完成示範設置" }).click();
  await expect(detail).toContainText("示範設置成果，不代表現場已新增清潔箱。");
  await page.getByLabel("為電子雞取名").fill("巷口順順");
  await page.getByRole("button", { name: "送出命名審核" }).click();
  await expect(detail).toContainText("命名待審：巷口順順");
  await page.getByRole("button", { name: "核准命名" }).click();
  await expect(detail).toContainText("已核准桶名：巷口順順");
  await page.reload();
  await expect(detail).toContainText("已核准桶名：巷口順順");
  await page.goto("/tests/legacy/index.html#map");
  await expect(page.locator(".location-row")).toHaveCount(47);
  await expect(
    page.getByText("681 公布桶位置 ＋ 130 場所代表點", { exact: false }),
  ).toBeVisible();
});

test("P11 creates a proposal with its first vote, warns about nearby points and enforces monthly quota", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-31T15:59:00.000Z") });
  await page.goto("/tests/legacy/index.html#login?next=vote");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  for (let index = 0; index < 3; index++) {
    await page
      .getByRole("button", { name: "標一個新的點", exact: true })
      .click();
    await page.getByLabel("提案位置名稱").fill(`巷口需求 ${index + 1}`);
    await page
      .getByLabel("需要桶的原因")
      .fill("這段人行道需要隨手垃圾的去處。");
    await page.getByLabel("提案緯度").fill("25.033");
    await page.getByLabel("提案經度").fill("121.5358");
    await expect(
      page.getByText("50 公尺內已有提案，請先查看是否為同一需求。"),
    ).toBeVisible();
    await page.getByLabel("我已查看附近提案，仍要新增不同需求").check();
    await page
      .getByRole("button", { name: "確認新增提案", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "選取的提案" }),
    ).toContainText("總投票人數 1 / 60");
    await page
      .getByRole("navigation", { name: "市民參與選單", exact: true })
      .getByRole("link", { name: "要桶投票", exact: true })
      .click();
  }
  await expect(
    page.getByText("本月還能標 0 個點", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "標一個新的點", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByText("本月還能標 0 個點", { exact: true }),
  ).toBeVisible();
  await page.clock.setSystemTime(new Date("2026-10-31T16:01:00.000Z"));
  await page.reload();
  await expect(
    page.getByText("本月還能標 3 個點", { exact: true }),
  ).toBeVisible();
});

test("P10 uses existing bins and rejects invalid points while retaining a non-map input", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#nearby");
  const { default: snapshot } = await import("../src/data/locations.json", {
    with: { type: "json" },
  });
  // A published coordinate is an independent distance-zero reference, including full/unknown bins.
  const published = snapshot.find(
    (p) =>
      p.kind === "bin" &&
      [...p.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 19 !== 0,
  )!;
  await page.getByLabel("提案緯度").fill(String(published.latitude));
  await page.getByLabel("提案經度").fill(String(published.longitude));
  await expect(
    page.getByText("300 公尺內有公布桶位置。", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("最近直線距離 0 公尺", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("提案緯度").fill("");
  await expect(page.getByRole("alert")).toContainText(
    "請在大安區示範範圍內選點",
  );
});

test("proposal selection highlights its marker and choosing coordinates preserves zoom", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#login?next=vote");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page
    .getByRole("button", { name: "查看提案：和平東路示範提案" })
    .click();
  const selected = page.locator('.proposal-marker[aria-pressed="true"]');
  await expect(selected).toHaveAttribute("title", "提案：和平東路示範提案");
  await page.getByRole("button", { name: "標一個新的點", exact: true }).click();
  const scale = page.locator(".leaflet-control-scale-line");
  const initialScale = await scale.innerText();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(scale).not.toHaveText(initialScale);
  const zoomedScale = await scale.innerText();
  await page.getByLabel("提案緯度").fill("25.034");
  await expect(scale).toHaveText(zoomedScale);
});

test("P13 low support requires village confirmation and declining requires a reason", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#login?next=vote");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  await page
    .getByRole("button", { name: "查看提案：市民大道示範提案" })
    .click();
  await page.getByRole("button", { name: "不要設這裡", exact: true }).click();
  await page.getByRole("link", { name: "查看此提案進度", exact: true }).click();
  const detail = page.getByRole("region", { name: "選取的提案" });
  await expect(detail).toContainText("需里長確認");
  await expect(detail).toContainText("總投票人數 60 / 60");
  await page.getByText("展示控制：提案評估與命名", { exact: true }).click();
  await expect(page.getByRole("button", { name: "標記未通過" })).toBeDisabled();
  await page
    .getByLabel("未通過原因", { exact: true })
    .fill("此處尚需交通安全評估（示範）。");
  await page.getByRole("button", { name: "標記未通過" }).click();
  await expect(detail).toContainText("此處尚需交通安全評估（示範）。");
  await page.reload();
  await expect(detail).toContainText("未通過");
  await expect(
    page.getByRole("button", { name: "支持設桶", exact: true }),
  ).toHaveCount(0);
});

test("P15 withdrawal, rejection and removal preserve history and do not grant adoption early", async ({
  page,
}) => {
  await page.goto("/tests/legacy/index.html#login?next=adopt");
  await page.getByRole("button", { name: "用台北通登入（示範）" }).click();
  const chosen = await page.getByLabel("要認養的桶").inputValue();
  async function apply() {
    await page.getByLabel("要認養的桶").selectOption(chosen);
    await page.getByLabel("認養者公開名稱").fill("居民小隊");
    await page
      .getByRole("button", { name: "送出認養申請", exact: true })
      .click();
  }
  await apply();
  const records = page.getByRole("article", { name: /認養申請：/ });
  await expect(records.first()).toContainText("待審");
  await expect(
    page.getByRole("link", { name: "一鍵通報附近清潔隊" }),
  ).toHaveCount(0);
  await records
    .first()
    .getByRole("button", { name: "撤回申請", exact: true })
    .click();
  await page.getByRole("button", { name: "確認撤回申請" }).click();
  await expect(records.first()).toContainText("已撤回");
  await apply();
  await records
    .first()
    .getByText("展示控制：認養審批", { exact: true })
    .click();
  await records
    .first()
    .getByLabel("認養未通過原因")
    .fill("請補充認養者名稱（示範）。");
  await records.first().getByRole("button", { name: "不核准認養" }).click();
  await expect(records.first()).toContainText("未通過");
  await apply();
  await records
    .first()
    .getByText("展示控制：認養審批", { exact: true })
    .click();
  await records
    .first()
    .getByRole("button", { name: "核准認養", exact: true })
    .click();
  await expect(records.first()).toContainText("認養中");
  await expect(records.first().getByRole("checkbox")).toHaveCount(3);
  for (const checkbox of await records.first().getByRole("checkbox").all())
    await checkbox.uncheck();
  await expect(records.first()).toContainText("你已關閉全部桶況通知。");
  await records.first().getByText("展示控制：桶移除", { exact: true }).click();
  await records
    .first()
    .getByRole("button", { name: "移除此桶（示範）" })
    .click();
  await expect(records).toHaveCount(3);
  await expect(records.first()).toContainText("桶已移除（示範）");
  await page.reload();
  await expect(records).toHaveCount(3);
  await page.goto(`/tests/legacy/index.html#quick-report/${chosen}`);
  await expect(
    page.getByRole("heading", { name: "這個桶已撤除（示意）" }),
  ).toBeVisible();
});
