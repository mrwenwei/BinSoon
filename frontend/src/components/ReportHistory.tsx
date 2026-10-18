import { locations } from "../data/locations";
import {
  formatDemoTime,
  reportAward,
  reportInfo,
  reportStatusLabels,
  type DemoReport,
} from "../data/reports";
export function ReportHistory({ reports }: { reports: DemoReport[] }) {
  return (
    <section className="card report-history">
      <div className="section-heading">
        <h2>我的回報紀錄</h2>
        <span className="tiny">本瀏覽器的示範案件</span>
      </div>
      {reports.length === 0 ? (
        <p className="muted">
          還沒有回報紀錄。下一次路過，順手照顧一下城市吧。
        </p>
      ) : (
        <ul>
          {[...reports].reverse().map((report) => (
            <li key={report.id}>
              <a href={`#review/${report.id}`}>
                <strong>
                  {
                    locations.find((item) => item.id === report.locationId)!
                      .label
                  }
                </strong>
                <small>
                  {reportInfo(report.type).label} ·{" "}
                  {formatDemoTime(report.createdAt)}
                </small>
                {report.description && (
                  <small className="report-description">
                    {report.description}
                  </small>
                )}
              </a>
              <span className={`history-state ${report.status}`}>
                {reportStatusLabels[report.status]}
              </span>
              <span className="tiny">
                {report.status === "rejected"
                  ? "不發點"
                  : `+${reportAward(report)} 點${report.status === "approved" ? "已入帳" : "待確認"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
