import {
  availablePoints,
  cumulativePoints,
  memberLevel,
  memberTiers,
  rejectedCount,
  reportingSuspended,
  type DemoState,
} from "../data/demoStore";
import { pendingPoints } from "../data/reports";
import { Icon } from "./Icon";
import { ReportHistory } from "./ReportHistory";
export function MemberPage({ state }: { state: DemoState }) {
  const points = cumulativePoints(state);
  const level = memberLevel(points);
  const approved = state.reports.filter(
    (report) => report.status === "approved",
  ).length;
  return (
    <main className="page member-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SMALL ACTS, GROWING TOGETHER.</span>
          <h1>會員中心</h1>
          <p>每一份順手的善意，都讓城市再好一點。</p>
        </div>
        <span className="demo-tag">1018 展示帳本 · 僅存於本瀏覽器</span>
      </div>
      <div className="member-layout">
        <aside className="member-sidebar">
          <section className="member-level-card">
            <span className="eyebrow">YOUR CITY LEVEL</span>
            <span className="level-seal">{level.current.symbol}</span>
            <h2>{level.current.name}</h2>
            <p>累積點數 {points}</p>
            <progress
              aria-label="會員升級進度"
              value={level.next ? points : 1}
              max={level.next?.threshold ?? 1}
            />
            <span>
              {level.next
                ? `再 ${level.next.threshold - points} 點升到「${level.next.name}」`
                : "已達最高等級，謝謝你持續照顧城市！"}
            </span>
            <small>
              {level.next
                ? `${points} / ${level.next.threshold}`
                : "教授級城市小幫手"}
            </small>
          </section>
          <a className="account-settings" href="#login?next=member">
            <Icon name="user" />
            帳號與登入設定
            <Icon name="arrow" />
          </a>
        </aside>
        <div className="member-content">
          <div className="member-stats">
            <section className="card">
              <span>可用點數 {availablePoints(state)}</span>
              <strong>
                {availablePoints(state)}
                <small>點</small>
              </strong>
              <a href="#rewards">
                兌換獎品
                <Icon name="arrow" />
              </a>
            </section>
            <section className="card">
              <span>待確認點數</span>
              <strong>+{pendingPoints(state.reports)}</strong>
              <small>審核中及處理中，尚未入帳</small>
            </section>
            <section className="card">
              <span>屬實回報</span>
              <strong>
                {48 + approved}
                <small>次</small>
              </strong>
              <small>包含初始示意紀錄 48 次</small>
            </section>
          </div>
          <section className="card">
            <div className="section-heading">
              <h2>等級徽章</h2>
              <span className="tiny">依累積點數 · 門檻暫定</span>
            </div>
            <ul className="tier-list" aria-label="會員等級徽章">
              {memberTiers.map((tier) => (
                <li
                  key={tier.name}
                  className={points >= tier.threshold ? "unlocked" : ""}
                  aria-current={
                    tier.name === level.current.name ? "step" : undefined
                  }
                >
                  <span>{tier.symbol}</span>
                  <strong>{tier.name}</strong>
                  <small>
                    {tier.threshold.toLocaleString()} 點
                    {tier.name === level.current.name ? " · 目前" : ""}
                  </small>
                </li>
              ))}
            </ul>
            <p className="tiny">兌換只扣可用點數，累積點數和等級都不會下降。</p>
          </section>
          <section className="card earning-card">
            <div>
              <h2>怎麼拿點數？</h2>
              <p>
                回報經確認屬實 <strong>+1 點</strong> · 認養者{" "}
                <strong>+2 點</strong>
              </p>
              <p>同事件只有第一位回報者得點；不實不給點。</p>
              <span className="tiny">
                初始累積／可用各 63 點為示意基準，不含新送出的待確認案件。
              </span>
            </div>
            <a className="button secondary" href="#adopt">
              認養電子雞 <Icon name="arrow" />
            </a>
          </section>
          {rejectedCount(state) > 0 && (
            <p
              className={`account-warning ${reportingSuspended(state) ? "suspended" : ""}`}
              role="status"
            >
              不實示範回報 {rejectedCount(state)} 次。
              {reportingSuspended(state)
                ? "已達三次，暫停本機示範帳號的回報資格。"
                : "累積三次將暫停回報資格。"}
            </p>
          )}
        </div>
      </div>
      <ReportHistory reports={state.reports} />
    </main>
  );
}
