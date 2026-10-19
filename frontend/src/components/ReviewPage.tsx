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
  reportStatusLabels,
  type DemoReport,
} from "../data/reports";
import { workLabels } from "../data/workOrders";
export function ReviewPage({
  report,
  location,
  state,
}: {
  report: DemoReport;
  location: LocationRecord;
  state: DemoState;
}) {
  const task = state.tasks.find((t) => t.id === report.eventId);
  const level = memberLevel(cumulativePoints(state));
  return (
    <main className="page review-page">
      <a className="back-link" href="#member">
        ← 我的回報紀錄
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
            <h2>
              {report.status === "approved"
                ? `審核通過 +${reportAward(report)} 點`
                : reportStatusLabels[report.status]}
            </h2>
            <p>
              {report.status === "approved"
                ? "查證屬實，符合資格的獎勵已入帳；工作進度另列，入帳不代表清運完成。"
                : report.status === "rejected"
                  ? `本次判定不實，不給點。${report.rejectionReason || ""}`
                  : report.status === "processing"
                    ? "清潔員已接單，正前往現場。"
                    : "回報已保存，等待示範隊員到場查證。"}
            </p>
          </section>
          <section className="card">
            <h2>查證與工作進度</h2>
            <ol className="review-timeline">
              {[
                ["你送出回報", report.createdAt],
                ["清潔員接單", task?.acceptedAt || report.acceptedAt],
                ["到場查證", report.reviewedAt],
                ["點數結算", report.reviewedAt],
                ["工作結案", task?.completedAt],
              ].map(([label, time]) => (
                <li key={label} className={time ? "complete" : ""}>
                  <span>{time ? "✓" : "·"}</span>
                  <div>
                    <strong>{label}</strong>
                    <small>{time ? formatDemoTime(time) : "尚未進行"}</small>
                  </div>
                </li>
              ))}
            </ol>
            <p data-testid="citizen-work-status">
              工作狀態：
              {task
                ? workLabels[task.status]
                : location.district !== "大安區"
                  ? "超出本次隊員展示範圍"
                  : "舊版已結束紀錄，未補造完成證據"}
            </p>
            {task && (
              <a className="button secondary" href={`#staff/tasks/${task.id}`}>
                切換隊員查看此工單
              </a>
            )}
            <p className="tiny">
              市民端只查看進度，查證操作在獨立隊員工作台。未通知真實清潔隊。
            </p>
          </section>
          {report.description && (
            <section className="card">
              <h2>回報補充說明</h2>
              <p>{report.description}</p>
            </section>
          )}
        </div>
        <aside className="review-sidebar">
          <section className="card">
            <span className="level-seal small-seal">
              {level.current.symbol}
            </span>
            <h2>{level.current.name}</h2>
            <p>累積點數 {cumulativePoints(state)}</p>
            <strong>可用點數 {availablePoints(state)}</strong>
            <p className="tiny">
              {level.next
                ? `再 ${level.next.threshold - cumulativePoints(state)} 點升到「${level.next.name}」`
                : "已達最高等級"}
            </p>
            <a className="button primary wide" href="#rewards">
              兌換獎品
            </a>
            <a className="button secondary wide" href="#member">
              前往會員中心
            </a>
          </section>
          <section className="card">
            <h3>每一次回報，都很重要</h3>
            <p>屬實一般首報+1、認養首報+2，同事件後報0。首報不實不遞補。</p>
            <p>
              本機不實次數：{rejectedCount(state)}
              {reportingSuspended(state) ? " · 已暫停回報" : ""}
            </p>
          </section>
          <a className="back-link" href={`#bin/${location.id}`}>
            查看這個桶
          </a>
        </aside>
      </div>
    </main>
  );
}
