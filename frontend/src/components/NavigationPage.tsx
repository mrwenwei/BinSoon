import { useMemo, useState } from "react";
import { useQrCode } from "./useQrCode";
import {
  binDemo,
  demoDistance,
  demoOrigin,
  distanceLabel,
  isUsableBin,
  stateLabels,
  walkingMinutes,
} from "../data/binDemo";
import { locations, type LocationRecord } from "../data/locations";
import { LocationMap } from "../map/LocationMap";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";
const ignoreSelect = () => {};
export function NavigationPage({
  location,
  fromId,
}: {
  location: LocationRecord;
  fromId: string | null;
}) {
  const alternatives = useMemo(
    () =>
      locations
        .filter(isUsableBin)
        .sort((a, b) => demoDistance(a) - demoDistance(b)),
    [],
  );
  const initial = isUsableBin(location)
    ? location
    : alternatives.find((item) => item.id !== location.id);
  const [destination, setDestination] = useState(initial);
  const [unavailable, setUnavailable] = useState<string[]>(
    initial?.id !== location.id ? [location.id] : [],
  );
  const [rerouted, setRerouted] = useState(
    Boolean(fromId) || initial?.id !== location.id,
  );
  const [arrived, setArrived] = useState(false);
  const routeUrl = `${window.location.origin}${window.location.pathname}#nav/${destination?.id}${rerouted ? `?from=${fromId || location.id}` : ""}`;
  const qr = useQrCode(routeUrl, 180);
  const mapLocations = useMemo(
    () => (destination ? [destination] : []),
    [destination],
  );
  const path = useMemo<[number, number][]>(
    () =>
      destination
        ? [
            demoOrigin,
            [demoOrigin[0], destination.longitude],
            [destination.latitude, destination.longitude],
          ]
        : [],
    [destination],
  );
  function reroute() {
    if (!destination) return;
    const blocked = [...unavailable, destination.id];
    setUnavailable(blocked);
    setDestination(alternatives.find((item) => !blocked.includes(item.id)));
    setRerouted(true);
    setArrived(false);
  }
  return (
    <main className="page navigation-page">
      <a className="back-link" href={`#bin/${destination?.id || location.id}`}>
        <Icon name="back" />
        返回桶詳情
      </a>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A FEW STEPS TO A CLEANER CITY</span>
          <h1>步行導航</h1>
          <p>從大安森林公園示意起點出發</p>
        </div>
        <span className="demo-tag">示意路線 · 非即時 GPS</span>
      </div>
      {rerouted && (
        <p className="reroute-notice" role="status">
          {binDemo(location).removed && unavailable.length < 2
            ? "原目的桶已撤除，已改導另一個可用桶。"
            : unavailable.length < 2 && binDemo(location).state === "unknown"
              ? "原目的桶狀態未知，已改導另一個可用桶。"
              : "目的桶吃飽了，已改導另一個可用桶。"}
        </p>
      )}
      {destination ? (
        <div className="navigation-grid">
          <section className="navigation-map" aria-label="示意步行路線">
            <LocationMap
              locations={mapLocations}
              selected={null}
              onSelect={ignoreSelect}
              demoRoute={path}
            />
            <div className="turn-instruction">
              <span aria-hidden="true">↱</span>
              <div>
                <strong>
                  {arrived ? "示意抵達目的桶" : "沿示意路線前進，在轉角轉向"}
                </strong>
                <small>路線僅為示意，未依實際道路規劃</small>
              </div>
            </div>
          </section>
          <aside className="navigation-sidebar">
            <section className="card destination-card">
              <span className="eyebrow">YOUR DESTINATION</span>
              <div className="destination-title">
                <Mascot />
                <h2 className="navigation-destination">{destination.label}</h2>
              </div>
              <span className="status-pill hungry">
                {stateLabels[binDemo(destination).state]} · 桶況為示意
              </span>
              <div className="navigation-estimate">
                <strong>約 {walkingMinutes(destination)} 分鐘</strong>
                <span>
                  步行示意估算 · 直線 {distanceLabel(demoDistance(destination))}
                </span>
              </div>
              <p className="tiny">
                時間以直線距離 × 1.3／每分鐘 75
                公尺估算。未讀取目前位置，請勿依此指引實際通行。
              </p>
              <button
                className="button secondary wide"
                onClick={() => setArrived(true)}
                disabled={arrived}
              >
                {arrived ? "已示意抵達" : "模擬抵達"}
              </button>
              <a
                className="button primary wide"
                href={`#report/${destination.id}`}
              >
                抵達後回報
                <Icon name="report" />
              </a>
              <a className="back-link" href="#map">
                結束導航
                <Icon name="close" />
              </a>
            </section>
            <section className="card navigation-scenario">
              <h3>路上桶況更新</h3>
              <p className="muted">
                試試目的桶突然吃飽，系統會找另一個還能裝的桶。
              </p>
              <button className="button secondary wide" onClick={reroute}>
                模擬目的桶吃飽
              </button>
            </section>
            <section className="card navigation-qr">
              <h3>手機接著走</h3>
              {qr && (
                <img
                  src={qr}
                  width="180"
                  height="180"
                  alt="手機接續導航 QR Code"
                />
              )}
              <a className="qr-link tiny" href={routeUrl}>
                {routeUrl}
              </a>
              <p className="tiny">
                掃碼會開啟目前目的桶的示意導航；帳號與回報不會跨裝置同步。
              </p>
              {/^(localhost|127\.)/.test(window.location.hostname) && (
                <p className="local-notice">
                  這是本機網址，手機需可連線的部署網址。
                </p>
              )}
            </section>
          </aside>
        </div>
      ) : (
        <section className="card">
          <h2>目前沒有其他可用的示意桶</h2>
          <a className="button primary" href="#map">
            返回地圖
          </a>
        </section>
      )}
    </main>
  );
}
