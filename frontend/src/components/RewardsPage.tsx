import { useEffect, useRef, useState } from "react";
import {
  availablePoints,
  cumulativePoints,
  rewardStock,
  type DemoState,
} from "../data/demoStore";
import { couponCode, findReward, rewards, type Reward } from "../data/rewards";
import { formatDemoTime } from "../data/reports";
import { Icon } from "./Icon";
export function RewardsPage({
  state,
  receiptId,
  onRedeem,
}: {
  state: DemoState;
  receiptId: string | null;
  onRedeem: (reward: Reward) => void;
}) {
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Reward | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const confirming = useRef(false);
  const balance = availablePoints(state);
  const receipt = state.redemptions.find((item) => item.id === receiptId);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  function open(reward: Reward) {
    confirming.current = false;
    setError("");
    setSelected(reward);
  }
  function confirm() {
    if (confirming.current || !selected) return;
    if (
      !state.loggedIn ||
      balance < selected.cost ||
      rewardStock(state, selected) <= 0
    ) {
      setError("目前點數或庫存不足，請關閉後重新選擇。");
      return;
    }
    confirming.current = true;
    onRedeem(selected);
    setSelected(null);
  }
  return (
    <main className="page rewards-page">
      <a className="back-link" href="#member">
        <Icon name="back" />
        返回會員中心
      </a>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMALL ACTS, LITTLE REWARDS.</span>
          <h1>兌換獎品</h1>
          <p>把照顧城市的每一點，換成日常的小確幸。</p>
        </div>
        <div className="reward-balance">
          <Icon name="star" />
          <span>可用點數 {balance}</span>
          <small>累積 {cumulativePoints(state)} 點 · 等級不受兌換影響</small>
        </div>
      </div>
      {receipt && (
        <section className="redemption-success" role="status">
          <Icon name="check" />
          <div>
            <h2>兌換成功</h2>
            <p>
              {findReward(receipt.rewardId)!.name} · 已扣 {receipt.cost} 點
            </p>
            <span>示意券已收進下方「我的兌換紀錄」，不是真實可用獎品。</span>
          </div>
        </section>
      )}
      <div className="reward-toolbar">
        <div className="reward-tabs" role="tablist" aria-label="獎品分類">
          {[
            { id: "all", label: "全部" },
            { id: "coupon", label: "超商兌換券" },
            { id: "grand", label: "大獎" },
          ].map((item) => (
            <button
              key={item.id}
              id={`reward-tab-${item.id}`}
              role="tab"
              aria-selected={category === item.id}
              aria-controls="reward-results"
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="demo-tag">面額、點數及庫存皆為示意</span>
      </div>
      <div
        className="reward-grid"
        id="reward-results"
        role="tabpanel"
        aria-labelledby={`reward-tab-${category}`}
      >
        {rewards
          .filter(
            (reward) => category === "all" || reward.category === category,
          )
          .map((reward) => {
            const stock = rewardStock(state, reward);
            return (
              <article
                className="reward-card"
                key={reward.id}
                aria-label={reward.name}
              >
                <div className={`reward-art ${reward.color}`}>
                  <span className="reward-brand">{reward.brand}</span>
                  <strong>{reward.symbol}</strong>
                  <small>
                    {reward.category === "coupon"
                      ? "A LITTLE SOMETHING FOR YOU"
                      : "BIG DREAMS START SMALL"}
                  </small>
                  <span className="reward-art-star">✦</span>
                </div>
                <div className="reward-copy">
                  <span className="reward-category">
                    {reward.category === "coupon" ? "日常小確幸" : "城市大獎"}
                  </span>
                  <h2>{reward.name}</h2>
                  <p>{reward.note}</p>
                  <div className="reward-price">
                    <strong>
                      {reward.cost.toLocaleString()}
                      <small>點</small>
                    </strong>
                    <span>
                      本月剩 {stock} {reward.id === "phone" ? "支" : "張"}
                    </span>
                  </div>
                  {!state.loggedIn ? (
                    <a
                      className="button secondary wide"
                      href="#login?next=rewards"
                    >
                      登入後兌換
                    </a>
                  ) : (
                    <button
                      className="button primary wide"
                      disabled={stock <= 0 || balance < reward.cost}
                      onClick={() => open(reward)}
                    >
                      {stock <= 0
                        ? "本月已兌換完畢"
                        : balance < reward.cost
                          ? `還差 ${(reward.cost - balance).toLocaleString()} 點`
                          : "兌換"}
                      {balance >= reward.cost && stock > 0 && (
                        <Icon name="gift" />
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>
      <section className="card redemption-history">
        <div className="section-heading">
          <h2>我的兌換紀錄</h2>
          <span className="tiny">示意券 · 僅此瀏覽器保存</span>
        </div>
        {state.redemptions.length === 0 ? (
          <p className="muted">還沒有兌換紀錄，累積小善意後再來看看。</p>
        ) : (
          [...state.redemptions].reverse().map((item) => (
            <details key={item.id} open={receipt?.id === item.id || undefined}>
              <summary>
                <strong>{findReward(item.rewardId)!.name}</strong>
                <span>
                  {formatDemoTime(item.createdAt)} · −{item.cost} 點
                </span>
              </summary>
              <div className="redeemed-coupon">
                <span>示意兌換序號</span>
                <strong>{couponCode(item)}</strong>
                <p>展示用序號 · 無法在真實商店使用或取得獎品</p>
              </div>
            </details>
          ))
        )}
      </section>
      <section className="reward-rules">
        <h2>兌換規則</h2>
        <p>
          兌換只扣可用點數，等級依累積點數計算，不會降級。審核中的點數不能使用。
        </p>
        <p>
          獎品為展示資料，每月限量，庫存只在本瀏覽器扣減。真實面額、點數、贊助與兌換規則仍待確認。
        </p>
      </section>
      <dialog
        ref={dialog}
        className="redeem-dialog"
        aria-labelledby="redeem-title"
        onClose={() => setSelected(null)}
      >
        <span className="stamp-mark">
          <Icon name="gift" />
        </span>
        <h2 id="redeem-title">兌換一點日常的小確幸</h2>
        <p>{selected?.name}</p>
        <div className="redeem-total">
          <span>使用 {selected?.cost} 點</span>
          <strong>兌換後剩餘 {balance - (selected?.cost ?? 0)} 點</strong>
        </div>
        <p className="tiny">
          只扣可用點數，累積點數和會員等級保持。這是本機示範，不是真實獎品。
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="action-row">
          <button
            autoFocus
            className="button secondary"
            onClick={() => setSelected(null)}
          >
            再想一下
          </button>
          <button
            className="button primary"
            disabled={
              !selected ||
              !state.loggedIn ||
              balance < selected.cost ||
              rewardStock(state, selected) <= 0
            }
            onClick={confirm}
          >
            確認兌換 {selected?.cost} 點
          </button>
        </div>
      </dialog>
    </main>
  );
}
