import { useCallback, useMemo, useRef, useState } from "react";
import {
  demoBounds,
  distanceMeters,
  existingBins,
  initialPoint,
  inDemoBounds,
  nearestBin,
  proposalStatusLabels,
  remainingProposals,
  voteTotals,
  type ParticipationAction,
  type ParticipationState,
  type Point,
} from "../data/participation";
import { LocationMap } from "../map/LocationMap";
const ignoreBin = () => {};
export function ParticipationPage({
  state,
  act,
  loggedIn,
  page,
  id,
}: {
  state: ParticipationState;
  act: (
    action: ParticipationAction,
    loggedIn: boolean,
  ) => Promise<string | null>;
  loggedIn: boolean;
  page: string;
  id?: string;
}) {
  const [selectedId, setSelectedId] = useState(
    id ||
      (page === "vote-progress"
        ? state.proposals.find((p) => p.mine || p.vote)?.id
        : state.proposals[0]?.id),
  );
  const [feedback, setFeedback] = useState("");
  const [creating, setCreating] = useState(false);
  const createId = useRef(crypto.randomUUID());
  const [point, setPoint] = useState<Point>(initialPoint);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [outcomeReason, setOutcomeReason] = useState("");
  const [binName, setBinName] = useState("");
  const [demoVotes, setDemoVotes] = useState<{
    id: string;
    support: string;
    oppose: string;
  } | null>(null);
  const proposal = state.proposals.find((p) => p.id === (id || selectedId));
  const totals = proposal && voteTotals(proposal);
  const displayedVotes =
    proposal && demoVotes?.id === proposal.id
      ? demoVotes
      : {
          id: proposal?.id || "",
          support: String(proposal?.support ?? 0),
          oppose: String(proposal?.oppose ?? 0),
        };
  const nearest = nearestBin(point, state.removedBinIds);
  const nearby = state.proposals.filter((p) => distanceMeters(point, p) <= 50);
  const mapPoints = useMemo(
    () =>
      state.proposals.map((p) => ({
        ...p,
        label: p.name,
        count: voteTotals(p).total,
      })),
    [state.proposals],
  );
  const changePoint = useCallback((value: Point) => {
    setPoint(value);
    setConfirmed(false);
  }, []);
  async function vote(choice: "support" | "oppose" | null) {
    if (!proposal) return;
    const error = await act(
      { type: "vote", id: proposal.id, vote: choice },
      loggedIn,
    );
    setFeedback(error || (choice ? "投票已儲存。" : "已撤回這一票。"));
    if (!error && page === "vote")
      window.location.hash = `vote-done/${proposal.id}`;
  }
  async function create() {
    const newId = createId.current;
    const error = await act(
      {
        type: "create",
        id: newId,
        name,
        reason,
        point,
        confirmedNearby: confirmed,
      },
      loggedIn,
    );
    setFeedback(error || "提案已建立，已投下你的支持票。");
    if (!error) window.location.hash = `vote-progress/${newId}`;
  }
  async function perform(action: ParticipationAction) {
    const error = await act(action, loggedIn);
    setFeedback(error || "展示結果已更新，未傳送外部服務。");
  }
  async function share() {
    if (!proposal) return;
    const url = `${window.location.origin}${window.location.pathname}#vote-progress/${proposal.id}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: proposal.name,
          text: "本機展示提案不會同步到其他裝置。",
          url,
        });
      else await navigator.clipboard.writeText(url);
      setFeedback("分享連結已準備；本機新增提案不會同步到其他裝置。");
    } catch {
      setFeedback(`可手動複製提案連結：${url}；本機資料不會跨裝置同步。`);
    }
  }
  return (
    <main className="page participation-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TAIPEI, TOGETHER.</span>
          <h1>
            {page === "nearby"
              ? "附近沒有桶？"
              : page === "vote"
                ? "這裡需要桶"
                : page === "vote-done"
                  ? "投票完成"
                  : "我的投票進度"}
          </h1>
          <p>讓每天走過的地方，多一點順手。</p>
        </div>
        <span className="demo-tag">B FLOW · 僅存於本瀏覽器</span>
      </div>
      <nav className="action-row" aria-label="市民參與選單">
        <a className="button secondary" href="#vote">
          要桶投票
        </a>
        <a className="button secondary" href="#vote-progress">
          我的投票進度
        </a>
        <a className="button secondary" href="#adopt">
          我的電子雞
        </a>
        <a className="button secondary" href="#nearby">
          查看缺桶情境
        </a>
      </nav>
      {id && !proposal && (
        <p role="alert">
          找不到此提案。本機新增提案不會跨裝置同步，請回投票地圖查看可用資料。
        </p>
      )}
      {feedback && (
        <p className="participation-feedback" role="status">
          {feedback}
        </p>
      )}
      {page === "vote" && (
        <section className="participation-intro">
          <p>在地圖上留下需求，或支持已有人提出的點。</p>
          <p>本月還能標 {remainingProposals(state)} 個點</p>
          <button
            className="button primary"
            disabled={!loggedIn || !remainingProposals(state)}
            onClick={() => setCreating(true)}
          >
            標一個新的點
          </button>
        </section>
      )}
      {!loggedIn && (
        <p>
          <a
            href={`#login?next=${encodeURIComponent(`${page}${id ? `/${id}` : ""}`)}`}
          >
            登入後參與
          </a>{" "}
          · 瀏覽不需登入，投票與申請須登入。
        </p>
      )}
      {(page === "vote" || page === "nearby") && (
        <section className="participation-map" aria-label="投票與選點地圖">
          <LocationMap
            locations={existingBins}
            selected={null}
            onSelect={ignoreBin}
            point={point}
            onPointChange={changePoint}
            proposalPoints={mapPoints}
            onProposalSelect={setSelectedId}
            selectedProposalId={proposal?.id}
            selectionBounds={demoBounds}
            removedIds={state.removedBinIds}
          />
          <p className="tiny">
            棕框為大安區示範範圍，並非行政區界。點地圖或拖曳「＋」選點。數字方塊是提案，不是既有桶。
          </p>
        </section>
      )}
      {(creating || page === "nearby") && (
        <section className="card point-form">
          <h2>{creating ? "新增設桶提案" : "選擇要查看的位置"}</h2>
          <p>
            示範範圍：緯度 {demoBounds.south}–{demoBounds.north}，經度{" "}
            {demoBounds.west}–{demoBounds.east}；不讀取真實定位。
          </p>
          <div className="coordinate-fields">
            <label>
              提案緯度
              <input
                type="number"
                step="any"
                value={Number.isNaN(point.latitude) ? "" : point.latitude}
                onChange={(e) =>
                  changePoint({
                    ...point,
                    latitude:
                      e.target.value === "" ? NaN : Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              提案經度
              <input
                type="number"
                step="any"
                value={Number.isNaN(point.longitude) ? "" : point.longitude}
                onChange={(e) =>
                  changePoint({
                    ...point,
                    longitude:
                      e.target.value === "" ? NaN : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          {!inDemoBounds(point) && (
            <p role="alert">請在大安區示範範圍內選點。</p>
          )}
          {Number.isFinite(point.latitude) &&
            Number.isFinite(point.longitude) && (
              <p role="status">
                {nearest
                  ? nearest.distance <= 300
                    ? "300 公尺內有公布桶位置。"
                    : "300 公尺內沒有公布桶位置。"
                  : "既有桶距離無資料。"}{" "}
                {nearest &&
                  `最近直線距離 ${Math.round(nearest.distance)} 公尺（非步行路線）。`}
              </p>
            )}
          {nearest && nearest.distance <= 150 && (
            <p>150 公尺內已有桶，仍可提出不同需求。</p>
          )}
          {nearest && (
            <a href={`#bin/${nearest.bin.id}`}>
              查看最近的既有桶：{nearest.bin.label}
            </a>
          )}
          {nearby.length > 0 && (
            <div className="nearby-proposals">
              <p>50 公尺內已有提案，請先查看是否為同一需求。</p>
              {nearby.map((p) => (
                <a key={p.id} href={`#vote-progress/${p.id}`}>
                  {p.name}
                </a>
              ))}
            </div>
          )}
          {page === "nearby" && (
            <a className="button primary" href="#vote">
              去投票：這裡需要桶
            </a>
          )}
          {creating && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <label>
                提案位置名稱
                <input
                  required
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                需要桶的原因
                <textarea
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {nearby.length > 0 && (
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  我已查看附近提案，仍要新增不同需求
                </label>
              )}
              <div className="action-row">
                <button
                  className="button primary"
                  disabled={
                    !loggedIn ||
                    !inDemoBounds(point) ||
                    !name.trim() ||
                    !reason.trim() ||
                    (nearby.length > 0 && !confirmed)
                  }
                >
                  確認新增提案
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setCreating(false)}
                >
                  取消新增
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      <div className="participation-grid">
        <section className="card">
          <h2>{page === "vote-progress" ? "我的提案與投票" : "市民標的點"}</h2>
          {state.proposals
            .filter(
              (p) =>
                page !== "vote-progress" || p.mine || p.vote || p.id === id,
            )
            .map((p) => (
              <button
                className="proposal-row"
                key={p.id}
                onClick={() => {
                  if (id) window.location.hash = `vote-progress/${p.id}`;
                  else setSelectedId(p.id);
                }}
                aria-label={`查看提案：${p.name}`}
                aria-pressed={proposal?.id === p.id}
              >
                <strong>{p.name}</strong>
                <span>{proposalStatusLabels[p.status]}</span>
              </button>
            ))}
        </section>
        {proposal && totals && (
          <section className="card" aria-label="選取的提案">
            <h2>{proposal.name}</h2>
            <p>{proposal.reason}</p>
            <p className="demo-tag">60 人門檻為示意 · 非人流推算</p>
            <p>
              支持 {totals.support} · 反對 {totals.oppose}
            </p>
            <p>總投票人數 {totals.total} / 60</p>
            <progress
              aria-label="投票人數進度"
              max="60"
              value={Math.min(60, totals.total)}
            />
            <p>
              支持率{" "}
              {totals.rate === null
                ? "尚無投票"
                : `${Math.round(totals.rate * 100)}%`}{" "}
              · 需至少 60%
            </p>
            <p>再 {totals.remaining} 人達人數門檻</p>
            <span className="status-pill half">
              {proposalStatusLabels[proposal.status]}
            </span>
            {proposal.status === "collecting" ? (
              <div className="action-row">
                <button
                  className="button primary"
                  disabled={!loggedIn || proposal.vote === "support"}
                  onClick={() => vote("support")}
                >
                  {proposal.vote === "oppose" ? "改投支持" : "支持設桶"}
                </button>
                <button
                  className="button secondary"
                  disabled={!loggedIn || proposal.vote === "oppose"}
                  onClick={() => vote("oppose")}
                >
                  {proposal.vote === "support" ? "改投反對" : "不要設這裡"}
                </button>
                {proposal.vote && (
                  <button
                    className="button secondary"
                    onClick={() => vote(null)}
                  >
                    撤回這一票
                  </button>
                )}
              </div>
            ) : (
              <p>這輪投票已結束，不能改票或撤票。</p>
            )}
            {proposal.outcomeReason && (
              <p>結果原因：{proposal.outcomeReason}</p>
            )}
            <ol className="proposal-steps" aria-label="設桶流程">
              <li>市民標點</li>
              <li>雙門檻投票</li>
              <li>環保局評估（示範）</li>
              <li>會勘（示範）</li>
              <li>示範設置成果</li>
            </ol>
            {proposal.status === "installed" && (
              <div className="installed-card">
                <h3>示範設置成果</h3>
                <p>示範設置成果，不代表現場已新增清潔箱。</p>
                <p>
                  {proposal.vote === "support"
                    ? "你催生了這個桶（示範）"
                    : "這個提案已完成示範設置流程。"}
                </p>
                {proposal.approvedName && (
                  <p>已核准桶名：{proposal.approvedName}</p>
                )}
                {proposal.nameStatus === "pending" && (
                  <p>命名待審：{proposal.pendingName}</p>
                )}
                {proposal.nameStatus === "returned" && (
                  <p>命名已退回，請修改後重新送出。</p>
                )}
                {proposal.mine && proposal.nameStatus !== "pending" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      perform({ type: "name", id: proposal.id, name: binName });
                    }}
                  >
                    <label>
                      為電子雞取名
                      <input
                        required
                        maxLength={30}
                        value={binName}
                        onChange={(e) => setBinName(e.target.value)}
                      />
                    </label>
                    <button
                      className="button primary"
                      disabled={!loggedIn || !binName.trim()}
                    >
                      送出命名審核
                    </button>
                  </form>
                )}
              </div>
            )}
            <div className="action-row">
              <a className="back-link" href={`#vote-progress/${proposal.id}`}>
                查看此提案進度
              </a>
              <button className="button secondary" onClick={share}>
                分享提案連結
              </button>
            </div>
            <p className="tiny">
              本機新增提案不會同步到其他裝置，連結不代表公開發布。
            </p>
            <details className="demo-controls">
              <summary>展示控制：提案評估與命名</summary>
              <p className="tiny">
                只改本機展示，不是管理後台，也未接通評分或清潔隊。
              </p>
              {proposal.status === "collecting" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    perform({
                      type: "demo-votes",
                      id: proposal.id,
                      support: Number(displayedVotes.support),
                      oppose: Number(displayedVotes.oppose),
                    });
                  }}
                >
                  <p>
                    以下只調整其他市民的示意票數，不會建立帳號或真實投票。你的這一票另計；達門檻後結束該輪投票。
                  </p>
                  <label>
                    示意其他市民支持票
                    <input
                      required
                      type="number"
                      min="0"
                      max="10000"
                      step="1"
                      value={displayedVotes.support}
                      onChange={(e) =>
                        setDemoVotes({
                          ...displayedVotes,
                          support: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    示意其他市民反對票
                    <input
                      required
                      type="number"
                      min="0"
                      max="10000"
                      step="1"
                      value={displayedVotes.oppose}
                      onChange={(e) =>
                        setDemoVotes({
                          ...displayedVotes,
                          oppose: e.target.value,
                        })
                      }
                    />
                  </label>
                  <button className="button secondary" disabled={!loggedIn}>
                    套用示意票數
                  </button>
                </form>
              )}
              <div className="action-row">
                {proposal.status === "village" && (
                  <button
                    className="button secondary"
                    disabled={!loggedIn}
                    onClick={() =>
                      perform({
                        type: "advance",
                        id: proposal.id,
                        status: "evaluation",
                        reason: "里長同意（示範）",
                      })
                    }
                  >
                    里長確認同意，送評估
                  </button>
                )}
                {proposal.status === "evaluation" && (
                  <button
                    className="button secondary"
                    disabled={!loggedIn}
                    onClick={() =>
                      perform({
                        type: "advance",
                        id: proposal.id,
                        status: "survey",
                        reason: "評估通過（示範）",
                      })
                    }
                  >
                    評估通過，進入會勘
                  </button>
                )}
                {proposal.status === "survey" && (
                  <button
                    className="button secondary"
                    disabled={!loggedIn}
                    onClick={() =>
                      perform({
                        type: "advance",
                        id: proposal.id,
                        status: "installed",
                        reason: "會勘通過（示範）",
                      })
                    }
                  >
                    會勘通過，完成示範設置
                  </button>
                )}
              </div>
              {["village", "evaluation", "survey"].includes(
                proposal.status,
              ) && (
                <div>
                  <label>
                    未通過原因
                    <textarea
                      value={outcomeReason}
                      maxLength={500}
                      onChange={(e) => setOutcomeReason(e.target.value)}
                    />
                  </label>
                  <button
                    className="button secondary"
                    disabled={!loggedIn || !outcomeReason.trim()}
                    onClick={() =>
                      perform({
                        type: "advance",
                        id: proposal.id,
                        status: "declined",
                        reason: outcomeReason,
                      })
                    }
                  >
                    標記未通過
                  </button>
                </div>
              )}
              {proposal.nameStatus === "pending" && (
                <div className="action-row">
                  <button
                    className="button secondary"
                    disabled={!loggedIn}
                    onClick={() =>
                      perform({
                        type: "review-name",
                        id: proposal.id,
                        approve: true,
                      })
                    }
                  >
                    核准命名
                  </button>
                  <button
                    className="button secondary"
                    disabled={!loggedIn}
                    onClick={() =>
                      perform({
                        type: "review-name",
                        id: proposal.id,
                        approve: false,
                      })
                    }
                  >
                    退回命名
                  </button>
                </div>
              )}
            </details>
          </section>
        )}
      </div>
      <section className="card participation-adoption-link">
        <h2>一起照顧附近的電子雞</h2>
        <p>投票提案仍需評估；你也可以先認養既有公布桶位置。</p>
        <a className="button secondary" href="#adopt">
          挑選既有桶認養
        </a>
      </section>
    </main>
  );
}
