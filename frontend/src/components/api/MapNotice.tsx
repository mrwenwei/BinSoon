import { useState } from "react";

const notice =
  "桶況為展示資料，非即時實測。隨手小垃圾交給 BinU，家用垃圾請交垃圾車；一般垃圾與資源回收請分開投放，吃飽了就換一個桶。";

export function MapNotice() {
  const [paused, setPaused] = useState(false);
  return (
    <section
      className={`map-notice${paused ? " paused" : ""}`}
      aria-label="找桶小提醒"
    >
      <span className="map-notice-label" aria-hidden="true">
        小提醒
      </span>
      <span className="visually-hidden">{notice}</span>
      <div className="map-notice-window" aria-hidden="true">
        <div className="map-notice-track">
          <span>{notice}</span>
          <span className="map-notice-repeat">{notice}</span>
        </div>
      </div>
      <button
        type="button"
        className="map-notice-toggle"
        aria-pressed={paused}
        aria-label={paused ? "播放提示跑馬燈" : "暫停提示跑馬燈"}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? "播放" : "暫停"}
      </button>
    </section>
  );
}
