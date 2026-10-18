import type { LocationRecord } from "../data/locations";
import { reportInfo, type DemoReport } from "../data/reports";
import { Mascot } from "./Mascot";
import { Icon } from "./Icon";
export function ReportDone({
  report,
  location,
  count,
}: {
  report: DemoReport;
  location: LocationRecord;
  count: number;
}) {
  const info = reportInfo(report.type);
  return (
    <main className="page done-page">
      <span className="eyebrow">A SMALL ACT, A BIG THANK YOU</span>
      <div className="done-mascot">
        <Mascot />
        <span>✦</span>
      </div>
      <h1>謝謝你幫城市變乾淨！</h1>
      <p className="muted">
        {location.label} · {info.label}
      </p>
      <p className="done-notice">
        示範回報已儲存在此瀏覽器
        {report.type === "dumping" ? " · 優先派工情境" : ""}
        <br />
        <span>未傳送給清潔隊，也不會真的派工。</span>
      </p>
      <div className="done-grid">
        <section className="card">
          <Icon name="clock" />
          <span className="eyebrow">PENDING POINTS</span>
          <strong className="done-points">+{info.points}</strong>
          <span className="status-pill half">待確認</span>
          <p>
            清潔員到場確認屬實後才入帳。
            <br />
            示範回報維持待確認，不能用於兌換。
          </p>
        </section>
        <section className="card">
          <span className="stamp-mark">順</span>
          <h2>拿到這個桶的專屬印章</h2>
          <p>
            同一個桶只收集一次。
            <br />
            {location.district}集章 {count} / 20
          </p>
          <a href="#stamps">
            查看我的集章
            <Icon name="arrow" />
          </a>
        </section>
      </div>
      <div className="next-steps">
        <h2>送出之後，會發生什麼？</h2>
        <div>
          <span>
            01<span>派工</span>
          </span>
          <i>→</i>
          <span>
            02<span>到場確認</span>
          </span>
          <i>→</i>
          <span>
            03<span>點數入帳</span>
          </span>
        </div>
        <p className="tiny">正式服務規劃流程 · 展示不會自動進行後續處理</p>
      </div>
      <a className="button primary" href="#map">
        回到地圖
        <Icon name="arrow" />
      </a>
      <a className="back-link done-back" href={`#bin/${location.id}`}>
        再看看這個小夥伴
      </a>
    </main>
  );
}
