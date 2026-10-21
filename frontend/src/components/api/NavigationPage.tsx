import { wasteHref, type WasteControls } from "../../data/waste";
import { WasteSelect } from "./Waste";
import { WasteIcon, WastePicker, WasteTag } from "../WasteType";
import { useEffect, useId, useMemo, useState } from "react";
import { requestCrewRoute, type CrewRoute } from "../../data/crewRouting";
import { cumulativeMeters } from "../../data/routeGeometry";
import {
  activeStep,
  buildNavSteps,
  distanceText,
  type TurnKind,
} from "../../data/navSteps";
import { query, request, type ApiLocation, type BinView } from "../../data/api";
import { LocationMap } from "../../map/LocationMap";
import { LoadState } from "./LoadState";
import { useApi } from "./useApi";
import { ORIGIN, ignoreSelect } from "./mapShared";
import { useBinView } from "./BinPage";
const NAV_ORIGIN: [number, number] = [ORIGIN.latitude, ORIGIN.longitude];
// 市民導航只有步行（Valhalla pedestrian）；起點固定大安森林公園，不取 GPS。
const SIM_METERS_PER_SECOND = 40; // 模擬前進速度（約真實步行的 30 倍），固定不變。
const SIM_HOP_MS = 1500; // 減少動態時：每隔這段時間直接跳到下一個轉彎點。
const ARROW_PATHS: Record<TurnKind, string[]> = {
  straight: ["M12 19V5", "m5 12 7-7 7 7"],
  right: ["m15 14 5-5-5-5", "M4 20v-7a4 4 0 0 1 4-4h12"],
  left: ["m9 14-5-5 5-5", "M20 20v-7a4 4 0 0 0-4-4H4"],
  uturn: ["m9 14-5-5 5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  arrive: [
    "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z",
    "M12 7v6",
    "M9 10h6",
  ],
};
function TurnArrow({ kind }: { kind: TurnKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ARROW_PATHS[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
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
  const [revision, setRevision] = useState(0);
  const [planned, setPlanned] = useState<{
    key: string;
    route?: CrewRoute;
    error?: string;
  }>();
  const routeKey =
    destination && !alternatives.error
      ? JSON.stringify([
          "walk",
          wasteType,
          destination.id,
          destination.latitude,
          destination.longitude,
        ])
      : "";
  const route = planned?.key === routeKey ? planned.route : undefined;
  const routeError = planned?.key === routeKey ? planned.error : undefined;
  // 模擬開始導航：walked＝沿路線已走公尺數。
  const [phase, setPhase] = useState<"idle" | "navigating" | "arrived">("idle");
  const [walked, setWalked] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const listId = useId();
  const steps = useMemo(() => (route ? buildNavSteps(route) : []), [route]);
  const totalMeters = useMemo(() => {
    if (!route) return 0;
    const cum = cumulativeMeters(route.geometry);
    return cum[cum.length - 1] || route.meters;
  }, [route]);
  const current = activeStep(steps, walked);
  useEffect(() => {
    if (!routeKey || !destination) return;
    const controller = new AbortController();
    setPlanned(undefined);
    setPhase("idle");
    setWalked(0);
    void requestCrewRoute(
      "walk",
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
  // 以固定速度沿路線前進；減少動態偏好時不做連續動畫，改為定時跳到下一個轉彎點。
  useEffect(() => {
    if (phase !== "navigating" || !route) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      const timer = window.setInterval(() => {
        setWalked((value) => {
          const next = steps.find((step) => step.endMeters > value + 0.5);
          return next ? next.endMeters : totalMeters;
        });
      }, SIM_HOP_MS);
      return () => window.clearInterval(timer);
    }
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const seconds = Math.min(now - last, 100) / 1000;
      last = now;
      setWalked((value) =>
        Math.min(totalMeters, value + seconds * SIM_METERS_PER_SECOND),
      );
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, route, steps, totalMeters]);
  useEffect(() => {
    if (phase === "navigating" && route && walked >= totalMeters - 0.01)
      setPhase("arrived");
  }, [phase, route, walked, totalMeters]);
  const step = steps[current];
  const remainingMeters = Math.max(0, totalMeters - walked);
  const minutes = route
    ? Math.max(
        1,
        Math.ceil(
          (route.seconds * (totalMeters ? remainingMeters / totalMeters : 1)) /
            60 || 0,
        ),
      )
    : 0;
  const bannerKind: TurnKind =
    phase === "arrived" ? "arrive" : (step?.kind ?? "straight");
  const announcement =
    phase === "arrived"
      ? "已抵達目的桶"
      : phase === "navigating" && step
        ? `下一步：${step.text}`
        : "";
  function start() {
    setWalked(0);
    setPhase("navigating");
  }
  function stop() {
    setPhase("idle");
    setWalked(0);
  }
  return (
    <main className="gnav">
      <div className="gnav-map">
        <LocationMap
          locations={mapItems}
          selected={null}
          onSelect={ignoreSelect}
          navRoute={
            route
              ? {
                  geometry: route.geometry,
                  walkedMeters: phase === "idle" ? 0 : walked,
                  startLabel: "起點 · 大安森林公園",
                  topInset: phase === "idle" ? 0 : 110,
                }
              : undefined
          }
          routeLabel="步行路線示意"
        />
        {phase !== "idle" && step && (
          <div
            className={`gnav-banner${phase === "arrived" ? " arrived" : ""}`}
            data-testid="nav-banner"
          >
            <span className="gnav-banner-icon">
              <TurnArrow kind={bannerKind} />
            </span>
            <div>
              <strong className="gnav-banner-distance">
                {phase === "arrived"
                  ? "已抵達"
                  : distanceText(Math.max(0, step.endMeters - walked))}
              </strong>
              <span className="gnav-banner-text">
                {phase === "arrived" ? "目的桶就在這裡" : step.action}
              </span>
            </div>
          </div>
        )}
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <section className="gnav-card" aria-label="步行導航資訊">
        <div className="gnav-card-head">
          <h1 className="gnav-title">步行導航</h1>
          <div className="gnav-head-links">
            <a
              className="back-link"
              href={wasteHref(`bin/${view.location.id}`, wasteType)}
            >
              返回桶詳情
            </a>
            <a className="back-link" href={wasteHref("map", wasteType)}>
              結束導航
            </a>
          </div>
        </div>
        <WastePicker
          name="nav-waste"
          legend="垃圾種類"
          value={wasteType}
          onChange={onWasteChange}
        />
        {wasteType === "recycling" && (
          <p className="tiny">
            <span className="waste-tag">
              <WasteIcon type="recycling" />
              本次要丟：資源回收。
            </span>
          </p>
        )}
        {!available && (
          <p role="status">原目的桶目前不可用，依後端結果尋找替代桶。</p>
        )}
        <LoadState {...alternatives} />
        {destination ? (
          <>
            <div className="gnav-dest">
              <h2 className="navigation-destination">{destination.label}</h2>
              <WasteTag type={wasteType} />
            </div>
            {route && (
              <div className="gnav-summary" aria-label="步行路線摘要">
                {phase === "arrived" ? (
                  <strong className="gnav-arrived">已抵達目的桶</strong>
                ) : (
                  <>
                    <strong className="gnav-minutes">
                      {minutes}
                      <small> 分鐘</small>
                    </strong>
                    <span className="gnav-distance">
                      {phase === "navigating"
                        ? `剩餘 ${distanceText(remainingMeters)}`
                        : distanceText(route.meters)}
                      {" · 步行"}
                    </span>
                  </>
                )}
              </div>
            )}
            {routeKey && !route && !routeError && (
              <p role="status">正在規劃步行道路路線…</p>
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
            {route && (
              <div className="gnav-actions">
                {phase === "idle" ? (
                  <button className="button primary" onClick={start}>
                    開始導航
                  </button>
                ) : (
                  <button className="button secondary" onClick={stop}>
                    {phase === "arrived" ? "重新模擬" : "停止模擬"}
                  </button>
                )}
                <button
                  className="button secondary gnav-toggle"
                  aria-expanded={listOpen}
                  aria-controls={listId}
                  onClick={() => setListOpen((open) => !open)}
                >
                  {listOpen ? "收合路線指示" : `路線指示（${steps.length} 步）`}
                </button>
              </div>
            )}
            {route && (
              <section
                id={listId}
                className="gnav-steps"
                aria-labelledby={`${listId}-title`}
                hidden={!listOpen}
              >
                <h3 id={`${listId}-title`}>逐步轉彎指示</h3>
                <ol>
                  {steps.map((item, index) => (
                    <li
                      key={index}
                      aria-current={
                        phase === "navigating" && index === current
                          ? "step"
                          : undefined
                      }
                      className={
                        phase !== "idle" &&
                        (phase === "arrived" || item.endMeters <= walked)
                          ? "done"
                          : undefined
                      }
                    >
                      <TurnArrow kind={item.kind} />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <div className="gnav-foot">
              <p className="tiny gnav-note">
                示意起點：大安森林公園，非即時
                GPS；路線與時間僅供示意，請依現場道路通行。
                {phase !== "idle" && "模擬前進為加速示意。"}
              </p>
              <a
                className={`gnav-report${phase === "arrived" ? " arrived" : ""}`}
                href={wasteHref(`report/${destination.id}`, wasteType)}
              >
                抵達後回報
              </a>
            </div>
          </>
        ) : (
          <>{!alternatives.loading && <p>目前沒有其他可用桶</p>}</>
        )}
      </section>
    </main>
  );
}
