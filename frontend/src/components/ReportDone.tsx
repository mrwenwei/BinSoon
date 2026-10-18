import type { LocationRecord } from "../data/locations";
import {
  reportAward,
  reportInfo,
  reportIsFinal,
  type DemoReport,
} from "../data/reports";
import {
  cumulativePoints,
  memberLevel,
  type DemoState,
} from "../data/demoStore";
import { Mascot } from "./Mascot";
import { Icon } from "./Icon";
export function ReportDone({
  report,
  location,
  state,
}: {
  report: DemoReport;
  location: LocationRecord;
  state: DemoState;
}) {
  const award = reportAward(report);
  const points = cumulativePoints(state);
  const level = memberLevel(points);
  const projected = reportIsFinal(report) ? points : points + award;
  return (
    <main className="page done-page">
      <span className="eyebrow">A SMALL ACT, A BIG THANK YOU</span>
      <div className="done-mascot">
        <Mascot />
        <span>✦</span>
      </div>
      <h1>謝謝你幫城市變乾淨！</h1>
      <p className="muted">
        {location.label} · {reportInfo(report.type).label}
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
          <span className="eyebrow">REVIEW BEFORE REWARD</span>
          <strong className="done-points">+{award}</strong>
          <span className="status-pill half">
            {reportIsFinal(report) ? "已有審核結果" : "審核中"}
          </span>
          <p>
            {report.firstReporter
              ? `確認屬實後${report.adopter ? "認養者得 2 點" : "一般回報得 1 點"}。`
              : "此為同事件後續回報，沒有點數獎勵。"}
            <br />
            審核前不入帳，也不能用於兌換。
          </p>
        </section>
        <section className="card">
          <span className="level-seal small-seal">{level.current.symbol}</span>
          <h2>目前等級：{level.current.name}</h2>
          <p>
            累積 {points} 點
            {!reportIsFinal(report) && ` · 通過後 ${projected} 點`}
            <br />
            {level.next
              ? `距離「${level.next.name}」還差 ${Math.max(0, level.next.threshold - projected)} 點`
              : "已達最高等級"}
          </p>
          <a href={`#review/${report.id}`}>
            看審核結果
            <Icon name="arrow" />
          </a>
        </section>
      </div>
      <div className="next-steps">
        <h2>送出之後，會發生什麼？</h2>
        <div>
          <span>
            01<span>接單</span>
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
        <p className="tiny">可在審核結果切換示意情境 · 不連接真實清潔隊</p>
      </div>
      <div className="done-actions">
        <a className="button primary" href={`#review/${report.id}`}>
          看審核結果
          <Icon name="arrow" />
        </a>
        <a className="button secondary" href="#member">
          前往會員中心
        </a>
      </div>
      <a className="back-link done-back" href="#map">
        回到地圖
      </a>
      <a className="back-link done-back" href={`#bin/${location.id}`}>
        再看看這個小夥伴
      </a>
    </main>
  );
}
