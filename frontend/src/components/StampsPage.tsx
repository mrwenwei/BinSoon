import { useEffect, useRef, useState } from "react";
import { availablePoints, type DemoState } from "../data/demoStore";
import { districts, locations } from "../data/locations";
import { pendingPoints, reportInfo } from "../data/reports";
import { Icon } from "./Icon";
const seedNames = ["新生", "信義", "公園", "師大", "市場", "和平", "遛狗"];
export function stampCount(state: DemoState, district: string) {
  return (
    (district === "大安區" ? 7 : 0) +
    state.stamps.filter(
      (id) => locations.find((item) => item.id === id)?.district === district,
    ).length
  );
}
export function StampsPage({
  state,
  onRedeem,
}: {
  state: DemoState;
  onRedeem: () => void;
}) {
  const [district, setDistrict] = useState("大安區");
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirming) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirming]);
  const collected = state.stamps
    .map((id) => locations.find((item) => item.id === id)!)
    .filter((item) => item.district === district);
  const seeds = district === "大安區" ? seedNames : [];
  const count = seeds.length + collected.length;
  return (
    <main className="page stamps-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SMALL ACTS, COLLECTED.</span>
          <h1>把順手，收集成美好。</h1>
          <p>走過的街角、留下的小善意，都在這裡。</p>
        </div>
        <span className="demo-tag">示意帳本 · 僅儲存於本瀏覽器</span>
      </div>
      <div className="stamps-layout">
        <aside className="stamps-sidebar">
          <section className="balance-card">
            <span>可用點數 {availablePoints(state)}</span>
            <strong>
              {availablePoints(state)}
              <small>點</small>
            </strong>
            <span className="pending-label">
              待確認 +{pendingPoints(state.reports)} 點
            </span>
            <p>本週已拿 60 / 上限 100 點（示意）</p>
            <div className="balance-progress">
              <span />
            </div>
          </section>
          <section className="card coupon-card">
            <Icon name="gift" />
            <h2>把小善意，換成小確幸</h2>
            <p>超商 50 元兌換券</p>
            <span className="tiny">
              200 點 · 本月剩 {state.redeemed ? 379 : 380} 張（示意）
            </span>
            {!state.loggedIn ? (
              <a className="button primary wide" href="#login?next=stamps">
                登入後兌換
              </a>
            ) : (
              <button
                className="button primary wide"
                disabled={state.redeemed || availablePoints(state) < 200}
                onClick={() => setConfirming(true)}
              >
                {state.redeemed ? "已兌換" : "兌換"}
              </button>
            )}
            {state.redeemed && (
              <div className="redeemed-coupon">
                <span>你的示意兌換券</span>
                <strong>DEMO-SOON-0050</strong>
                <p>展示用序號 · 無法在真實商店使用</p>
              </div>
            )}
          </section>
          <a className="account-settings" href="#login">
            <Icon name="user" />
            帳號與登入設定
            <Icon name="arrow" />
          </a>
        </aside>
        <section className="card album">
          <div className="section-heading">
            <h2>
              {district}印章 {count} / 20
            </h2>
            <label className="album-district">
              行政區
              <select
                aria-label="集章行政區"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
              >
                {districts.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            集滿 20 個，解鎖區域限定貼紙。
            <br />
            <span className="tiny">
              已收集的 7 個大安區印章為初始示意資料。
            </span>
          </p>
          <div className="stamp-grid">
            {seeds.map((name) => (
              <div className="album-stamp collected" key={name}>
                <span>{name}</span>
                <small>{name}章</small>
              </div>
            ))}
            {collected.map((item) => (
              <a
                className="album-stamp collected new-stamp"
                key={item.id}
                href={`#bin/${item.id}`}
              >
                <span>順</span>
                <small>{item.label}</small>
                <em>已收集</em>
              </a>
            ))}
            {Array.from({ length: Math.max(0, 20 - count) }, (_, index) => (
              <div className="album-stamp locked" key={`locked-${index}`}>
                <span>?</span>
                <small>未收集</small>
              </div>
            ))}
          </div>
          {count >= 20 && (
            <p className="album-reward">
              ✦ 已解鎖區域限定貼紙（示意），繼續收集更多街角！
            </p>
          )}
          <div className="album-footer">
            <Icon name="pin" />
            <p>在桶詳情體驗示範掃碼，或完成示範回報，就能收集專屬印章。</p>
          </div>
        </section>
      </div>
      <section className="card report-history">
        <div className="section-heading">
          <h2>我的回報紀錄</h2>
          <span className="tiny">本瀏覽器的示範回報</span>
        </div>
        {state.reports.length === 0 ? (
          <p className="muted">
            還沒有回報紀錄。下一次路過，順手照顧一下城市吧。
          </p>
        ) : (
          <ul>
            {[...state.reports].reverse().map((report) => {
              const item = locations.find(
                (location) => location.id === report.locationId,
              )!;
              const info = reportInfo(report.type);
              return (
                <li key={report.id}>
                  <a href={`#report-done/${report.id}`}>
                    <strong>{item.label}</strong>
                    <small>
                      {info.label} ·{" "}
                      {new Date(report.createdAt).toLocaleString("zh-TW", {
                        timeZone: "Asia/Taipei",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </a>
                  <span className="history-state">待到場確認</span>
                  <span className="tiny">+{info.points} 點</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <dialog
        ref={dialog}
        className="redeem-dialog"
        aria-labelledby="redeem-title"
        onClose={() => setConfirming(false)}
      >
        <span className="stamp-mark">
          <Icon name="gift" />
        </span>
        <h2 id="redeem-title">兌換一點日常的小確幸</h2>
        <p>超商 50 元示意兌換券</p>
        <div className="redeem-total">
          <span>使用 200 點</span>
          <strong>兌換後剩餘 {availablePoints(state) - 200} 點</strong>
        </div>
        <p className="tiny">
          這是本機示範兌換，不是真實優惠券。待確認點數不能使用。
        </p>
        <div className="action-row">
          <button
            autoFocus
            className="button secondary"
            onClick={() => setConfirming(false)}
          >
            再想一下
          </button>
          <button
            className="button primary"
            disabled={
              !state.loggedIn || state.redeemed || availablePoints(state) < 200
            }
            onClick={() => {
              onRedeem();
              setConfirming(false);
            }}
          >
            確認兌換 200 點
          </button>
        </div>
      </dialog>
    </main>
  );
}
