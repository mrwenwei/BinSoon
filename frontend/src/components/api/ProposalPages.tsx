import { ProposalProgress } from "./ProposalProgress";
import { useDemoData } from "../../data/demoMode";
import { useCallback, useState } from "react";
import {
  ApiError,
  query,
  request,
  time,
  type Availability,
  type PageData,
  type Position,
  type Proposal,
  type ProposalCreated,
  type ProposalQuota,
} from "../../data/api";
import { districts } from "../../data/locations";
import { LocationMap } from "../../map/LocationMap";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { Pagination } from "./Pagination";
import { useCommand, CommandFeedback } from "./Commands";
import { ProposalNaming } from "./ProposalNaming";
import { useProposalDraft } from "./ProposalDraft";

const labels: Record<Proposal["status"], string> = {
  collecting: "收集中",
  village: "里辦評議",
  evaluation: "評估中",
  survey: "現勘中",
  installed: "示範設置",
  declined: "未通過",
};
const voteOptions = [
  { vote: "support", label: "支持", commandLabel: "支持提案" },
  { vote: "oppose", label: "反對", commandLabel: "反對提案" },
  { vote: null, label: "撤票", commandLabel: "撤回投票" },
] as const;
export function ProposalLinks({
  votingHistory = false,
}: {
  votingHistory?: boolean;
}) {
  return (
    <nav className="api-pagination" aria-label="提案導覽">
      <a href="#vote">建議點地圖</a>
      <a href="#vote/all">全部提案</a>
      {!votingHistory && <a href="#vote/create">建立提案</a>}
      {!votingHistory && <a href="#vote/mine">我的提案</a>}
      <a href="#vote/votes">我的投票</a>
    </nav>
  );
}
export function ProposalSummary({ item }: { item: Proposal }) {
  return (
    <>
      <h2>{item.approved_name || item.name}</h2>
      <p>
        {labels[item.status]} · {item.is_demo ? "DEMO · " : ""}
        {item.district}
      </p>
      <p>{item.reason}</p>
      <p>
        支持 {item.support} · 反對 {item.oppose} · 投票人數 {item.total_votes}
      </p>
      <p>
        支持率{" "}
        {item.support_ratio === null
          ? "無資料"
          : `${Math.round(item.support_ratio * 1000) / 10}%`}
      </p>
      <p>
        我的票：
        {item.my_vote === "support"
          ? "支持"
          : item.my_vote === "oppose"
            ? "反對"
            : "尚未投票"}
      </p>
    </>
  );
}
export function ProposalList({
  mode = "all",
  admin = false,
}: {
  mode?: "all" | "mine" | "votes";
  admin?: boolean;
}) {
  const { session } = useSession();
  const [district, setDistrict] = useState("大安區");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const path = query(
    mode === "all"
      ? "/proposals"
      : `/me/${mode === "mine" ? "proposals" : "votes"}`,
    {
      limit: 20,
      offset,
      ...(mode === "all" ? { district, ...(status ? { status } : {}) } : {}),
    },
  );
  const list = useApi(
    path,
    (signal) =>
      request<PageData<Proposal>>(path, {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  return (
    <main className="page api-narrow">
      <h1>
        {mode === "all"
          ? "要桶投票"
          : mode === "mine"
            ? "我的提案"
            : "投票紀錄"}
      </h1>
      <ProposalLinks votingHistory={mode === "votes"} />
      <p>
        {useDemoData(session?.access_token)
          ? "提案與票數為本機展示；投票通過仍不代表獲准設桶或已完成現勘。"
          : "提案仍須現勘；票數與關票狀態由伺服器決定，投票通過不代表已設置。"}
      </p>
      {mode === "all" && (
        <div className="card api-form">
          <label>
            行政區
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setOffset(0);
              }}
            >
              {districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            提案狀態
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">全部狀態</option>
              {Object.entries(labels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <button
        className="button secondary"
        disabled={list.loading}
        onClick={list.reload}
      >
        更新提案
      </button>
      <LoadState {...list} />
      <ul className="api-items">
        {list.data?.items.map((item) => (
          <li className="card" key={item.id}>
            <ProposalSummary item={item} />
            {mode === "votes" && <ProposalProgress item={item} />}
            <a
              href={
                admin ? `#admin/proposals/${item.id}` : `#proposals/${item.id}`
              }
            >
              {admin ? "審查此提案" : "查看提案與投票"}
            </a>
          </li>
        ))}
      </ul>
      {list.data?.items.length === 0 && <p>尚無提案資料</p>}
      <Pagination page={list.data?.page} onChange={setOffset} />
    </main>
  );
}
export function ProposalDetail({
  id,
  embedded = false,
  binId,
}: {
  id: string;
  embedded?: boolean;
  binId?: string;
}) {
  const { session } = useSession();
  const citizen = !!session?.user.roles.includes("citizen");
  const path = `/proposals/${id}`;
  const detail = useApi(
    path,
    async (signal) => {
      try {
        return await request<Proposal>(path, {
          signal,
          token: session?.access_token,
        });
      } catch (error) {
        // Unvoted suggested ballots are derived locally. Restore their Bin for
        // a bookmarked URL; persisted ballots remain readable without the API.
        if (
          !(error instanceof ApiError) ||
          error.status !== 404 ||
          !useDemoData(session?.access_token) ||
          !id.startsWith("demo-suggested-")
        )
          throw error;
        await request(
          `/bins/${encodeURIComponent(id.slice("demo-suggested-".length))}/view`,
          {
            signal,
            token: session?.access_token,
          },
        );
        return request<Proposal>(path, {
          signal,
          token: session?.access_token,
        });
      }
    },
    true,
  );
  const [updated, setUpdated] = useState<Proposal | null>(null);
  const item = detail.loading && updated ? updated : detail.data;
  const open =
    !!item && item.status === "collecting" && item.voting_closed_at === null;
  const action = useCommand<Proposal>({
    scope: `vote/${id}`,
    authorized: citizen,
    ready: open && !detail.loading && !detail.error,
    reconfirm: false,
    refresh: detail.reload,
    onSuccess: (result) => {
      const proposal = result.data as Proposal;
      setUpdated(proposal);
      if (proposal.my_vote === "support") {
        const search = new URLSearchParams(window.location.hash.split("?")[1]);
        search.set("from", embedded ? "map" : "proposal");
        window.location.hash = `vote-done/${encodeURIComponent(id)}?${search}`;
      }
    },
  });
  if (embedded)
    return (
      <div className="proposal-ballot">
        <LoadState {...detail} />
        {item && (
          <>
            <p className="proposal-context">
              {item.district} · 建議設置點／待現勘
            </p>
            <p>{item.reason}</p>
            <div className="proposal-tally" aria-live="polite">
              <span>
                支持 {item.support} · 反對 {item.oppose}
              </span>
              <span>{labels[item.status]}</span>
            </div>
            <p className="tiny">
              {useDemoData(session?.access_token)
                ? "本機展示：60 人參與後依支持率進入評估或里辦評議。"
                : "投票及審查進度以伺服器為準。"}
            </p>
            <p className="tiny">
              支持率 {Math.round((item.support_ratio || 0) * 100)}% · 共{" "}
              {item.total_votes} 人參與
            </p>
            <div
              className="proposal-support"
              role="meter"
              aria-label="支持率"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((item.support_ratio || 0) * 100)}
            >
              <span style={{ width: `${(item.support_ratio || 0) * 100}%` }} />
            </div>
            <p className="proposal-naming-note">
              ☆ 每位認領者都能自由為 BinU命名，只有自己看得到；每人至多認領 5
              個桶。
            </p>
            <p className="tiny" aria-live="polite">
              我的票：
              {item.my_vote === "support"
                ? "支持"
                : item.my_vote === "oppose"
                  ? "反對"
                  : "尚未投票"}
            </p>
            {open ? (
              citizen ? (
                <div className="proposal-ballot-actions">
                  {voteOptions.slice(0, 2).map(({ vote, commandLabel }) => (
                    <button
                      key={vote}
                      className={`button ${vote === "support" ? "primary" : "secondary"}`}
                      aria-pressed={item.my_vote === vote}
                      disabled={action.blocked || item.my_vote === vote}
                      onClick={() =>
                        void action.run({
                          path: `${path}/vote`,
                          body: { vote },
                          label: commandLabel,
                        })
                      }
                    >
                      {vote === "support" ? "支持設桶" : "不要設這裡"}
                    </button>
                  ))}
                  {item.my_vote && (
                    <button
                      className="text-button"
                      disabled={action.blocked}
                      onClick={() =>
                        void action.run({
                          path: `${path}/vote`,
                          body: { vote: null },
                          label: "撤回投票",
                        })
                      }
                    >
                      撤回投票
                    </button>
                  )}
                </div>
              ) : (
                <a
                  className="button primary"
                  href={`#login?next=${encodeURIComponent(`bin/${binId || item.bin_id}`)}`}
                >
                  登入參與投票
                </a>
              )
            ) : (
              <p role="status">投票已關閉 · {labels[item.status]}</p>
            )}
            {item.outcome_reason && <p>結果說明：{item.outcome_reason}</p>}
            <a className="text-button" href={`#proposals/${id}`}>
              查看提案進度
            </a>
            <p className="tiny">
              {useDemoData(session?.access_token)
                ? "票數與操作僅儲存在此瀏覽器，未送交環保局。"
                : "建議點尚未設置，須經審查與現勘。"}
            </p>
          </>
        )}
        <CommandFeedback action={action} />
      </div>
    );
  return (
    <main className="page api-narrow">
      <h1>提案詳情</h1>
      <ProposalLinks />
      <LoadState {...detail} />
      {session?.user.roles.includes("admin") && (
        <a className="button secondary" href={`#admin/proposals/${id}`}>
          審查此提案
        </a>
      )}
      {item && (
        <section className="card">
          <ProposalSummary item={item} />
          <p>
            座標：{item.latitude}, {item.longitude}
          </p>
          <p>建立：{time(item.created_at)}</p>
          <p>關票：{time(item.voting_closed_at)}</p>
          {item.outcome_reason && <p>結果說明：{item.outcome_reason}</p>}
          <a className="api-action-link" href={`#bin/${item.bin_id}`}>
            查看待現勘或示範設置點位
          </a>
        </section>
      )}
      {item && !useDemoData(session?.access_token) && (
        <ProposalNaming
          item={item}
          etag={detail.etag || `"v${item.version}"`}
          ready={!detail.loading && !detail.error}
          refresh={detail.reload}
        />
      )}
      <CommandFeedback action={action} />
      {action.errorCode === "VOTING_CLOSED" && (
        <p role="status">投票已關閉，已重讀最新狀態，請查看提案進度。</p>
      )}
      {!citizen ? (
        <a
          className="button primary"
          href={`#login?next=${encodeURIComponent(`proposals/${id}`)}`}
        >
          登入參與投票
        </a>
      ) : open ? (
        <div className="api-pagination">
          {voteOptions.map(({ vote, label, commandLabel }) => (
            <button
              className="button secondary"
              key={vote || "none"}
              aria-pressed={item?.my_vote === vote}
              disabled={action.blocked || item?.my_vote === vote}
              onClick={() =>
                void action.run({
                  path: `${path}/vote`,
                  body: { vote },
                  label: commandLabel,
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        item && (
          <p>
            {useDemoData(session?.access_token)
              ? "本機展示投票已關閉，未送交真實後台審查。"
              : "投票已關閉，進度以伺服器為準。"}
          </p>
        )
      )}
    </main>
  );
}

type CreateBody = Position & {
  name: string;
  reason: string;
  confirmed_nearby: boolean;
};
export function ProposalForm() {
  const { session } = useSession();
  const { draft, update, clear } = useProposalDraft();
  const [checked, setChecked] = useState<Position | null>(null);
  const [submitted, setSubmitted] = useState<CreateBody | null>(null);
  const [created, setCreated] = useState<ProposalCreated | null>(null);
  const quota = useApi(
    "/me/proposal-quota",
    (signal) =>
      request<ProposalQuota>("/me/proposal-quota", {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  const lat = Number(draft.latitude),
    lon = Number(draft.longitude);
  const valid =
    draft.latitude.trim() !== "" &&
    draft.longitude.trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;
  const samePoint =
    checked && checked.latitude === lat && checked.longitude === lon;
  const path = checked ? query("/map/availability", checked) : "";
  const nearby = useApi(samePoint ? path : null, (signal) =>
    request<Availability>(path, { signal, token: session?.access_token }),
  );
  const ready =
    !!samePoint &&
    !!nearby.data &&
    !nearby.loading &&
    !nearby.error &&
    !!quota.data &&
    !quota.loading &&
    !quota.error &&
    quota.data.remaining > 0 &&
    !!draft.name.trim() &&
    !!draft.reason.trim() &&
    !created;
  const action = useCommand<ProposalCreated>({
    scope: "proposal/create",
    authorized: !!session?.user.roles.includes("citizen"),
    ready,
    reconfirm: false,
    refresh: () => {
      quota.reload();
      nearby.reload();
    },
    onSuccess: (value) => {
      setCreated(value.data as ProposalCreated);
      clear();
    },
  });
  const change = (patch: Partial<typeof draft>) => {
    update(patch);
    setSubmitted(null);
    action.cancel();
  };
  const pick = useCallback(
    (point: Position) => {
      update({
        latitude: String(point.latitude),
        longitude: String(point.longitude),
      });
      setChecked(null);
      setSubmitted(null);
      action.cancel();
    },
    [update, action.cancel],
  );
  const selectBin = useCallback((item: { id: string }) => {
    window.location.hash = `bin/${item.id}`;
  }, []);
  function submit(confirmed: boolean) {
    const body: CreateBody =
      confirmed && submitted
        ? { ...submitted, confirmed_nearby: true }
        : {
            name: draft.name.trim(),
            reason: draft.reason.trim(),
            latitude: lat,
            longitude: lon,
            confirmed_nearby: false,
          };
    setSubmitted(body);
    void action.run({
      path: "/proposals",
      body,
      label: `建立提案「${body.name}」${confirmed ? "（已確認不同需求）" : ""}`,
    });
  }
  return (
    <main className="page api-narrow proposal-page">
      <h1>建立設桶提案</h1>
      <ProposalLinks />
      <p>
        {useDemoData(session?.access_token)
          ? "點擊地圖或輸入展示座標；這是本機提案，不進行真實行政區審查、現勘或設置。"
          : "點擊地圖、拖曳選點或輸入座標。大安區界由後端驗證，不會自動修改你的座標。"}
      </p>
      <LoadState {...quota} />
      {quota.data && (
        <p>
          {quota.data.month} 台北曆月額度：已用 {quota.data.used}／
          {quota.data.limit}，剩餘 {quota.data.remaining}
        </p>
      )}
      {created ? (
        <section className="card" role="status">
          <h2>提案已建立</h2>
          <p>已包含你的一張支持票，仍須現勘，尚未設置。</p>
          <p>本月剩餘 {created.quota.remaining} 次</p>
          {created.warnings.map((w) => (
            <p key={w.bin_id}>
              附近 {Math.round(w.distance_m)} 公尺已有設置桶，仍須現勘。
            </p>
          ))}
          <a href={`#proposals/${created.proposal.id}`}>查看提案與投票</a>
          <a href={`#bin/${created.proposal.bin_id}`}>查看待現勘點位</a>
        </section>
      ) : (
        <>
          <form
            className="card api-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) submit(false);
            }}
          >
            <fieldset disabled={action.busy || !!action.pending}>
              <legend>提案內容</legend>
              <label>
                提案名稱
                <input
                  required
                  maxLength={200}
                  value={draft.name}
                  onChange={(e) => change({ name: e.target.value })}
                />
              </label>
              <label>
                需求原因
                <textarea
                  aria-label="需求原因"
                  required
                  maxLength={500}
                  value={draft.reason}
                  onChange={(e) => change({ reason: e.target.value })}
                />
              </label>
              <label>
                緯度
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  required
                  value={draft.latitude}
                  onChange={(e) => {
                    change({ latitude: e.target.value });
                    setChecked(null);
                  }}
                />
              </label>
              <label>
                經度
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  required
                  value={draft.longitude}
                  onChange={(e) => {
                    change({ longitude: e.target.value });
                    setChecked(null);
                  }}
                />
              </label>
              <button
                type="button"
                className="button secondary"
                disabled={!valid}
                onClick={() => {
                  setChecked({ latitude: lat, longitude: lon });
                  nearby.reload();
                }}
              >
                查詢周邊位置
              </button>
            </fieldset>
            <button
              className="button primary"
              disabled={
                action.blocked || action.errorCode === "NEARBY_PROPOSAL"
              }
            >
              送出提案
            </button>
          </form>
          <div className="proposal-map">
            <LocationMap
              locations={samePoint ? nearby.data?.bins || [] : []}
              selected={null}
              onSelect={selectBin}
              point={valid ? { latitude: lat, longitude: lon } : undefined}
              onPointChange={action.busy || action.pending ? undefined : pick}
            />
          </div>
          <LoadState {...nearby} />
          {samePoint && nearby.data && (
            <section className="card">
              <h2>周邊位置存在性</h2>
              <p>
                300 公尺內
                {nearby.data.has_existing_bin_within_radius ? "有" : "無"}
                已設置未撤除桶；包含滿桶、未知及維修，未設置提案與場所不算桶。
              </p>
              <h3>已設置桶</h3>
              <ul>
                {nearby.data.bins.map((b) => (
                  <li key={b.id}>
                    <a className="api-action-link" href={`#bin/${b.id}`}>
                      {b.label}
                    </a>{" "}
                    ·{" "}
                    {b.distance_m === null
                      ? "距離未知"
                      : `${Math.round(b.distance_m)} 公尺`}
                    {b.bin_type === "proposed" &&
                      b.placement_status === "installed" && (
                        <p>新增提案 · DEMO 示範設置，非現場驗收</p>
                      )}
                    {b.distance_m !== null && b.distance_m <= 150 && (
                      <p>150 公尺內已有設置桶，請確認需求；仍可提案。</p>
                    )}
                  </li>
                ))}
              </ul>
              {nearby.data.nearest_installed_bin && (
                <p>
                  全市最近設置桶：{nearby.data.nearest_installed_bin.label} ·{" "}
                  {nearby.data.nearest_installed_bin.distance_m === null
                    ? "距離未知"
                    : `${Math.round(nearby.data.nearest_installed_bin.distance_m)} 公尺`}
                </p>
              )}
              <h3>附近提案</h3>
              <ul>
                {nearby.data.proposals.map((p) => (
                  <li key={p.id}>
                    <a className="api-action-link" href={`#proposals/${p.id}`}>
                      {p.name}
                    </a>{" "}
                    · {labels[p.status]}
                  </li>
                ))}
              </ul>
              {nearby.data.proposals.length === 0 && (
                <p>附近沒有開放的提案資料</p>
              )}
            </section>
          )}
        </>
      )}
      <CommandFeedback action={action} />
      {!created && action.errorCode === "NEARBY_PROPOSAL" && submitted && (
        <section className="card api-command">
          <h2>請先檢視附近提案</h2>
          <p>
            50 公尺內已有提案。如果「{submitted.name}
            」是不同需求，可明確確認後建立新命令。
          </p>
          <button
            className="button primary"
            disabled={action.blocked}
            onClick={() => submit(true)}
          >
            確認是不同需求並建立提案
          </button>
        </section>
      )}
    </main>
  );
}
