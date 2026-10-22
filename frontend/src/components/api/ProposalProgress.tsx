import type { Proposal } from "../../data/api";

export function ProposalProgress({ item }: { item: Proposal }) {
  const current =
    item.status === "installed"
      ? 3
      : ["village", "evaluation", "survey"].includes(item.status)
        ? 2
        : 1;
  return (
    <section
      className="proposal-flow-progress"
      aria-label={`設桶進度：${item.name}`}
    >
      <div className="crew-between">
        <strong>
          {item.status === "declined"
            ? "本次提案未通過"
            : `第 ${current + 1} / 4 步`}
        </strong>
        <span>
          支持 {item.support} · 反對 {item.oppose}
        </span>
      </div>
      <ol>
        {["建議點", "市民投票", "評估與會勘", "設置上線"].map(
          (label, index) => (
            <li
              key={label}
              aria-current={
                index === current && item.status !== "declined"
                  ? "step"
                  : undefined
              }
              data-complete={index < current}
            >
              <span>{index + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      <p>
        {item.status === "installed"
          ? item.is_demo
            ? "你支持的點位已進入設置階段。"
            : "提案已完成設置流程，請以點位狀態為準。"
          : item.status === "declined"
            ? item.outcome_reason || "依本機審查結果停止本次提案。"
            : item.status === "collecting"
              ? item.is_demo
                ? `門檻：60 人參與，目前 ${item.total_votes} 人；仍須評估與現勘。`
                : `目前 ${item.total_votes} 人參與，關票規則以伺服器為準。`
              : item.status === "village"
                ? "里辦評議中，尚未核准設置。"
                : item.status === "survey"
                  ? "現場會勘中，尚未設桶。"
                  : "環保局評估中，尚未設桶。"}
      </p>
    </section>
  );
}
