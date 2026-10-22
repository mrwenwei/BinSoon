import { isDemoToken } from "../../data/demoMode";
import { useEffect, useState } from "react";
import {
  query,
  request,
  time,
  type Membership,
  type PageData,
  type Redemption,
  type RedeemResult,
  type Reward,
} from "../../data/api";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { Pagination } from "./Pagination";
import { CommandFeedback, useCommand } from "./Commands";
import { Icon } from "../Icon";
import { MemberNavigation } from "./MemberNavigation";

export function Rewards() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);
  const { session } = useSession();
  const demo = isDemoToken(session?.access_token);
  const [category, setCategory] = useState("all");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Reward | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const path = query("/rewards", { category, offset, limit: 20 });
  const list = useApi(
    path,
    (signal) => request<PageData<Reward>>(path, { signal }),
    true,
  );
  const member = useApi(
    "/me/membership",
    (signal) =>
      request<Membership>("/me/membership", {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  const action = useCommand<RedeemResult>({
    scope: "redemption",
    authorized: !!session?.user.roles.includes("citizen"),
    ready:
      !!member.data &&
      !!list.data &&
      !member.error &&
      !list.error &&
      !member.loading &&
      !list.loading,
    reconfirm: false,
    refresh: () => {
      member.reload();
      list.reload();
    },
    onSuccess: (value) => {
      setResult(value.data as RedeemResult);
      setSelected(null);
    },
  });
  const balance =
    member.loading && result
      ? result.membership.available_points
      : member.data?.available_points;
  return (
    <main className="page api-narrow rewards-page">
      <a className="back-link" href="#member">
        <Icon name="back" />
        返回會員中心
      </a>
      <h1>{demo ? "兌換獎勵" : "兌換獎品"}</h1>
      <p>所有獎品與券碼僅為 DEMO 展示，無真實核銷能力。</p>
      <p>可用點數 {balance ?? "—"}</p>
      <LoadState {...member} />
      <a className="button secondary" href="#redemptions">
        我的兌換
      </a>
      {!demo && (
        <label className="api-filter">
          獎品分類
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setOffset(0);
              setSelected(null);
            }}
          >
            <option value="all">全部</option>
            <option value="coupon">超商券</option>
            <option value="grand">大獎</option>
          </select>
        </label>
      )}
      <LoadState {...list} />
      {result && (
        <section className="card" role="status">
          <h2>兌換成功</h2>
          <p>
            本次扣點 {result.redemption.cost} ·{" "}
            {isDemoToken(session?.access_token) ? "展示餘額" : "後端餘額"}{" "}
            {result.membership.available_points} · 庫存 {result.reward.stock}
          </p>
          <a
            className="api-action-link"
            href={`#redemptions/${result.redemption.id}`}
          >
            查看本次展示券
          </a>
        </section>
      )}
      <CommandFeedback action={action} />
      <ul className="api-items member-reward-grid">
        {list.data?.items
          .filter((item) => !demo || item.code === "demo-coffee")
          .map((item) => {
            const current =
              result && list.loading && result.reward.id === item.id
                ? result.reward
                : item;
            return (
              <li className="card" key={item.id}>
                <div
                  className={`member-reward-art ${item.category}`}
                  aria-hidden="true"
                >
                  <Icon name={item.category === "grand" ? "star" : "gift"} />
                  <span>
                    {item.category === "grand" ? "城市好禮" : "日常小確幸"}
                  </span>
                </div>
                <h2>{item.name}</h2>
                <p>
                  {item.is_demo ? "DEMO · " : ""}
                  {item.cost} 點
                </p>
                <p>庫存 {current.stock}</p>
                <button
                  className="button primary"
                  disabled={
                    action.blocked ||
                    !item.available ||
                    item.stock <= 0 ||
                    balance == null ||
                    balance < item.cost
                  }
                  onClick={() => {
                    action.cancel();
                    setSelected(item);
                  }}
                  aria-label={`選擇 ${item.name}`}
                >
                  {!item.available || item.stock <= 0
                    ? "已售罄"
                    : balance != null && balance < item.cost
                      ? `還差 ${item.cost - balance} 點`
                      : "兌換"}
                </button>
              </li>
            );
          })}
      </ul>
      {demo && (
        <section className="card reward-coming-soon" aria-label="規劃中獎勵">
          <h2>更多獎勵，準備中</h2>
          <p>超商購物金 · 點數待定</p>
          <p>BinU周邊 · 點數待定</p>
          <p className="tiny">
            尚未開放兌換；展示券可在「我的兌換」查看，未串接 LINE 或真實核銷。
          </p>
        </section>
      )}
      {list.data?.items.length === 0 && <p>目前沒有獎品</p>}
      <Pagination
        page={list.data?.page}
        onChange={(value) => {
          setOffset(value);
          setSelected(null);
        }}
      />
      {selected && (
        <section className="card api-command" aria-label="兌換確認">
          <h2>確認兌換 {selected.name}</h2>
          <p>
            將使用 {selected.cost} 點；
            {isDemoToken(session?.access_token)
              ? "只扣除本機展示點數，不具真實核銷能力。"
              : "實際點數及庫存由後端確認。"}
          </p>
          <button
            className="button primary"
            disabled={action.blocked}
            onClick={() =>
              void action.run({
                path: "/redemptions",
                body: { reward_id: selected.id },
                label: `兌換 ${selected.name}`,
              })
            }
          >
            確認兌換
          </button>
          <button
            className="button secondary"
            disabled={action.busy || !!action.pending}
            onClick={() => setSelected(null)}
          >
            取消
          </button>
        </section>
      )}
      <aside className="member-how">
        <h3>兌換規則</h3>
        <p>
          兌換只扣可用點數；等級依累積點數計算，不因兌換降低。展示獎品與券碼無真實核銷能力。
        </p>
      </aside>
    </main>
  );
}
export function Redemptions({ id }: { id?: string }) {
  const { session } = useSession();
  const [offset, setOffset] = useState(0);
  const path = query("/me/redemptions", { offset, limit: 20 });
  const list = useApi(
    id ? null : path,
    (signal) =>
      request<PageData<Redemption>>(path, {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  const detail = useApi(id ? `/redemptions/${id}` : null, (signal) =>
    request<Redemption>(`/redemptions/${id}`, {
      signal,
      token: session?.access_token,
    }),
  );
  return (
    <main className="page api-narrow">
      <h1>{id ? "我的展示券" : "我的兌換"}</h1>
      <MemberNavigation current="redemptions" />
      <p>僅供 DEMO 展示，無真實核銷能力。</p>
      <a className="back-link" href={id ? "#redemptions" : "#rewards"}>
        {id ? "返回我的兌換" : "返回兌換獎勵"}
      </a>
      <LoadState {...(id ? detail : list)} />
      {detail.data && (
        <section className="card api-voucher">
          <h2>DEMO 展示券</h2>
          <p>{detail.data.voucher_code}</p>
          <p>
            {detail.data.cost} 點 · {time(detail.data.created_at)}
          </p>
          <p>獎品 UUID：{detail.data.reward_id}</p>
          <p>{detail.data.status}</p>
        </section>
      )}
      {!id && (
        <>
          <ul className="api-items">
            {list.data?.items.map((item) => (
              <li className="card" key={item.id}>
                <p>
                  {time(item.created_at)} · {item.cost} 點 · DEMO
                </p>
                <a href={`#redemptions/${item.id}`}>查看展示券 {item.id}</a>
              </li>
            ))}
          </ul>
          {list.data?.items.length === 0 && <p>尚無兌換紀錄</p>}
          <Pagination page={list.data?.page} onChange={setOffset} />
        </>
      )}
    </main>
  );
}
