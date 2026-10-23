import { Icon } from "../Icon";
import { wasteHref, type WasteControls } from "../../data/waste";
import { WasteSelect } from "./Waste";
import { WasteIcon, WastePicker, WasteTag } from "../WasteType";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
import {
  MOBILE_QUERY,
  SheetHandle,
  useBottomSheet,
  useMediaQuery,
} from "../useBottomSheet";
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
    exclude_bin_id: view.location.id,
    ...(wasteType === "recycling" ? { waste_type: "recycling" } : {}),
  });
  const alternatives = useApi(
    available ? null : nextPath,
    (signal) => request<{ items: ApiLocation[] }>(nextPath, { signal }),
    true,
  );
  const [redirected, setRedirected] = useState(false);
  useEffect(() => {
    if (available) setRedirected(false);
  }, [available]);
  const alternative = alternatives.data?.items.find(
    (p) =>
      p.id !== view.location.id &&
      p.bin_status?.is_usable &&
      p.placement_status !== "proposed" &&
      p.kind === "bin",
  );
  const destination = available
    ? view.location
    : redirected && !alternatives.error
      ? alternative
      : undefined;
  const mapItems = useMemo(
    () =>
      destination
        ? [
            {
              ...destination,
              bin_status: available ? view.status : destination.bin_status,
            },
          ]
        : [{ ...view.location, bin_status: view.status }],
    [destination, available, view.status, view.location],
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
  // 開始導航：walked＝沿路線已走公尺數。
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
  // ── 手機底部抽屜（與地圖頁共用 useBottomSheet）：地圖滿版，資訊卡疊在下方可拖曳。
  // 預設半開；開始導航自動收起（只留標題列：下一步＋結束導航），抵達或停止時回半開。
  const mobile = useMediaQuery(MOBILE_QUERY);
  const layoutRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ layout: 0, head: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const next = {
        layout: layoutRef.current?.clientHeight ?? 0,
        head:
          (handleRef.current?.offsetHeight ?? 0) +
          (headRef.current?.offsetHeight ?? 0),
      };
      setDims((previous) =>
        previous.layout === next.layout && previous.head === next.head
          ? previous
          : next,
      );
    };
    measure();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    for (const ref of [layoutRef, handleRef, headRef])
      if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [mobile]);
  const heights = useMemo(() => {
    const full = Math.max(dims.head, dims.layout - 12);
    return {
      collapsed: dims.head,
      half: Math.min(full, Math.max(dims.head, Math.round(dims.layout * 0.5))),
      full,
    };
  }, [dims]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sheet = useBottomSheet({
    enabled: mobile,
    heights,
    dragZone: ".gnav-card-head",
    scrollRef: bodyRef,
  });
  useEffect(() => {
    if (phase === "navigating" && route && walked >= totalMeters - 0.01) {
      setPhase("arrived");
      sheet.setStop("half");
    }
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
    sheet.setStop("collapsed");
  }
  function stop() {
    setPhase("idle");
    setWalked(0);
  }
  // 結束導航：回到這個桶的詳情（地圖＋抽屜，桶會飛過去並選中），保留 ?waste_type=。
  // 導航進行中先停止模擬再離開。Esc 等同按下這顆按鈕。
  const binHref = wasteHref(`bin/${view.location.id}`, wasteType);
  function end() {
    if (phase !== "idle") stop();
    window.location.hash = binHref.slice(1);
  }
  const endRef = useRef(end);
  endRef.current = end;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      endRef.current();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const style = mobile
    ? ({ "--gnav-drawer-h": `${sheet.px}px` } as CSSProperties)
    : undefined;
  return (
    <main
      className="gnav"
      ref={layoutRef}
      style={style}
      data-drawer={mobile ? sheet.stop : undefined}
    >
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
                  // 用停點高度（不是拖曳中的每一格），抽屜換停點時才重框路線；
                  // 全開時地圖幾乎被蓋住，沿用半開的框法，不把路線擠到頂端。
                  bottomInset: mobile
                    ? heights[sheet.stop === "full" ? "half" : sheet.stop]
                    : 0,
                }
              : undefined
          }
          routeLabel="步行路線"
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
      <section
        className={`gnav-card${sheet.dragging ? " dragging" : ""}`}
        aria-label="步行導航資訊"
        ref={sheet.panelRef}
        {...sheet.panelProps}
      >
        <SheetHandle ref={handleRef} {...sheet.handleProps} />
        {/* 標題列在抽屜收起時也看得到：導航中顯示下一步，右邊一顆關閉圖示＝結束導航
            （取代原本的「返回桶詳情」「結束導航」兩個小字連結）。「步行導航」標題只留給讀屏，
            下方已有路線資訊。 */}
        <div className="gnav-card-head" ref={headRef}>
          <div className="gnav-head-copy">
            <h1 className="visually-hidden">步行導航</h1>
            {/* 還沒開始導航時，目的桶名放在關閉鈕同一列，省掉一整列空白。 */}
            {phase === "idle" && destination && (
              <h2 className="navigation-destination">{destination.label}</h2>
            )}
            {phase !== "idle" && (
              <p className="gnav-peek" aria-hidden="true">
                {phase === "arrived"
                  ? "已抵達目的桶"
                  : step
                    ? `下一步：${step.text}`
                    : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            className="icon-button gnav-end"
            onClick={end}
            aria-label="結束導航"
            title="結束導航"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="gnav-body" ref={bodyRef} inert={sheet.collapsed}>
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
            <section className="navigation-reroute card" aria-label="滿桶改導">
              <h2>
                {redirected
                  ? "已改導至最近未滿的桶"
                  : view.status.fill_status === "full"
                    ? "這個桶吃飽了"
                    : "原目的桶目前不可用"}
              </h2>
              {alternative && !alternatives.error && !redirected && (
                <button
                  className="button primary"
                  onClick={() => setRedirected(true)}
                >
                  改導到 {alternative.label}
                </button>
              )}
            </section>
          )}
          <LoadState {...alternatives} />
          {destination ? (
            <>
              <div className="gnav-dest">
                {phase !== "idle" && (
                  <h2 className="navigation-destination">
                    {destination.label}
                  </h2>
                )}
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
                      {phase === "arrived" ? "重新導航" : "停止導航"}
                    </button>
                  )}
                  <button
                    className="button secondary gnav-toggle"
                    aria-expanded={listOpen}
                    aria-controls={listId}
                    onClick={() => setListOpen((open) => !open)}
                  >
                    {listOpen
                      ? "收合路線指示"
                      : `路線指示（${steps.length} 步）`}
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
                <a
                  className="button primary gnav-report"
                  href={wasteHref(`report/${destination.id}`, wasteType)}
                >
                  <Icon name="camera" />
                  {phase === "arrived" ? "拍照回報桶況" : "抵達後回報"}
                  <Icon name="arrow" />
                </a>
              </div>
            </>
          ) : (
            !alternatives.loading &&
            !alternative &&
            !available &&
            !alternatives.error && <p>目前沒有其他可用桶</p>
          )}
        </div>
      </section>
    </main>
  );
}
