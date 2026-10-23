import type { LocationRecord } from "../../data/locations";

// 地圖瀏覽模式：選場所代表點（地標）後在面板內原地顯示，骨架對齊 BinPanel：
// 靠左標題（＋「場所」膠囊）→ 一張色帶摘要卡 → 預設收合的「資料來源」。
// 不放動作按鈕；回清單同桶詳情（點地圖空白處、Esc、隱藏的「回到清單」）。
// 色帶不用桶況三色（場所不是桶），改用場所電子雞的身體色 --place。
// reported_count 是周邊清潔箱的統計數，不是桶的實際位置（領域規則）。
export function PlacePanel({ location }: { location: LocationRecord }) {
  const count = location.reported_count;
  return (
    <div className="api-bin-detail mx-bin mx-place">
      <div className="page-heading bin-heading">
        <div className="bin-title">
          <div className="bin-title-row">
            <h1>{location.label}</h1>
            <span className="status-pill">場所</span>
          </div>
        </div>
      </div>
      <section className="station-card mx-place-card" aria-label="周邊清潔箱">
        <div className="station-band">
          <div>
            <strong className="band-status">周邊的清潔箱</strong>
          </div>
          {count != null && (
            <span className="band-numeral" aria-label={`${count} 處`}>
              {count}
              <small>處</small>
            </span>
          )}
        </div>
        <p className="mx-place-note">
          這是場所代表點，不是桶的實際位置；周邊清潔箱是統計數量。
        </p>
      </section>
      <details className="compartment-sources mx-place-source">
        <summary>資料來源</summary>
        <dl>
          {/* 來源備註常只是「46處」這類跟色帶重複的數量，重複時不再列。 */}
          {location.note &&
            location.note.replace(/\s/g, "") !==
              `${location.reported_count}處` && (
              <>
                <dt>備註</dt>
                <dd>{location.note}</dd>
              </>
            )}
          <dt>經度 / 緯度</dt>
          <dd className="coordinates">
            {location.longitude} / {location.latitude}
          </dd>
          <dt>來源檔案</dt>
          <dd>
            {location.source_file} · 原始列 {location.source_row}
          </dd>
          <dt>來源類型</dt>
          <dd>{location.source_type}</dd>
          <dt>位置精度</dt>
          <dd>{location.location_precision}</dd>
        </dl>
      </details>
    </div>
  );
}
