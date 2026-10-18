import type { LocationRecord } from "../data/locations";
import { useMemo, useState } from "react";
import { binDemo, stateLabels } from "../data/binDemo";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";
import { LocationDetails } from "./LocationDetails";
import { LocationMap } from "../map/LocationMap";
const ignoreSelect = () => {};

export function BinDetail({
  location,
  liked,
  onLike,
  onNotice,
}: {
  location: LocationRecord;
  liked: boolean;
  onLike: () => void;
  onNotice: (text: string) => void;
}) {
  const demo = binDemo(location);
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
        <span className="demo-tag">桶況為示意資料</span>
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
            {stateLabels[demo.state]}{" "}
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
            {demo.state === "unknown"
              ? "沒有可用桶況，請到場確認。"
              : demo.state === "full"
                ? "建議回地圖找其他還餓著的桶。"
                : "隨手的小垃圾，就交給我吧！"}
          </p>
          <div className="buddy-tags">
            <span>認養：{demo.adopter}</span>
            {demo.dog && <span>可丟狗便便</span>}
            {demo.vehicle && <span>車上垃圾可丟</span>}
            {demo.event && <span>活動限定</span>}
          </div>
          <span className="tiny">認養、開口與收受類型均為展示設定</span>
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
                  : "預計 2 小時後吃飽 · 上次清運 3 小時前（示意）"}
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
            <p className="tiny chart-note">
              12:00 清運後重新開始 · 展示時間固定為 16:00
            </p>
          </section>
          <div className="action-row">
            <a
              className="button primary"
              href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&travelmode=walking`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="pin" />
              導航過去
            </a>
            <a className="button secondary" href={`#report/${location.id}`}>
              <Icon name="report" />
              回報問題
            </a>
          </div>
          <section className="thanks-card">
            <span className="thanks-icon">
              <Icon name="heart" />
            </span>
            <div>
              <strong>替清潔隊留下一個讚</strong>
              <p>3 小時前清乾淨了 · 本月 {128 + Number(liked)} 個讚（示意）</p>
            </div>
            <button className="button small" onClick={onLike} disabled={liked}>
              {liked ? "已按讚" : "按讚"}
            </button>
          </section>
          <section className="card stamp-teaser">
            <span className="stamp-mark">順</span>
            <div>
              <h3>每個小夥伴，都有專屬印章</h3>
              <p>手機完成示範回報或掃碼，就能收集這個桶。</p>
              <a href={`#scan/${location.id}`}>
                試試示範掃碼 <Icon name="arrow" />
              </a>
            </div>
          </section>
          <button
            className="truck-notice"
            onClick={() =>
              onNotice(
                "預約小車屬於 C flow，尚未開放；家用垃圾請依台北市收運規定處理。",
              )
            }
          >
            家用垃圾請交給垃圾車 <span>明早 7:00 · 和平東路市場（示意） ↗</span>
          </button>
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
