import { useState } from "react";
import type { LocationRecord } from "../data/locations";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";

export function ScanPage({
  location,
  collected,
  loggedIn,
  loginHref,
  onCollect,
}: {
  location: LocationRecord;
  collected: boolean;
  loggedIn: boolean;
  loginHref: string;
  onCollect: () => void;
}) {
  const [proximity, setProximity] = useState("");
  return (
    <main className="page scan-page">
      <a className="back-link" href={`#bin/${location.id}`}>
        <Icon name="back" />
        返回桶詳情
      </a>
      <section className="card scan-card">
        <span className="demo-tag">示範掃碼 · 不啟用相機</span>
        <div className="done-mascot">
          <Mascot />
        </div>
        <h1>路過這裡，留個紀念。</h1>
        <p className="muted">{location.label}</p>
        <div className="stamp-mark">順</div>
        <p className="muted">
          模擬掃描桶身 QR Code，收集專屬印章。
          <br />
          印章不增加點數，同一個桶只收集一次。
        </p>
        {!collected && (
          <>
            <label className="field-label" htmlFor="scan-proximity">
              示意定位情境
            </label>
            <select
              id="scan-proximity"
              value={proximity}
              onChange={(event) => setProximity(event.target.value)}
            >
              <option value="">選擇一個展示情境</option>
              <option value="near">在桶旁 · 32 公尺</option>
              <option value="far">距離太遠 · 78 公尺</option>
              <option value="denied">無法取得定位</option>
            </select>
            {proximity && (
              <p className="tiny" role="status">
                {proximity === "near"
                  ? "示意距離 32 公尺，符合 50 公尺限制。"
                  : "示意定位不符合條件，請選擇桶旁情境。"}
              </p>
            )}
            {!loggedIn && (
              <a className="button secondary wide" href={loginHref}>
                登入後收集印章
              </a>
            )}
          </>
        )}
        <button
          className="button primary wide"
          disabled={collected || !loggedIn || proximity !== "near"}
          onClick={onCollect}
        >
          {collected ? "已收集這個印章" : "收集這個印章"}
          <Icon name="check" />
        </button>
        <a className="text-button" href="#stamps">
          前往我的集章
        </a>
        <p className="tiny">使用示意定位，不讀取真實位置。</p>
      </section>
    </main>
  );
}
