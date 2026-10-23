// 設桶投票的計票規則：完全照後端 backend/app/modules/participation.py:66-67。
// 總人數滿 60 人就關票；支持×100 ≥ 總人數×60 送環保局評估，否則改由里長確認。
// 顯示用百分比＝支持÷總人數，兩邊加總 100；未達門檻時不得顯示成 60%（例如 25:17 顯示 59%）。
export const VOTE_MIN_VOTERS = 60;
export const VOTE_PASS_PERCENT = 60;
export type VoteStage = "collecting" | "evaluation" | "village";
export type VoteSide = "support" | "oppose";

export function judgeVotes(support: number, oppose: number): VoteStage {
  const total = support + oppose;
  if (total < VOTE_MIN_VOTERS) return "collecting";
  return support * 100 >= total * VOTE_PASS_PERCENT ? "evaluation" : "village";
}
export function votePassing(support: number, oppose: number) {
  const total = support + oppose;
  return total > 0 && support * 100 >= total * VOTE_PASS_PERCENT;
}
/** [支持%, 不支持%]，0 票時 null。四捨五入後再夾住：兩邊都有票時 1–99，門檻兩側不越界。 */
export function votePercent(
  support: number,
  oppose: number,
): [number, number] | null {
  const total = support + oppose;
  if (!total) return null;
  let s = Math.round((support * 100) / total);
  if (support > 0 && oppose > 0) s = Math.min(99, Math.max(1, s));
  const pass = votePassing(support, oppose);
  if (!pass && s >= VOTE_PASS_PERCENT) s = VOTE_PASS_PERCENT - 1;
  if (pass && s < VOTE_PASS_PERCENT) s = VOTE_PASS_PERCENT;
  return [s, 100 - s];
}
/** 地圖建議點標記下方的小牌：投票中「支持 95%」／「還沒人投」，關票後寫結果。 */
export function voteMarkerLabel(
  support: number,
  oppose: number,
  status?: string,
) {
  if (status === "evaluation") return "評估中";
  if (status === "village") return "里長確認中";
  const p = votePercent(support, oppose);
  return p ? `支持 ${p[0]}%` : "還沒人投";
}
