import { isDemoToken } from "../../data/demoMode";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
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
  const trigger = useRef<HTMLElement | null>(null);
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
      <header className="compact-page-head">
        <a className="back-link" href="#member" aria-label="返回我的">
          <Icon name="back" />
        </a>
        <div>
          <h1>{demo ? "兌換獎勵" : "兌換獎品"}</h1>
          <p>可用 {balance ?? "—"} 點</p>
        </div>
      </header>
      <LoadState {...member} />

      <LoadState {...list} />
      {result && (
        <section className="card" role="status">
          <h2>兌換成功</h2>
          <p>
            本次扣點 {result.redemption.cost} · 可用餘額{" "}
            {result.membership.available_points} · 庫存 {result.reward.stock}
          </p>
          <a
            className="api-action-link"
            href={`#redemptions/${result.redemption.id}`}
          >
            查看本次兌換券
          </a>
        </section>
      )}
      {!selected && <CommandFeedback action={action} />}
      <ul className="reward-catalog">
        {list.data?.items.map((item) => {
          const current =
            result && list.loading && result.reward.id === item.id
              ? result.reward
              : item;
          const missing =
            balance == null ? null : Math.max(0, item.cost - balance);
          return (
            <li className="card reward-catalog-row" key={item.id}>
              <span className="reward-catalog-icon">
                <Icon name={item.category === "grand" ? "star" : "gift"} />
              </span>
              <div className="reward-catalog-description">
                <h2>{item.name}</h2>
                <strong>{item.cost.toLocaleString()} 點</strong>
                {item.code === "demo-merch" && <small>貼紙、徽章</small>}
              </div>
              <div className="reward-catalog-action">
                <button
                  className="button primary"
                  aria-label={`選擇 ${item.name}`}
                  disabled={
                    action.blocked ||
                    !current.available ||
                    current.stock <= 0 ||
                    balance == null ||
                    !!missing
                  }
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    action.cancel();
                    setSelected(item);
                  }}
                >
                  {!current.available || current.stock <= 0 ? "已售罄" : "兌換"}
                </button>
                {missing !== null && missing > 0 && (
                  <small>還差 {missing.toLocaleString()} 點</small>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {list.data?.items.length === 0 && <p>目前沒有獎品</p>}
      {!demo && (
        <Pagination
          page={list.data?.page}
          onChange={(value) => {
            setOffset(value);
            setSelected(null);
          }}
        />
      )}
      {selected && (
        <RedeemDialog
          title={`確認兌換 ${selected.name}`}
          returnFocus={trigger}
          closeDisabled={action.busy || !!action.pending}
          onClose={() => setSelected(null)}
          confirm={
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
          }
        >
          <p>
            將使用 {selected.cost} 點；
            {isDemoToken(session?.access_token)
              ? "確認後扣除可用點數。"
              : "實際點數及庫存由後端確認。"}
          </p>
          <CommandFeedback action={action} />
        </RedeemDialog>
      )}
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
      <h1>{id ? "我的兌換券" : "我的兌換"}</h1>
      <MemberNavigation current="redemptions" />

      <a className="back-link" href={id ? "#redemptions" : "#rewards"}>
        {id ? "返回我的兌換" : "返回兌換獎勵"}
      </a>
      <LoadState {...(id ? detail : list)} />
      {detail.data && (
        <section className="card api-voucher">
          <h2>兌換券</h2>
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
                  {time(item.created_at)} · {item.cost} 點
                </p>
                <a href={`#redemptions/${item.id}`}>查看兌換券 {item.id}</a>
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

// 兌換確認彈窗：版型與焦點處理照 EndClaimDialog（role=dialog、aria-modal、Tab 只在框內、
// Esc／點遮罩＝取消，關閉後焦點還原到觸發的「兌換」鍵）。確認與取消的行為不變。
function RedeemDialog({
  title,
  children,
  confirm,
  closeDisabled,
  onClose,
  returnFocus,
}: {
  title: string;
  children: ReactNode;
  confirm: ReactNode;
  closeDisabled: boolean;
  onClose: () => void;
  returnFocus: { current: HTMLElement | null };
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const guard = useRef({ closeDisabled, onClose });
  guard.current = { closeDisabled, onClose };
  useEffect(() => {
    const back = returnFocus.current;
    cancel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!guard.current.closeDisabled) guard.current.onClose();
        return;
      }
      if (event.key !== "Tab" || !box.current) return;
      const items = [
        ...box.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href]",
        ),
      ];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!box.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (back?.isConnected) back.focus();
    };
  }, [returnFocus]);
  return createPortal(
    <>
      <div
        className="claim-dialog-scrim reward-dialog-scrim"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={box}
        className="claim-dialog reward-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        {children}
        <div className="claim-dialog-actions">
          {confirm}
          <button
            ref={cancel}
            className="button secondary"
            disabled={closeDisabled}
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
