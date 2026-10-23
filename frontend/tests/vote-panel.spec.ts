import { test, expect, type Page } from "@playwright/test";
import { apiFixture, envelope, location, status } from "./api-fixtures";
import { proposal } from "./api-engagement-fixture";

// 設桶投票面板（設計定案稿 vote-panel-v12）：地圖抽屜裡的建議點。
// 計票照後端：滿 60 人關票；支持×100 ≥ 總人數×60 送評估。百分比未達門檻不得顯示 60%。
const binId = "20000000-0000-4000-8000-0000000000b1";
const pid = "71000000-0000-4000-8000-0000000000b1";
const name = "信義路／新生南路2段";
const proposed = {
  ...location,
  id: binId,
  label: name,
  bin_type: "proposed",
  placement_status: "proposed",
  bin_status: null,
  compartments: [],
};
const route = `bin/${binId}?tab=vote&waste_type=general`;

async function setup(
  page: Page,
  start: [number, number],
  my: "support" | "oppose" | null = null,
  closed = false,
) {
  await page.setViewportSize({ width: 412, height: 780 });
  const state = {
    support: start[0],
    oppose: start[1],
    my,
    status: closed ? "evaluation" : "collecting",
    closedAt: closed ? "2026-10-23T05:00:00Z" : (null as string | null),
    votes: [] as (string | null)[],
  };
  const current = (token: string) => ({
    ...proposal,
    id: pid,
    bin_id: binId,
    name,
    mine: false,
    support: state.support,
    oppose: state.oppose,
    total_votes: state.support + state.oppose,
    support_ratio:
      state.support + state.oppose
        ? state.support / (state.support + state.oppose)
        : null,
    my_vote: token ? state.my : null,
    status: state.status,
    voting_closed_at: state.closedAt,
  });
  await apiFixture(page, async (r, path) => {
    const token = r.request().headers().authorization || "";
    if (path === "/map/locations") {
      await r.fulfill({ json: envelope([proposed]) });
      return true;
    }
    if (path === "/proposals") {
      await r.fulfill({ json: envelope([current(token)]) });
      return true;
    }
    if (path === `/proposals/${pid}`) {
      await r.fulfill({ json: current(token) });
      return true;
    }
    if (path === `/proposals/${pid}/vote`) {
      const vote = r.request().postDataJSON().vote;
      state.votes.push(vote);
      if (state.my === "support") state.support--;
      if (state.my === "oppose") state.oppose--;
      state.my = vote;
      if (vote === "support") state.support++;
      if (vote === "oppose") state.oppose++;
      const total = state.support + state.oppose;
      if (total >= 60) {
        state.status =
          state.support * 100 >= total * 60 ? "evaluation" : "village";
        state.closedAt = "2026-10-23T05:00:00Z";
      }
      await r.fulfill({ json: current(token) });
      return true;
    }
    if (path === `/bins/${binId}/view`) {
      await r.fulfill({
        json: {
          location: proposed,
          status,
          compartments: [],
          adopter: null,
          latest_cleanup: null,
          my_adoption_id: null,
          can_apply_adoption: false,
          can_report: false,
          report_block_reason: "login_required",
        },
      });
      return true;
    }
  });
  return state;
}
async function loginTo(page: Page, next: string) {
  await page.goto(`/#login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
}
const panel = (page: Page) => page.getByRole("region", { name: "設置點投票" });
const sides = (page: Page) =>
  page.evaluate(() =>
    [".g-side.s .n", ".g-side.o .n", ".g-center"].map(
      (s) => document.querySelector(s)?.textContent?.replace(/\s+/g, "") ?? "",
    ),
  );

test("unvoted ballot: question header with share, gauge, rule and both buttons even when logged out", async ({
  page,
}) => {
  await setup(page, [21, 1]);
  await page.goto(`/#${route}`);
  const ballot = panel(page);
  await expect(
    ballot.getByRole("heading", {
      name: "你支持在這裡放垃圾桶嗎？",
      level: 1,
    }),
  ).toBeVisible();
  await expect(ballot.locator(".mx-vote-sub")).toHaveText(name);
  const share = ballot.getByRole("button", { name: "分享這個地點" });
  const box = (await share.boundingBox())!;
  expect(box.width).toBe(44);
  expect(box.height).toBe(44);
  await expect.poll(() => sides(page)).toEqual(["95%", "5%", "還差38人"]);
  await expect(
    ballot.getByText("滿 60 人、支持 60% 以上，就會送環保局評估。"),
  ).toBeVisible();
  await expect(ballot.getByText("示意")).toHaveCount(0);
  await expect(
    ballot.getByRole("button", { name: "支持", exact: true }),
  ).toBeVisible();
  await expect(
    ballot.getByRole("button", { name: "不支持", exact: true }),
  ).toBeVisible();
  // 沒投過票：沒有回饋句、分隔線與「從投票到設桶」。
  await expect(ballot.locator(".mx-vote-after, .mx-vote-sep")).toHaveCount(0);
  // 數字用 Chakra Petch。
  expect(
    await ballot
      .locator(".g-side.s .n")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Chakra Petch");
  // 抽屜半開時兩顆投票鈕都在分頁列上方。
  const vote = (await ballot
    .getByRole("button", { name: "支持", exact: true })
    .boundingBox())!;
  const tabs = (await page.locator(".m-tabs").boundingBox())!;
  expect(vote.y + vote.height).toBeLessThanOrEqual(tabs.y);
  // 分享鈕與導航頁 ✕ 共用 .icon-button。
  await expect(share).toHaveClass(/icon-button/);
});

test("percent never shows 60% below the threshold and 0 votes shows dashes", async ({
  page,
}) => {
  await setup(page, [25, 17]);
  await page.goto(`/#${route}`);
  await expect.poll(() => sides(page)).toEqual(["59%", "41%", "還差18人"]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await setup(page, [0, 0]);
  await page.reload();
  await expect.poll(() => sides(page)).toEqual(["—", "—", "還差60人"]);
  await expect(
    panel(page).getByText("還沒有人投票，來投第一票", { exact: true }),
  ).toBeVisible();
});

test("logged out support → login carries the vote → back on the panel it is cast with animation, toast and undo", async ({
  page,
}) => {
  const state = await setup(page, [21, 1]);
  await page.goto(`/#${route}`);
  await panel(page).getByRole("button", { name: "支持", exact: true }).click();
  await expect(page).toHaveURL(/#login\?next=/);
  expect(decodeURIComponent(page.url().split("next=")[1])).toBe(
    `${route}&vote=support`,
  );
  await page.getByLabel("密碼", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  // 回來先停在舊比例，再播動畫；網址上的 ?vote= 處理後拿掉。
  await expect(page).toHaveURL(new RegExp(`#bin/${binId}`));
  await expect
    .poll(() => sides(page), { intervals: [50] })
    .toEqual(["95%", "5%", "還差38人"]);
  await expect.poll(() => sides(page)).toEqual(["96%", "4%", "還差37人"]);
  await expect(page).not.toHaveURL(/vote=support/);
  expect(state.votes).toEqual(["support"]);
  const toast = page.locator(".toast");
  await expect(toast).toContainText("投好了！你支持在這裡放桶");
  const ballot = panel(page);
  await expect(
    ballot.getByRole("button", { name: "✓ 你支持", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    ballot.getByRole("button", { name: "改投不支持", exact: true }),
  ).toBeVisible();
  await expect(ballot.getByText("已投下支持，謝謝你！")).toBeVisible();
  await expect(
    ballot.getByRole("button", { name: "邀朋友一起投", exact: true }),
  ).toBeVisible();
  await expect(
    ballot.getByRole("heading", { name: "從投票到設桶", exact: true }),
  ).toBeVisible();
  await expect(
    ballot.getByRole("link", { name: "我的投票紀錄 →", exact: true }),
  ).toHaveAttribute("href", "#vote/votes");
  await expect(ballot.locator(".mx-vote-steps li")).toHaveText([
    "1建議點",
    "2市民投票",
    "3環保局評估",
    "4設桶",
  ]);
  await expect(ballot.getByText("每走到下一步都會通知你。")).toBeVisible();
  // 復原＝撤票（vote: null）。
  await toast.getByRole("button", { name: "復原", exact: true }).click();
  await expect.poll(() => sides(page)).toEqual(["95%", "5%", "還差38人"]);
  expect(state.votes).toEqual(["support", null]);
  await expect(ballot.locator(".mx-vote-after")).toHaveCount(0);
});

test("an auto vote that fills 60 holds the result, then settles without undo", async ({
  page,
}) => {
  await setup(page, [35, 24]);
  await loginTo(page, `${route}&vote=support`);
  const ballot = panel(page);
  // 動畫播完後再停 0.7 秒才切到結局。
  await expect(ballot.getByText(/已滿/)).toBeVisible();
  await expect(ballot.getByText("投票結束，已送環保局評估")).toHaveCount(0);
  await expect(
    ballot.getByText("投票結束，已送環保局評估", { exact: true }),
  ).toBeVisible({ timeout: 4000 });
  await expect.poll(() => sides(page)).toEqual(["60%", "40%", "已滿60人"]);
  await expect(page.locator(".toast")).toContainText("你這一票讓投票結算了！");
  await expect(
    page.locator(".toast").getByRole("button", { name: "復原" }),
  ).toHaveCount(0);
  await expect(
    ballot.getByText("你這一票剛好湊滿 60 人，已送環保局評估。"),
  ).toBeVisible();
  await expect(
    ballot.getByText("滿 60 人、支持 60% 以上，就會送環保局評估。"),
  ).toHaveCount(0);
  await expect(
    ballot.getByRole("button", { name: "✓ 你支持", exact: true }),
  ).toBeDisabled();
});

test("an auto vote never silently switches sides and is not cast after the vote closed", async ({
  page,
}) => {
  const state = await setup(page, [21, 1], "oppose");
  await loginTo(page, `${route}&vote=support`);
  const ballot = panel(page);
  await expect(ballot.getByText(/你之前投了「不支持」/)).toBeVisible();
  expect(state.votes).toEqual([]);
  await ballot.getByRole("button", { name: "保留原本的票" }).click();
  await expect(
    ballot.getByRole("button", { name: "✓ 你不支持", exact: true }),
  ).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const closed = await setup(page, [40, 20], null, true);
  await page.goto(`/#${route}&vote=support`);
  await expect(page.locator(".toast")).toContainText("這票沒投出");
  expect(closed.votes).toEqual([]);
});

test("reduced motion casts the returning vote straight to the final state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page, [21, 1]);
  await loginTo(page, `${route}&vote=support`);
  await expect.poll(() => sides(page)).toEqual(["96%", "4%", "還差37人"]);
  expect(
    await page
      .locator(".mx-gauge .g-s")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await expect(page.locator(".mx-vote-plus1")).toHaveCount(0);
});

test("share falls back to a small LINE / copy / cancel menu", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    }),
  );
  await setup(page, [21, 1]);
  await page.goto(`/#${route}`);
  await panel(page).getByRole("button", { name: "分享這個地點" }).click();
  const menu = page.getByRole("dialog", { name: "分享這個地點" });
  await expect(menu.locator("a, button")).toHaveText([
    "用 LINE 分享",
    "複製連結",
    "取消",
  ]);
  const line = new URL(
    (await menu
      .getByRole("link", { name: "用 LINE 分享" })
      .getAttribute("href"))!,
  );
  expect(line.hostname).toBe("social-plugins.line.me");
  expect(line.searchParams.get("url")).toContain(`#bin/${binId}?tab=vote`);
  // Esc 先關選單，不會順便關掉投票面板。
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.locator(".mx-panel")).toHaveAttribute("data-view", "bin");
});

test("map and list use the M3 proposed pin with a support label; the tab is 設桶投票", async ({
  page,
}) => {
  await setup(page, [21, 1]);
  await page.goto("/#vote");
  await expect(
    page
      .getByRole("navigation", { name: "主要分頁" })
      .getByRole("link", { name: "設桶投票", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "設桶投票", level: 1 }),
  ).toBeVisible();
  const pin = page.locator(".leaflet-marker-icon.mx-proposed");
  await expect(pin.locator("svg.bin-bot-proposed")).toHaveCount(1);
  await expect(pin.locator(".proposal-marker-votes")).toHaveText("支持 95%");
  expect(
    await pin
      .locator(".mx-proposed-plus")
      .evaluate((el) => getComputedStyle(el).color),
  ).toBe("rgb(29, 102, 80)");
  await expect(
    page.locator(".location-row .mx-proposed-row svg.bin-bot-proposed"),
  ).toHaveCount(1);
});
