import { wasteHref, type WasteControls } from "../../data/waste";
import { WasteSelect } from "./Waste";
import { useEffect, useMemo, useState } from "react";
import {
  requestCrewRoute,
  type CrewRoute,
  type TravelMode,
} from "../../data/crewRouting";
import { query, request, type ApiLocation, type BinView } from "../../data/api";
import { LocationMap } from "../../map/LocationMap";
import { LoadState } from "./LoadState";
import { useApi } from "./useApi";
import { ORIGIN, ignoreSelect } from "./mapShared";
import { useBinView } from "./BinPage";
const NAV_ORIGIN: [number, number] = [ORIGIN.latitude, ORIGIN.longitude];
// 道路導航仍是獨立頁（#nav/<id>）：讀桶 view 後顯示導航；行為與拆檔前相同。
export function NavigationPage({
  id,
  wasteType,
  onWasteChange,
}: WasteControls & { id: string }) {
  const view = useBinView(id, wasteType);
  if (!view.data)
    return (
      <main className="page">
        <h1>桶詳情</h1>
        <LoadState {...view} />
        <a href={wasteHref("map", wasteType)}>返回地圖</a>
      </main>
    );
  return view.error ? (
    <main className="page">
      <h1>步行導航</h1>
      <WasteSelect
        value={wasteType}
        onChange={(value) => {
          if (value) onWasteChange(value);
        }}
      />
      <LoadState {...view} />
      <p>桶況尚未更新，請先重新載入確認可用性。</p>
    </main>
  ) : (
    <Navigation
      view={view.data}
      wasteType={wasteType}
      onWasteChange={onWasteChange}
    />
  );
}
export function Navigation({
  view,
  wasteType,
  onWasteChange,
}: { view: BinView } & WasteControls) {
  const available = view.status.is_usable;
  const nextPath = query("/map/nearest-usable", {
    waste_type: wasteType,
    district: "all",
    ...ORIGIN,
    limit: 3,
    ...(wasteType === "recycling" ? { waste_type: "recycling" } : {}),
  });
  const alternatives = useApi(
    available ? null : nextPath,
    (signal) => request<{ items: ApiLocation[] }>(nextPath, { signal }),
    true,
  );
  const destination = available
    ? view.location
    : alternatives.data?.items.find(
        (p) => p.id !== view.location.id && p.bin_status?.is_usable,
      );
  const mapItems = useMemo(
    () =>
      destination
        ? [
            {
              ...destination,
              bin_status: available ? view.status : destination.bin_status,
            },
          ]
        : [],
    [destination, available, view.status],
  );
  const [mode, setMode] = useState<TravelMode>("walk");
  const [revision, setRevision] = useState(0);
  const [planned, setPlanned] = useState<{
    key: string;
    route?: CrewRoute;
    error?: string;
  }>();
  const routeKey =
    destination && !alternatives.error
      ? JSON.stringify([
          mode,
          wasteType,
          destination.id,
          destination.latitude,
          destination.longitude,
        ])
      : "";
  const route = planned?.key === routeKey ? planned.route : undefined;
  const routeError = planned?.key === routeKey ? planned.error : undefined;
  const modeLabel =
    mode === "walk" ? "步行" : mode === "scooter" ? "機車" : "汽車";
  useEffect(() => {
    if (!routeKey || !destination) return;
    const controller = new AbortController();
    setPlanned(undefined);
    void requestCrewRoute(
      mode,
      [destination],
      AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      NAV_ORIGIN,
    )
      .then((route) => {
        if (!controller.signal.aborted) setPlanned({ key: routeKey, route });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setPlanned({
            key: routeKey,
            error:
              error instanceof DOMException && error.name === "TimeoutError"
                ? "路線服務逾時，請稍後重試。"
                : "目前無法取得道路路線，請稍後重試。",
          });
      });
    return () => controller.abort();
  }, [routeKey, revision]);
  return (
    <main className="page navigation-page">
      <a
        className="back-link"
        href={wasteHref(`bin/${view.location.id}`, wasteType)}
      >
        返回桶詳情
      </a>
      <h1>{modeLabel}導航</h1>
      <WasteSelect
        value={wasteType}
        onChange={(value) => {
          if (value) onWasteChange(value);
        }}
      />
      <label>
        交通方式
        <select
          aria-label="交通方式"
          value={mode}
          onChange={(event) => setMode(event.target.value as TravelMode)}
        >
          <option value="walk">步行</option>
          <option value="scooter">機車</option>
          <option value="car">汽車</option>
        </select>
      </label>
      <p>
        大安森林公園固定示意起點 · 非即時
        GPS；依所選方式規劃道路路線，非即時導航。
      </p>
      {wasteType === "recycling" && (
        <p className="tiny">本次要丟：資源回收。</p>
      )}
      {!available && (
        <p role="status">原目的桶目前不可用，依後端結果尋找替代桶。</p>
      )}
      <LoadState {...alternatives} />
      {destination ? (
        <>
          <h2 className="navigation-destination">{destination.label}</h2>
          <p>路線與時間只作示意，請依現場道路通行。</p>
          <div className="api-detail-map">
            <LocationMap
              locations={mapItems}
              selected={null}
              onSelect={ignoreSelect}
              roadRoute={route?.geometry}
              routeOrigin={route ? NAV_ORIGIN : undefined}
              routeLabel={`${modeLabel}道路路線示意`}
            />
          </div>
          {route && (
            <section className="card" aria-label="道路路線摘要">
              <h2>{modeLabel}路線</h2>
              <p>
                約 {Math.round(route.meters)} 公尺 ·{" "}
                {Math.max(1, Math.ceil(route.seconds / 60))} 分鐘（示意）
              </p>
              <ol>
                {route.legs
                  .flatMap((leg) => leg.steps)
                  .map((step, i) => (
                    <li key={i}>
                      {step.instruction} · {Math.round(step.meters)} 公尺
                    </li>
                  ))}
              </ol>
            </section>
          )}
          {routeKey && !route && !routeError && (
            <p role="status">正在規劃{modeLabel}道路路線…</p>
          )}
          {routeError && (
            <div role="alert">
              <p>{routeError}</p>
              <button
                className="button secondary"
                onClick={() => setRevision((value) => value + 1)}
              >
                重新規劃路線
              </button>
            </div>
          )}
          <a
            className="button primary"
            href={wasteHref(`report/${destination.id}`, wasteType)}
          >
            抵達後回報
          </a>
        </>
      ) : (
        !alternatives.loading && <p>目前沒有其他可用桶</p>
      )}
      <a className="back-link" href={wasteHref("map", wasteType)}>
        結束導航
      </a>
    </main>
  );
}
