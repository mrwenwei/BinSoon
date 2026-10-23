import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import L from "leaflet";
import { requestRoadRoute, type CrewRoute } from "../data/crewRouting";
import { LocationMap } from "../map/LocationMap";
import type { LocationRecord } from "../data/locations";
import {
  addDays,
  availableDates,
  countAt,
  dateLabel,
  readBookings,
  routeFor,
  shifts,
  stops,
  today,
  writeBookings,
  type Booking,
  type Shift,
} from "../data/vanDemo";
import "./van.css";
function useBookings() {
  const [bookings, set] = useState(readBookings);
  useEffect(() => {
    const refresh = () => set(readBookings());
    window.addEventListener("storage", refresh);
    window.addEventListener("van-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("van-updated", refresh);
    };
  }, []);
  return bookings;
}
// Display stops are separate from the repository's Bin / CSV data.
const vanCoordinates: Record<string, [number, number]> = {
  dongmen: [25.03358, 121.52955],
  yongkang: [25.03032, 121.5298],
  jinhua: [25.03035, 121.5312],
  lishui: [25.03042, 121.52863],
  hangzhou: [25.03025, 121.52685],
};
const vanOrigin: [number, number] = [25.033, 121.5355];
function VanMap({
  selected,
  onSelect,
  navigation = false,
  points = stops,
  counts,
  drivingRoute,
  originLabel,
}: {
  selected: string;
  onSelect?: (id: string) => void;
  navigation?: boolean;
  points?: readonly { id: string; name: string }[];
  counts?: (id: string) => number;
  drivingRoute?: CrewRoute;
  originLabel?: string;
}) {
  const pointKey = points.map((p) => p.id).join(",");
  const locations = useMemo<LocationRecord[]>(
    () =>
      pointKey.split(",").map((id) => {
        const stop = stops.find((s) => s.id === id)!;
        const [latitude, longitude] = vanCoordinates[id];
        return {
          id,
          kind: "place",
          label: stop.name,
          address: stop.address,
          latitude,
          longitude,
          district: "大安區",
          note: "",
          source_type: "local_van_demo",
          source_row: null,
          source_file: null,
          location_precision: "representative_point_only",
          reported_count: null,
        };
      }),
    [pointKey],
  );
  const select = useCallback(
    (point: LocationRecord) => onSelect?.(point.id),
    [onSelect],
  );
  const marker = (point: LocationRecord, active: boolean) =>
    L.divIcon({
      className: `van-stop-icon ${active ? "selected" : ""}`,
      html: navigation
        ? `<span>${locations.findIndex((p) => p.id === point.id) + 1}</span>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h12v12H3V5Zm12 5h4l3 4v3h-7M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0"/></svg><small>${counts?.(point.id) ?? ""} 人</small>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  return (
    <div
      className={`van-map ${navigation ? "van-map-navigation" : ""}`}
      aria-label="小車停靠點地圖"
    >
      <LocationMap
        locations={locations}
        selected={locations.find((p) => p.id === selected) || null}
        onSelect={select}
        markerIcon={marker}
        markerLabel={(p) => p.label}
        roadRoute={navigation ? drivingRoute?.geometry : undefined}
        routeLabel="汽車道路路線"
        routeOriginLabel={originLabel}
        focusSelected={false}
        focusOffsetY={0}
        autoFit
        fitKey={pointKey}
      />
    </div>
  );
}
export function CitizenVan() {
  const bookings = useBookings();
  const [view, setView] = useState<"list" | "form" | "detail">(() =>
    readBookings().some((b) => b.date > today()) ? "list" : "form",
  );
  const [date, setDate] = useState(availableDates()[0]);
  const [shift, setShift] = useState<Shift>("evening");
  const [stop, setStop] = useState<string>("dongmen");
  const [id, setId] = useState<string>();
  const [error, setError] = useState("");
  const active = bookings.filter((b) => b.date > today());
  const booking = bookings.find((b) => b.id === id);
  const save = (next: Booking[], after: () => void) => {
    try {
      writeBookings(next);
      setError("");
      after();
    } catch {
      setError("無法儲存預約，請允許瀏覽器儲存空間。");
    }
  };
  const open = (b: Booking) => {
    setId(b.id);
    setDate(b.date);
    setShift(b.shift);
    setStop(b.stop);
    setView("detail");
  };
  const selected = stops.find((s) => s.id === stop)!;
  const count = countAt(bookings, date, shift, stop);
  const published =
    today() > addDays(date, -1) ||
    (today() === addDays(date, -1) &&
      Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Taipei",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      ) >= 20);
  const assigned = routeFor(bookings, date, shift).find(
    (s) => s.id === stop || s.merged.some((m) => m.id === stop),
  );
  return (
    <main className="van-page">
      <header className="van-heading">
        {view !== "list" && (view === "detail" || active.length > 0) && (
          <button
            className="text-button"
            aria-label="返回預約"
            onClick={() => setView("list")}
          >
            <Icon name="back" />
          </button>
        )}
        <h1>{view === "detail" ? "我的清運預約" : "預約清運小車"}</h1>
        {view === "detail" && (
          <span className="van-pill">
            {published ? "路線已公布" : "等待公布路線"}
          </span>
        )}
      </header>
      {error && <p role="alert">{error}</p>}
      {view === "list" ? (
        <div className="van-content">
          <h2>已預約</h2>
          {active.map((b) => (
            <button className="van-booking" key={b.id} onClick={() => open(b)}>
              <Icon name="truck" />
              <span>
                <strong>
                  {dateLabel(b.date)} {shifts[b.shift].name} ·{" "}
                  {stops.find((s) => s.id === b.stop)?.name}
                </strong>
                <small>
                  目前 {countAt(bookings, b.date, b.shift, b.stop)} / 10 人 ·{" "}
                  {dateLabel(addDays(b.date, -1))} 20:00 公布路線
                </small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
          <button
            className="button secondary"
            onClick={() => {
              setId(undefined);
              setDate(availableDates()[0]);
              setView("form");
            }}
          >
            ＋ 再預約其他日期
          </button>
        </div>
      ) : view === "detail" && booking ? (
        <div className="van-content">
          <section className="card van-detail">
            <p>
              {dateLabel(date)} {shifts[shift].name}
            </p>
            <strong className="van-time">{shifts[shift].time}</strong>
            <h2>
              {selected.name} · {selected.address}
            </h2>
            <hr />
            <div className="van-between">
              <span>
                目前 <b>{count}</b> 人預約（含你）
              </span>
              <strong>
                {count < 10 ? `還差 ${10 - count} 人` : "已達開站人數"}
              </strong>
            </div>
            <progress max="10" value={count} />
            <p>滿 10 人就停靠</p>
          </section>
          <section className="van-booking">
            <span>
              路線公布
              <strong className="van-time">
                {dateLabel(addDays(date, -1))} 20:00
              </strong>
            </span>
          </section>
          <section className="card">
            <h2>公布路線後會怎樣</h2>
            <p>
              <span className="van-pill">滿 10 人</span>　確定停靠該站點。
            </p>
            <p>
              <span className="van-pill">不到 10 人</span>　併到最近的開站點。
            </p>
            {published && (
              <p>
                {assigned?.id === stop
                  ? "確定停靠"
                  : `併入 · ${assigned?.name}`}
              </p>
            )}
          </section>
          <button
            className="button primary"
            onClick={async () => {
              const text = `${dateLabel(date)} ${shifts[shift].name} · ${selected.name}`;
              try {
                if (navigator.share)
                  await navigator.share({
                    title: "揪親朋好友一起預約",
                    text,
                    url: `${location.origin}${location.pathname}#van`,
                  });
                else {
                  await navigator.clipboard.writeText(
                    `${text} ${location.origin}${location.pathname}#van`,
                  );
                  setError("已複製預約資訊");
                }
              } catch {
                /* Share cancellation leaves booking untouched. */
              }
            }}
          >
            揪親朋好友一起預約
          </button>
          <div className="van-two">
            <button
              className="button secondary"
              disabled={published}
              onClick={() => setView("form")}
            >
              修改預約
            </button>
            <button
              className="button secondary"
              disabled={published}
              onClick={() =>
                save(
                  bookings.filter((b) => b.id !== id),
                  () => {
                    setId(undefined);
                    setView("list");
                  },
                )
              }
            >
              取消預約
            </button>
          </div>
        </div>
      ) : (
        <>
          <VanMap
            selected={stop}
            onSelect={setStop}
            counts={(id) => countAt(bookings, date, shift, id)}
          />
          <div className="van-content">
            <h2>1. 選日期</h2>
            <div className="van-dates">
              {availableDates().map((d) => (
                <button
                  key={d}
                  aria-pressed={d === date}
                  onClick={() => setDate(d)}
                >
                  <span>
                    週
                    {
                      "日一二三四五六"[
                        new Date(`${d}T12:00:00+08:00`).getUTCDay()
                      ]
                    }
                  </span>
                  <strong>{dateLabel(d).split("（")[0]}</strong>
                </button>
              ))}
            </div>
            <h2>2. 選時段</h2>
            <div className="van-two">
              {(Object.keys(shifts) as Shift[]).map((s) => (
                <button
                  className="van-choice"
                  key={s}
                  aria-pressed={shift === s}
                  onClick={() => setShift(s)}
                >
                  <span>{shifts[s].name}</span>
                  <strong className="van-time">{shifts[s].time}</strong>
                </button>
              ))}
            </div>
            <h2>3. 選停靠點</h2>
            {stops.map((s) => {
              const n = countAt(bookings, date, shift, s.id);
              return (
                <button
                  className="van-choice"
                  key={s.id}
                  aria-pressed={stop === s.id}
                  onClick={() => setStop(s.id)}
                >
                  <div className="van-between">
                    <strong>{s.name}</strong>
                    <strong>{n} 人</strong>
                  </div>
                  <p>
                    {s.address} · 離你 {s.distance}m
                  </p>
                  <progress max="10" value={n} />
                  <small>
                    {n < 10 ? `還差 ${10 - n} 人開站` : "已達開站人數"}
                  </small>
                </button>
              );
            })}
          </div>
          <div className="van-submit">
            <button
              className="button primary"
              onClick={() => {
                if (!availableDates().includes(date)) {
                  setError("請選擇未來七天的日期");
                  return;
                }
                const duplicate = bookings.find(
                  (b) => b.date === date && b.shift === shift && b.id !== id,
                );
                if (duplicate) {
                  setError("此日期與時段已有預約");
                  return;
                }
                const next = {
                  id: id || crypto.randomUUID(),
                  date,
                  shift,
                  stop,
                };
                save([...bookings.filter((b) => b.id !== id), next], () => {
                  setId(next.id);
                  setView("detail");
                });
              }}
            >
              預約 · {dateLabel(date)} {shifts[shift].name} · {selected.name}
            </button>
            <small>
              <Icon name="clock" /> 前一天 20:00 公布路線
            </small>
          </div>
        </>
      )}
    </main>
  );
}
function VanDriving({
  currentId,
  previousId,
  points,
  onArrive,
}: {
  currentId: string;
  previousId?: string;
  points: ReturnType<typeof routeFor>;
  onArrive: () => void;
}) {
  const [result, setResult] = useState<CrewRoute>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(undefined);
    setError("");
    const [latitude, longitude] = vanCoordinates[currentId];
    void requestRoadRoute(
      "car",
      [{ latitude, longitude }],
      AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      previousId ? vanCoordinates[previousId] : vanOrigin,
    )
      .then((route) => {
        if (!controller.signal.aborted) setResult(route);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("目前無法取得汽車路線，請稍後重試。");
      });
    return () => controller.abort();
  }, [currentId, previousId, retry]);
  const current = points.find((s) => s.id === currentId)!;
  return (
    <>
      <VanMap
        selected={currentId}
        navigation
        points={points}
        drivingRoute={result}
        originLabel={
          previousId ? stops.find((s) => s.id === previousId)?.name : undefined
        }
      />
      <div className="van-content van-route-sheet">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              重新取得路線
            </button>
          </>
        ) : !result ? (
          <p role="status">正在取得汽車路線…</p>
        ) : (
          <>
            <p>{result.legs[0].steps[0]?.instruction}</p>
            <p>
              約 {Math.max(1, Math.ceil(result.seconds / 60))} 分鐘 ·{" "}
              {(result.meters / 1000).toFixed(1)} km
            </p>
          </>
        )}
        <div className="van-between">
          <h2>{current.name}</h2>
          <b className="van-pill">預計 {current.total} 人</b>
        </div>
        <div className="van-two">
          <section className="card">
            本站預約<strong>{current.count} 人</strong>
          </section>
          <section className="card">
            併入{current.merged.map((s) => ` · ${s.name}`).join("")}
            <strong>{current.total - current.count} 人</strong>
          </section>
        </div>
        <button
          className="button primary"
          disabled={!result}
          onClick={onArrive}
        >
          ✓ 到站了，開始收運
        </button>
      </div>
    </>
  );
}
export function CrewVan() {
  const bookings = useBookings();
  const [date, setDate] = useState(availableDates()[0]);
  const [shift, setShift] = useState<Shift>("evening");
  const [phase, setPhase] = useState<
    "schedule" | "navigation" | "collection" | "done"
  >("schedule");
  const [index, setIndex] = useState(0);
  const [arrival, setArrival] = useState(0);
  const [now, setNow] = useState(Date.now());
  const route = routeFor(bookings, date, shift);
  const current = route[index];
  useEffect(() => {
    if (phase !== "collection") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  const merged = route.flatMap((s) =>
    s.merged.map((m) => ({ ...m, destination: s.name })),
  );
  return (
    <main className="van-page">
      <header className="van-heading">
        {phase !== "schedule" && (
          <button
            className="text-button"
            aria-label="返回班表"
            onClick={() => setPhase("schedule")}
          >
            <Icon name="back" />
          </button>
        )}
        <h1>
          {phase === "schedule"
            ? "清運小車班表"
            : phase === "navigation"
              ? `導航到第 ${index + 1} 站`
              : phase === "done"
                ? "本班收運完成"
                : `第 ${index + 1} 站 · ${current.name}`}
        </h1>
      </header>
      {phase === "schedule" ? (
        <div className="van-content">
          <input
            aria-label="班表日期"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setIndex(0);
              }
            }}
          />
          <p>
            {dateLabel(date)} · 小車 #3 · 路線 {dateLabel(addDays(date, -1))}{" "}
            20:00 公布
          </p>
          <div className="van-two">
            {(Object.keys(shifts) as Shift[]).map((s) => (
              <button
                className="van-choice"
                key={s}
                aria-pressed={s === shift}
                onClick={() => {
                  setShift(s);
                  setIndex(0);
                }}
              >
                {shifts[s].name} {shifts[s].time}
              </button>
            ))}
          </div>
          <div className="van-two">
            <section className="card">
              <p>預約</p>
              <strong className="van-time">
                {route.reduce((n, s) => n + s.total, 0)} 人
              </strong>
              <p>前一天 20:00 統計</p>
            </section>
            <section className="card">
              <p>停靠點</p>
              <strong className="van-time">
                開 {route.length} · 併 {merged.length}
              </strong>
              <p>未滿 10 人併到最近開站點</p>
            </section>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setIndex(0);
              setPhase("navigation");
            }}
          >
            開始導航 · 第 1 站
          </button>
          <section className="card">
            <h2>開站停靠點（依路線排序）</h2>
            {route.map((s, i) => (
              <div className="van-stop-row" key={s.id}>
                <span className="van-number">{i + 1}</span>
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {shift === "evening"
                      ? `21:${String(i * 20).padStart(2, "0")}`
                      : `6:${String(i * 20).padStart(2, "0")}`}{" "}
                    到站 · 本站 {s.count}
                    {s.merged.map((m) => `＋併入${m.name} ${m.count}`).join("")}
                  </small>
                </span>
                <b className="van-pill">預計 {s.total} 人</b>
              </div>
            ))}
          </section>
          <section className="card">
            <h2>這班併站（不停）</h2>
            {merged.map((s) => (
              <div className="van-stop-row" key={s.id}>
                <span>
                  <strong>
                    {s.name} · {s.count} 人
                  </strong>
                  <small>→併入{s.destination}</small>
                </span>
              </div>
            ))}
          </section>
        </div>
      ) : phase === "done" ? (
        <div className="van-content">
          <section className="card">
            <Icon name="check" />
            <h2>
              已完成 {route.length} / {route.length} 站
            </h2>
          </section>
          <button
            className="button primary"
            onClick={() => setPhase("schedule")}
          >
            返回班表
          </button>
        </div>
      ) : phase === "navigation" ? (
        <>
          <p className="van-content">
            {shifts[shift].name} {shifts[shift].time} · 已完成 {index} /{" "}
            {route.length} 站
          </p>
          <VanDriving
            key={`${date}/${shift}/${index}/${current.id}`}
            currentId={current.id}
            previousId={index > 0 ? route[index - 1].id : undefined}
            points={route}
            onArrive={() => {
              setArrival(Date.now());
              setNow(Date.now());
              setPhase("collection");
            }}
          />
        </>
      ) : (
        <div className="van-content">
          <section className="van-collect">
            <span className="van-pill">收運中</span>
            <strong className="van-time">
              剩 {Math.max(0, Math.ceil((arrival + 15 * 60000 - now) / 60000))}{" "}
              分鐘
            </strong>
            <p>
              {new Intl.DateTimeFormat("zh-TW", {
                timeZone: "Asia/Taipei",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(arrival + 15 * 60000))}{" "}
              前出發
              {index + 1 < route.length ? `到${route[index + 1].name}` : ""}
            </p>
          </section>
          <section className="card">
            <div className="van-between">
              <h2>本站預計</h2>
              <strong className="van-time">{current.total} 人</strong>
            </div>
            <div className="van-between">
              <p>本站預約</p>
              <b>{current.count} 人</b>
            </div>
            {current.merged.map((s) => (
              <div className="van-between" key={s.id}>
                <p>併入 · {s.name}</p>
                <b>{s.count} 人</b>
              </div>
            ))}
          </section>
          <button
            className="button primary"
            onClick={() => {
              if (index + 1 === route.length) setPhase("done");
              else {
                setIndex(index + 1);
                setPhase("navigation");
              }
            }}
          >
            本站完成
            {index + 1 < route.length
              ? `，導航到第 ${index + 2} 站`
              : "，完成本班收運"}
          </button>
        </div>
      )}
    </main>
  );
}
