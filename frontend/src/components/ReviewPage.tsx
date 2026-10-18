import type { LocationRecord } from "../data/locations";
import {
  availablePoints,
  cumulativePoints,
  memberLevel,
  rejectedCount,
  reportingSuspended,
  type DemoState,
} from "../data/demoStore";
import {
  formatDemoTime,
  reportAward,
  reportInfo,
  reportIsFinal,
  reportStatusLabels,
  type DemoReport,
  type ReportStatus,
} from "../data/reports";
import { Icon } from "./Icon";
export function ReviewPage({
  report,
  location,
  state,
  onReview,
  loginHref,
}: {
  report: DemoReport;
  location: LocationRecord;
  state: DemoState;
  onReview: (status: ReportStatus) => void;
  loginHref: string;
}) {
  const final = reportIsFinal(report);
  const award = report.status === "approved" ? reportAward(report) : 0;
  const points = cumulativePoints(state);
  const level = memberLevel(points);
  const stage =
    report.status === "pending" ? 0 : report.status === "processing" ? 1 : 3;
  const steps = [
    { label: "你送出回報", time: report.createdAt },
    { label: "清潔員接單", time: report.acceptedAt },
    {
      label:
        report.status === "rejected"
          ? "到場判定不實"
          : "到場確認屬實、清運完成",
      time: report.reviewedAt,
    },
    {
      label:
        report.status === "rejected"
          ? "未發放點數"
          : `點數入帳 +${reportAward(report)}`,
      time: report.reviewedAt,
    },
  ];
  return (
    <main className="page review-page">
      <a className="back-link" href="#member">
        <Icon name="back" />
        我的回報紀錄
      </a>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVERY REPORT, ACCOUNTED FOR.</span>
          <h1>回報審核結果</h1>
          <p>
            {location.label} · {reportInfo(report.type).label}
          </p>
        </div>
        <span className="demo-tag">本機示範案件 · 不是真實審核</span>
      </div>
      <div className="review-grid">
        <div className="review-content">
          <section className={`review-result ${report.status}`} role="status">
            <span className="result-icon">
              <Icon
                name={
                  report.status === "rejected"
                    ? "close"
                    : report.status === "approved"
                      ? "check"
                      : "clock"
                }
              />
            </span>
            <h2>
              {report.status === "approved"
                ? `審核通過 +${award} 點`
                : reportStatusLabels[report.status]}
            </h2>
            <p>
              {report.status === "pending"
                ? "回報已保存，等待示意清潔員接單。"
                : report.status === "processing"
                  ? "清潔員已接單，正前往現場。"
                  : report.status === "rejected"
                    ? "本次示意回報判定不實，不發放點數。"
                    : !report.firstReporter
                      ? "此為同事件後續回報，確認屬實但不重複獎勵。"
                      : `示意清潔員已確認屬實，${report.adopter ? "認養者加倍獎勵" : "一般回報獎勵"}已入帳。`}
            </p>
          </section>
          <section className="card">
            <h2>處理進度</h2>
            <ol className="review-timeline">
              {steps.map((step, index) => (
                <li key={index} className={stage >= index ? "complete" : ""}>
                  <span>
                    {stage > index || final ? <Icon name="check" /> : index + 1}
                  </span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>
                      {step.time ? formatDemoTime(step.time) : "尚未進行"}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            <p className="tiny">
              流程與時間皆為本機示意，未通知或派工給真實清潔隊。
            </p>
          </section>
          {report.description && (
            <section className="card">
              <h2>回報補充說明</h2>
              <p className="report-description muted">{report.description}</p>
            </section>
          )}
          <section className="card scenario-card">
            <div className="section-heading">
              <h2>示範審核情境</h2>
              <span className="demo-tag">展示控制</span>
            </div>
            <p className="muted">
              選擇狀態來體驗案件處理。通過或判定不實後即為最終結果，同一案件只結算一次。
            </p>
            <label className="field-label" htmlFor="review-status">
              示範案件狀態
            </label>
            <select
              id="review-status"
              value={report.status}
              disabled={final || !state.loggedIn}
              onChange={(event) => onReview(event.target.value as ReportStatus)}
            >
              <option value="pending">審核中</option>
              <option value="processing">清潔員處理中</option>
              <option value="approved">確認屬實並通過</option>
              <option value="rejected">判定不實</option>
            </select>
            {!state.loggedIn && (
              <a className="button secondary" href={loginHref}>
                登入後操作示範審核
              </a>
            )}
            {final && (
              <p className="tiny">
                已完成審核。可從其他桶或其他問題建立新案件，體驗不同情境。
              </p>
            )}
          </section>
        </div>
        <aside className="review-sidebar">
          <section className="card review-member">
            <span className="level-seal small-seal">
              {level.current.symbol}
            </span>
            <h2>{level.current.name}</h2>
            <p>累積點數 {points}</p>
            <strong>可用點數 {availablePoints(state)}</strong>
            <p className="tiny">
              {level.next
                ? `再 ${level.next.threshold - points} 點升到「${level.next.name}」`
                : "已達最高等級"}
            </p>
            <a className="button primary wide" href="#rewards">
              兌換獎品
              <Icon name="gift" />
            </a>
            <a className="button secondary wide" href="#member">
              前往會員中心
            </a>
          </section>
          <section className="card">
            <h3>每一次回報，都很重要</h3>
            <p className="muted">
              確認屬實：一般 +1、認養者 +2。同事件只有第一位回報者得點。
            </p>
            <p className="muted">判定不實不給點，累積三次暫停回報資格。</p>
            <p className="tiny">
              本機不實次數：{rejectedCount(state)}
              {reportingSuspended(state) ? " · 已暫停回報" : ""}
            </p>
          </section>
          <a className="back-link" href={`#bin/${location.id}`}>
            查看這個桶
            <Icon name="arrow" />
          </a>
        </aside>
      </div>
    </main>
  );
}
