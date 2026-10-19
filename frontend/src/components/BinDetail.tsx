import { useDemoStore } from "../data/demoStore";
import { latestCleanup } from "../data/workOrders";
import { formatDemoTime } from "../data/reports";
import type { LocationRecord } from "../data/locations";
import { useMemo, useState } from "react";
import { binDemo, stateLabels, lifecycleLabel } from "../data/binDemo";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";
import { LocationDetails } from "./LocationDetails";
import { DemoLocationMap as LocationMap } from "../map/DemoLocationMap";
const ignoreSelect = () => {};

export function BinDetail({
  location,
  liked,
  onLike,
  adopter,
  removedIds,
}: {
  location: LocationRecord;
  liked: boolean;
  onLike: () => void;
  adopter: string | null;
  removedIds: string[];
}) {
  const { state: operations } = useDemoStore();
  const cleanup = latestCleanup(operations, location.id);
  const demo = binDemo(location, removedIds, operations);
  const [showMap, setShowMap] = useState(false);
  const mapLocations = useMemo(() => [location], [location]);
  const history = [18, 24, 30, 48, 78, 94, 4, 22, demo.capacity];
  return (
    <main className="page detail-page">
      <a className="back-link" href="#map">
        <Icon name="back" />
        返回地圖
      </a>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MEET YOUR CITY BUDDY</span>
          <h1>{location.label}</h1>
          <p>
            {location.district} · #{demo.code} · 小開口桶（示意）
          </p>
        </div>
        <span className="demo-tag">桶況與設撤狀態為示意資料</span>
      </div>
      <div className="detail-grid">
        <section
          className={`buddy-card state-${demo.state}`}
          aria-label="電子雞桶況"
        >
          <div className="buddy-top">
            <span>你的城市小夥伴</span>
            <span>↗ {demo.code}</span>
          </div>
          <div className="buddy-portrait">
            <span className="spark s1">✦</span>
            <Mascot />
            <span className="spark s2">✧</span>
            <span className="buddy-shadow" />
          </div>
          <span className={`status-pill ${demo.state}`}>
            {demo.removed
              ? "已撤除"
              : demo.repairing
                ? "維修中"
                : stateLabels[demo.state]}
            {demo.capacity !== null ? " · " : ""}
            {demo.capacity !== null && `${demo.capacity}%`}
          </span>
          <h2>
            {demo.state === "full"
              ? "肚子滿滿，晚點再餵我！"
              : demo.state === "unknown"
                ? "暫時聯絡不上小夥伴"
                : "謝謝你，讓垃圾有個家。"}
          </h2>
          <p>
            {demo.removed
              ? "此桶為撤除示意，請改用其他可用桶。"
              : demo.state === "unknown"
                ? "沒有可用桶況，請到場確認。"
                : demo.state === "full"
                  ? "建議回地圖找其他還餓著的桶。"
                  : "隨手的小垃圾，就交給我吧！"}
          </p>
          <div className="buddy-tags">
            <span>認養：{adopter || "還沒有認養者"}</span>
            {lifecycleLabel(location, removedIds) && (
              <span>{lifecycleLabel(location, removedIds)}</span>
            )}
          </div>
          {!adopter && !demo.removed && (
            <a className="button secondary" href={`#adopt/${location.id}`}>
              成為這個桶的認養者
            </a>
          )}
          <span className="tiny">認養、開口與設撤狀態均為展示設定</span>
        </section>
        <div className="detail-stack">
          <section className="card capacity-card">
            <div className="section-heading">
              <h2>今天的飽足度</h2>
              <span className="tiny">示意數據 · 每 2 小時</span>
            </div>
            <p className="muted">
              {demo.capacity === null
                ? "目前讀值未知，不推估吃飽時間。"
                : demo.state === "full"
                  ? "已吃飽，等待清運中。"
                  : cleanup
                    ? `最近清運／清潔 ${formatDemoTime(cleanup.completedAt!)}（示範）`
                    : "尚無可驗證清運完成紀錄。"}
            </p>
            <div
              className="capacity-chart"
              role="img"
              aria-label={`今天 0 至 16 時飽足度示意長條圖，目前${demo.capacity === null ? "未知" : `${demo.capacity}%`}`}
            >
              {history.map((value, i) => (
                <div className="chart-column" key={i}>
                  <div
                    className={`chart-bar ${i === 8 ? "current" : ""}`}
                    style={{ height: `${value ?? 0}%` }}
                  />
                  <span>{i * 2}:00</span>
                </div>
              ))}
            </div>
            {demo.reading && (
              <p className="tiny">
                示範回傳 · 量測 {formatDemoTime(demo.reading.observedAt)} · 接收{" "}
                {formatDemoTime(demo.reading.receivedAt)}
              </p>
            )}
            <p className="tiny chart-note">
              歷史長條為固定示意，末筆反映本機桶況；非感測歷史
            </p>
          </section>
          <div className="action-row">
            <a className="button primary" href={`#nav/${location.id}`}>
              <Icon name="pin" />
              {demo.removed || demo.repairing || demo.state === "full"
                ? "尋找可用桶並導航"
                : "導航過去"}
            </a>
            {!demo.removed && (
              <a className="button secondary" href={`#report/${location.id}`}>
                <Icon name="report" />
                回報問題
              </a>
            )}
          </div>
          <section className="thanks-card">
            <span className="thanks-icon">
              <Icon name="heart" />
            </span>
            <div>
              <strong>替清潔隊留下一個讚</strong>
              <p>
                {cleanup
                  ? `清運／清潔完成 ${formatDemoTime(cleanup.completedAt!)}（示範）`
                  : "尚無可驗證清運完成紀錄"}
              </p>
              <p className="tiny">
                歷史按讚保留 · 本次感謝{" "}
                {cleanup && operations.completionLikes.includes(cleanup.id)
                  ? 1
                  : 0}{" "}
                讚
              </p>
            </div>
            <button
              className="button small"
              onClick={onLike}
              disabled={liked || !cleanup}
            >
              {liked ? "已按讚" : "按讚"}
            </button>
          </section>
          <section className="card litter-reminder">
            <span className="eyebrow">A LITTLE, NOT A BAGFUL</span>
            <h3>只收隨手垃圾，請勿投入家用垃圾</h3>
            <p className="muted">
              小開口留給外出時的小垃圾，謝謝你一起照顧環境。
            </p>
            <p>回報確認屬實，一般 +1 點、認養者 +2 點；同事件僅第一位得點。</p>
            <a href="#member">
              查看會員集點 <Icon name="arrow" />
            </a>
          </section>
        </div>
      </div>
      <div className="source-card">
        <details
          className="reference-map"
          onToggle={(event) => setShowMap(event.currentTarget.open)}
        >
          <summary>查看地圖位置</summary>
          {showMap && (
            <div className="reference-map-canvas">
              <LocationMap
                locations={mapLocations}
                selected={location}
                onSelect={ignoreSelect}
                removedIds={removedIds}
              />
            </div>
          )}
        </details>
        <LocationDetails
          location={location}
          onClose={() => {
            window.location.hash = "map";
          }}
        />
      </div>
    </main>
  );
}
