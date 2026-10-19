import { useCallback, useEffect, useRef, useState } from "react";
import { demoOrigin, distanceLabel } from "../../data/binDemo";
import {
  requestCrewRoute,
  vehicleLabels,
  type CrewRoute,
  type CrewVehicle,
} from "../../data/crewRouting";
import type { LocationRecord } from "../../data/locations";
import type { WorkOrder } from "../../data/workOrders";
import { reportTypes } from "../../data/reports";
import { LocationMap } from "../../map/LocationMap";

export function StaffRoutePage({
  bins,
  tasks,
  vehicle,
  onVehicleChange,
}: {
  bins: LocationRecord[];
  tasks: WorkOrder[];
  vehicle: CrewVehicle;
  onVehicleChange: (value: CrewVehicle) => void;
}) {
  const requestKey = JSON.stringify([
    vehicle,
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
      if (task) window.location.hash = "staff/tasks/" + task.id;
    },
    [tasks],
  );
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [requestKey],
  );
  useEffect(
    () => () => {
      clearTimeout(cooldown.current);
    },
    [],
  );
  async function generate() {
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
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ONE STOP AT A TIME.</span>
          <h1>今日示範清運路線</h1>
          <p>
            {bins.length} 個桶 · {tasks.length} 張工單 ·
            待修繕／待感測確認另在處理中查看
          </p>
        </div>
      </div>
      <section
        className="card crew-route-controls"
        aria-label="清運交通方式與起點"
      >
        <fieldset>
          <legend>隊員交通方式</legend>
          {(["scooter", "car"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="crew-vehicle"
                value={value}
                checked={vehicle === value}
                onChange={() => {
                  onVehicleChange(value);
                  setResult(undefined);
                  setProgress(undefined);
                }}
              />
              {value === "scooter" ? "機車（一般機車）" : "汽車"}
            </label>
          ))}
        </fieldset>
        <p>起點：大安森林公園（示範起點）</p>
        <p className="tiny">
          依派工順序逐站行駛；切換交通方式或待辦站點變動後，請重新產生指引。
        </p>
        <button
          className="button primary"
          disabled={
            !bins.length || currentProgress?.status === "loading" || coolingDown
          }
          onClick={generate}
        >
          {currentProgress?.status === "loading"
            ? "正在規劃道路路線…"
            : "產生路線指引"}
        </button>
        {currentProgress?.status === "loading" && (
          <p role="status">正在取得{vehicleLabels[vehicle]}道路路線…</p>
        )}
        {currentProgress?.status === "error" && (
          <p role="alert">{currentProgress.message} 站點與工單仍可查看。</p>
        )}
        {route && (
          <div className="crew-route-summary" role="status">
            <strong>{vehicleLabels[vehicle]}路線已更新</strong>
            <span>道路里程 {distanceLabel(route.meters)}</span>
            <span>
              預估行駛 {Math.max(1, Math.ceil(route.seconds / 60))} 分鐘
            </span>
          </div>
        )}
      </section>
      <div className="staff-route-map">
        <LocationMap
          locations={bins}
          selected={null}
          onSelect={selectBin}
          roadRoute={route?.geometry}
          routeOrigin={demoOrigin}
          routeLabel={vehicleLabels[vehicle] + "道路路線"}
        />
      </div>
      <p className="tiny crew-route-attribution">
        道路路線由{" "}
        <a
          href="https://valhalla.openstreetmap.de/"
          target="_blank"
          rel="noreferrer"
        >
          Valhalla／FOSSGIS
        </a>{" "}
        依 OpenStreetMap
        計算；不含即時路況與停靠作業時間，站點順序未最佳化。請依現場標誌與車種限制行駛。
      </p>
      <ol className="staff-route-list">
        {bins.map((bin, index) => (
          <li key={bin.id}>
            <strong>{bin.label}</strong>
            {route && (
              <details open={index === 0}>
                <summary>
                  前往此站的{vehicleLabels[vehicle]}指引 ·{" "}
                  {distanceLabel(route.legs[index].meters)} · 約{" "}
                  {Math.max(1, Math.ceil(route.legs[index].seconds / 60))} 分鐘
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
            )}
            {tasks
              .filter((task) => task.locationId === bin.id)
              .map((task) => (
                <a
                  key={task.id}
                  className="button secondary"
                  href={"#staff/tasks/" + task.id}
                >
                  {reportTypes.find((type) => type.id === task.type)?.label} ·
                  查看工單
                </a>
              ))}
          </li>
        ))}
      </ol>
      {!tasks.length && (
        <section className="card">
          <h2>已無一般清運下一站</h2>
          <p>可回清單查看待修繕或等待感測確認的工單。</p>
        </section>
      )}
    </>
  );
}
