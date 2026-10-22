import { request, type Proposal } from "../../data/api";
import { useDemoData } from "../../data/demoMode";
import { wasteHref, type WasteType } from "../../data/waste";
import { Mascot } from "../Mascot";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";

export function ProposalVoteDone({
  id,
  fromProposal,
  wasteType,
}: {
  id: string;
  fromProposal: boolean;
  wasteType: WasteType;
}) {
  const { session } = useSession();
  const demo = useDemoData(session?.access_token);
  const path = `/proposals/${encodeURIComponent(id)}`;
  const detail = useApi(
    path,
    (signal) =>
      request<Proposal>(path, {
        signal,
        token: session?.access_token,
      }),
    true,
    { stopOnNotFound: true },
  );
  const item = detail.data;
  const supported = item?.my_vote === "support";
  const back = fromProposal
    ? `#proposals/${id}`
    : item
      ? wasteHref(`bin/${item.bin_id}`, wasteType)
      : wasteHref("map", wasteType);
  const stages = item
    ? [
        { label: "建議點建立", note: "已建立建議設置點", state: "marked" },
        {
          label: "累積投票",
          note: `支持 ${item.support} · 反對 ${item.oppose}`,
          state: "collecting",
        },
        ...(item.status === "village"
          ? [
              {
                label: "里辦評議",
                note: "由里辦進一步確認需求",
                state: "village",
              },
            ]
          : []),
        {
          label: "環保局評估",
          note: "依需求與場地條件評估",
          state: "evaluation",
        },
        { label: "現場會勘", note: "確認位置與設置可行性", state: "survey" },
        {
          label: "設置完成",
          note: demo ? "以點位進度為準" : "以審查及點位狀態為準",
          state: "installed",
        },
      ]
    : [];
  const current = stages.findIndex((stage) => stage.state === item?.status);
  return (
    <main className="page vote-done-page">
      <header className="vote-done-heading">
        <a
          className="vote-done-back"
          href={back}
          aria-label={fromProposal ? "返回提案" : "返回設置點"}
        >
          ←
        </a>
        <h1>
          {item
            ? supported
              ? "你支持了這個點"
              : "這個點的投票進度"
            : "投票結果"}
        </h1>
      </header>
      <LoadState {...detail} />
      {item && (
        <>
          <section className="card vote-done-summary" aria-label="投票結果">
            <h2>{item.approved_name || item.name}</h2>
            <p className="vote-done-count numeral-lg">
              {demo ? (
                <>
                  {item.total_votes} / 60 <span>人參與</span>
                </>
              ) : (
                <>
                  支持 {item.support} <span>票</span>
                </>
              )}
            </p>
            <p>
              支持 {item.support} · 反對 {item.oppose}
            </p>
            {demo && item.status === "collecting" && (
              <p>
                再 {Math.max(0, 60 - item.total_votes)}{" "}
                人參與後，依支持率進入評估或里辦評議。
              </p>
            )}
            {item.status === "declined" && (
              <p>
                此提案未通過
                {item.outcome_reason
                  ? `：${item.outcome_reason}`
                  : "，以審查結果為準。"}
              </p>
            )}
            <p className="tiny">
              {demo ? "票數，未送交環保局。" : "票數及審查狀態由伺服器提供。"}
            </p>
          </section>
          <section
            className="card vote-done-process"
            aria-labelledby="vote-done-process-title"
          >
            <h2 id="vote-done-process-title">從投票到設桶</h2>
            <ol className="vote-done-timeline">
              {stages.map((stage, i) => {
                const complete =
                  i === 0 ||
                  (current >= 0 &&
                    (i < current || item.status === "installed"));
                const active = i === current && item.status !== "installed";
                return (
                  <li
                    key={stage.state}
                    className={
                      complete
                        ? "is-complete"
                        : active
                          ? "is-current"
                          : "is-waiting"
                    }
                    aria-current={active ? "step" : undefined}
                  >
                    <span className="vote-done-step-dot" aria-hidden="true">
                      {complete ? "✓" : ""}
                    </span>
                    <div>
                      <strong>{stage.label}</strong>
                      <p>
                        {complete ? "已完成" : active ? "進行中" : ""}
                        {stage.note}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
          <aside className="vote-done-note">
            <Mascot state="hungry" />
            <div>
              <strong>{supported ? "你的支持已記錄" : "投票狀態已更新"}</strong>
              <p>設置仍須經審查與現勘，投票不代表已核准設桶。</p>
            </div>
          </aside>
        </>
      )}
      <div className="vote-done-cta">
        <a className="button primary" href={wasteHref("map", wasteType)}>
          回到地圖
        </a>
      </div>
    </main>
  );
}
