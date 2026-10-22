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
  const current =
    item?.status === "installed"
      ? 3
      : item && ["village", "evaluation", "survey"].includes(item.status)
        ? 2
        : 1;
  const stages = ["建議點", "市民投票", "環保局會勘", "新桶上線"];
  const shareUrl = new URL(window.location.href);
  shareUrl.hash = item ? `bin/${item.bin_id}?tab=vote` : "vote";
  const lineHref = `https://social-plugins.line.me/lineit/share?${new URLSearchParams({ url: shareUrl.href, text: item ? `一起支持「${item.approved_name || item.name}」設置 BinU！` : "一起支持設置 BinU！" })}`;
  const installedPath = "/me/votes?limit=100&offset=0";
  const installed = useApi(session ? installedPath : null, (signal) =>
    request<import("../../data/api").PageData<Proposal>>(installedPath, {
      signal,
      token: session?.access_token,
    }),
  );
  const newBin =
    item?.status === "installed"
      ? item
      : installed.data?.items.find(
          (p) => p.status === "installed" && p.my_vote === "support",
        );
  return (
    <main className="page api-narrow vote-done-page">
      <header className="vote-done-heading">
        <a className="vote-done-back" href={back} aria-label="返回設置點">
          ←
        </a>
        <h1>{supported ? "你投了支持票" : "投票進度"}</h1>
      </header>
      <LoadState {...detail} />
      {item && (
        <>
          <section className="card vote-done-summary" aria-label="投票結果">
            <h2>{item.approved_name || item.name}</h2>
            <strong className="vote-done-total">
              支持 {item.support} · 不支持 {item.oppose}
            </strong>
            <p>
              {item.status === "collecting"
                ? demo
                  ? `再 ${Math.max(0, 60 - item.total_votes)} 人參與，分享給親朋好友一起投`
                  : "分享給親朋好友一起投"
                : item.status === "declined"
                  ? "此提案未通過"
                  : "進度已更新，謝謝你的參與"}
            </p>
            <a
              className="button primary line-share"
              href={lineHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              分享到 LINE
            </a>
          </section>
          <section
            className="card vote-done-process"
            aria-label="從投票到設桶的進度"
          >
            <div className="crew-between">
              <h2>從投票到設桶</h2>
              <span>第 {current + 1} / 4 步</span>
            </div>
            <ol className="vote-done-timeline">
              {stages.map((label, index) => (
                <li
                  key={label}
                  className={
                    index < current || item.status === "installed"
                      ? "is-complete"
                      : index === current
                        ? "is-current"
                        : "is-waiting"
                  }
                  aria-current={index === current ? "step" : undefined}
                >
                  <span className="vote-done-step-dot" aria-hidden="true">
                    {index < current || item.status === "installed" ? "✓" : ""}
                  </span>
                  <div>
                    <strong>{label}</strong>
                    <p>
                      {index === 0
                        ? "由系統推薦缺桶位置"
                        : index === 1
                          ? demo
                            ? `${item.total_votes} / 60 人參與`
                            : `${item.total_votes} 人參與`
                          : index === 2
                            ? "評估需求與場地條件"
                            : "通知你「新桶上線」"}
                    </p>
                    {demo && index === 1 && item.status === "collecting" && (
                      <progress
                        aria-label="投票參與進度"
                        value={Math.min(item.total_votes, 60)}
                        max={60}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {newBin ? (
            <aside className="vote-done-note">
              <Mascot />
              <div>
                <strong>新桶上線！因為你的參與，市民生活更方便</strong>
                <p>{newBin.approved_name || newBin.name}</p>
              </div>
            </aside>
          ) : (
            <aside className="vote-done-note">
              <Mascot />
              <div>
                <strong>一起讓生活更方便</strong>
                <p>新桶上線後，會通知你最新進度。</p>
              </div>
            </aside>
          )}
        </>
      )}
      <div className="vote-done-cta">
        <a className="button secondary" href={wasteHref("map", wasteType)}>
          回到地圖
        </a>
        <a className="button primary" href="#vote/votes">
          看投票紀錄
        </a>
      </div>
    </main>
  );
}
