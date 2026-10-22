import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { distanceLabel } from "../data/binDemo";
import {
  requestCrewRoute,
  vehicleLabels,
  type CrewRoute,
  type CrewVehicle,
} from "../data/crewRouting";
import type { LocationRecord } from "../data/locations";
import type { OperationalState } from "../data/workOrders";
import { LocationMap } from "../map/LocationMap";
import { Icon } from "./Icon";

const defaultTaskHref = (id: string) => "#staff/tasks/" + id;

export type RouteTask = { id: string; locationId: string; label: string };

export function CrewRoutePlanner({
  bins,
  tasks,
  vehicle,
  onVehicleChange,
  origin,
  operations,
  ready = true,
  available = true,
  stopNotes,
  taskHref = defaultTaskHref,
  title = "今日清運路線",
  afterMap,
  backHref = "#staff/tasks",
}: {
  bins: LocationRecord[];
  tasks: RouteTask[];
  origin: [number, number];
  operations?: OperationalState;
  ready?: boolean;
  available?: boolean;
  stopNotes?: Record<string, string>;
  taskHref?: (id: string) => string;
  title?: string;
  afterMap?: ReactNode;
  backHref?: string;
  vehicle: CrewVehicle;
  onVehicleChange: (value: CrewVehicle) => void;
}) {
  const requestKey = JSON.stringify([
    vehicle,
    origin,
    available,
    tasks.map((task) => [task.id, task.locationId]),
    bins.map((bin) => [bin.id, bin.latitude, bin.longitude]),
  ]);
  const [result, setResult] = useState<{ key: string; route: CrewRoute }>();
  const [progress, setProgress] = useState<{
    key: string;
    status: "loading" | "error";
    message?: string;
  }>();
  const [coolingDown, setCoolingDown] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const cooldown = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const route = result?.key === requestKey ? result.route : undefined;
  const currentProgress = progress?.key === requestKey ? progress : undefined;
  const selectBin = useCallback(
    (bin: LocationRecord) => {
      const task = tasks.find((task) => task.locationId === bin.id);
      if (task) window.location.hash = taskHref(task.id).slice(1);
    },
    [tasks, taskHref],
  );
  useEffect(() => {
    setResult(undefined);
    setProgress(undefined);
    return () => {
      controller.current?.abort();
    };
  }, [requestKey]);
  useEffect(
    () => () => {
      clearTimeout(cooldown.current);
    },
    [],
  );
  async function generate() {
    if (
      !ready ||
      !available ||
      !bins.length ||
      (controller.current && currentProgress?.status === "loading")
    )
      return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setProgress({ key: requestKey, status: "loading" });
    setResult(undefined);
    setCoolingDown(true);
    cooldown.current = setTimeout(() => setCoolingDown(false), 1500);
    try {
      const route = await requestCrewRoute(
        vehicle,
        bins,
        AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
        origin,
      );
      if (!request.signal.aborted) {
        setResult({ key: requestKey, route });
        setProgress(undefined);
      }
    } catch (error) {
      if (!request.signal.aborted)
        setProgress({
          key: requestKey,
          status: "error",
          message:
            error instanceof DOMException && error.name === "TimeoutError"
              ? "路線服務逾時，請稍後重試。"
              : error instanceof TypeError
                ? "目前無法取得道路路線，請確認網路後重試。"
                : error instanceof Error
                  ? error.message
                  : "目前無法取得道路路線。",
        });
    }
  }
  const loading = currentProgress?.status === "loading";
  const error = currentProgress?.status === "error";
  return (
    <section className="crew-route-page">
      <header className="crew-route-heading">
        <div>
          <span className="eyebrow">清潔隊 · 路線規劃</span>
          <h1>{title}</h1>
        </div>
        <span className="crew-route-count">
          <strong>{bins.length}</strong> 站<span aria-hidden="true">／</span>
          <strong>{tasks.length}</strong> 張工單
        </span>
      </header>
      <section className="crew-route-controls" aria-label="清運交通方式與起點">
        <fieldset>
          <legend>隊員交通方式</legend>
          <div className="crew-vehicle-switch">
            {(["scooter", "car"] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="crew-vehicle"
                  value={value}
                  aria-label={value === "scooter" ? "機車（一般機車）" : "汽車"}
                  checked={vehicle === value}
                  onChange={() => {
                    onVehicleChange(value);
                    setResult(undefined);
                    setProgress(undefined);
                  }}
                />
                <Icon name={value === "scooter" ? "scooter" : "car"} />
                <span>
                  {value === "scooter" ? "機車" : "汽車"}
                  {value === "scooter" && (
                    <small className="crew-vehicle-description">一般機車</small>
                  )}
                </span>
                <Icon name="check" />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="crew-route-origin">
          <span className="crew-origin-symbol">
            <Icon name="pin" />
          </span>
          <div>
            <span>
              出發地點 <small>起點</small>
            </span>
            <strong>大安森林公園</strong>
            <small>
              {origin[0]} / {origin[1]} · 無即時 GPS
            </small>
          </div>
        </div>
        <button
          className="button primary crew-route-generate"
          disabled={
            !ready || !available || !bins.length || loading || coolingDown
          }
          onClick={generate}
          aria-busy={loading}
        >
          {loading ? (
            <span className="crew-route-loader" aria-hidden="true" />
          ) : (
            <Icon name="route" />
          )}
          <span>{loading ? "正在規劃道路路線…" : "產生路線指引"}</span>
        </button>
        <div className="crew-route-feedback">
          {error ? (
            <p role="alert">
              <Icon name="report" />
              <span>{currentProgress.message} 站點與工單仍可查看。</span>
            </p>
          ) : (
            <p role="status">
              <Icon name={route ? "check" : loading ? "clock" : "route"} />
              <span>
                {!bins.length
                  ? "今日已無待清運站點。"
                  : loading
                    ? "正在取得" + vehicleLabels[vehicle] + "道路路線，請稍候。"
                    : route
                      ? vehicleLabels[vehicle] + "路線已更新，可展開各站指引。"
                      : "選擇交通方式，依派工順序規劃每一站。"}
              </span>
            </p>
          )}
          <span className="crew-route-order-note">
            車種或站點變動後須重新規劃
          </span>
        </div>
      </section>
      <div className="crew-route-workspace">
        <section
          className="crew-route-map-panel"
          aria-label="路線地圖"
          aria-busy={loading}
        >
          <dl className="crew-route-summary" aria-label="路線概況">
            <div>
              <dt>
                <Icon name="route" />
                道路里程
              </dt>{" "}
              <dd>
                {route ? (
                  distanceLabel(route.meters)
                ) : (
                  <span className="crew-route-placeholder">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="clock" />
                預估行駛
              </dt>{" "}
              <dd>
                {route ? (
                  Math.max(1, Math.ceil(route.seconds / 60)) + " 分鐘"
                ) : (
                  <span className="crew-route-placeholder">—</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="staff-route-map">
            <LocationMap
              locations={bins}
              binMarkerLabel="清運站點"
              selected={null}
              onSelect={selectBin}
              roadRoute={route?.geometry}
              routeOrigin={origin}
              operations={operations}
              routeLabel={vehicleLabels[vehicle] + "道路路線"}
            />
          </div>
          <p className="crew-route-attribution">
            由{" "}
            <a
              href="https://valhalla.openstreetmap.de/"
              target="_blank"
              rel="noreferrer"
            >
              Valhalla／FOSSGIS
            </a>{" "}
            依 OpenStreetMap
            計算。預估時間不含即時路況與停靠作業；請依現場標誌及車種限制行駛。
          </p>
          {afterMap}
        </section>
        <section className="crew-route-itinerary" aria-label="清運站點">
          <header>
            <div>
              <span className="eyebrow">依序前往</span>
              <h2>清運站點</h2>
            </div>
            <span>{bins.length} 站</span>
          </header>
          <ol className="staff-route-list" role="list">
            {bins.map((bin, index) => (
              <li key={bin.id} className="crew-route-stop">
                <span className="crew-stop-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="crew-stop-content">
                  {index === 0 && (
                    <span className="crew-next-stop">下一站</span>
                  )}
                  <h3>{bin.label}</h3>
                  {stopNotes?.[bin.id] && (
                    <p className="crew-stop-pending">{stopNotes[bin.id]}</p>
                  )}
                  {route ? (
                    <details open={index === 0}>
                      <summary>
                        <span>
                          前往此站的{vehicleLabels[vehicle]}指引{" "}
                          <small>
                            {distanceLabel(route.legs[index].meters)} · 約{" "}
                            {Math.max(
                              1,
                              Math.ceil(route.legs[index].seconds / 60),
                            )}{" "}
                            分鐘
                          </small>
                        </span>
                        <Icon name="chevron" />
                      </summary>
                      <ol className="crew-route-steps">
                        {route.legs[index].steps.map((step, i) => (
                          <li key={i}>
                            <span>{step.instruction}</span>
                            {step.meters > 0 && (
                              <small>行駛 {distanceLabel(step.meters)}</small>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : (
                    <p className="crew-stop-pending">
                      {loading ? "指引規劃中…" : "規劃路線後查看道路指引"}
                    </p>
                  )}
                  <div className="crew-stop-actions">
                    {tasks
                      .filter((task) => task.locationId === bin.id)
                      .map((task) => (
                        <a
                          key={task.id}
                          className="button secondary"
                          href={taskHref(task.id)}
                        >
                          {task.label} · 查看工單
                          <Icon name="arrow" />
                        </a>
                      ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {!tasks.length && (
            <div className="crew-route-empty">
              <span>
                <Icon name="check" />
              </span>
              <h2>已無一般清運下一站</h2>
              <p>待修繕與待感測工單可在派工清單查看。</p>
              <a className="button secondary" href={backHref}>
                回到派工清單
                <Icon name="arrow" />
              </a>
            </div>
          )}
          <p className="crew-route-list-note">
            按派工順序排列；待修繕／待感測確認另在處理中查看。站點順序未最佳化。
          </p>
        </section>
      </div>
    </section>
  );
}
