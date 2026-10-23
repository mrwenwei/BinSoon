import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { Icon } from "./Icon";
import { VanStop } from "./Pixel";
import { vanStopSvg } from "./pixelArt";
import {
  MOBILE_QUERY,
  SheetHandle,
  useBottomSheet,
  useMediaQuery,
} from "./useBottomSheet";
import L from "leaflet";
import { requestRoadRoute, type CrewRoute } from "../data/crewRouting";
import { LocationMap } from "../map/LocationMap";
import type { LocationRecord } from "../data/locations";
import {
  NEAR_M,
  VAN_ORIGIN,
  addDays,
  availableDates,
  bestSlot,
  countAt,
  dateLabel,
  distanceM,
  distanceText,
  needAt,
  readBookings,
  routeFor,
  shifts,
  shortDate,
  slotNeedText,
  stops,
  today,
  vanCoordinates,
  writeBookings,
  type Booking,
  type Shift,
} from "../data/vanDemo";
import "./van.css";
export function useBookings() {
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
// 市民端預約小車：#van 瀏覽（地圖＋清單）、#van/stop/<id> 選日期時段、
// #van/mine 我的預約列表、#van/booking/<id> 預約詳情。資料只在本機 localStorage（VAN_KEY）。
let lastVanStop: string | undefined;
const go = (hash: string) => {
  window.location.hash = hash;
};
function isPublished(date: string) {
  return (
    today() > addDays(date, -1) ||
    (today() === addDays(date, -1) &&
      Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Taipei",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      ) >= 20)
  );
}
const stopRecord = (stop: (typeof stops)[number]): LocationRecord => ({
  id: stop.id,
  kind: "place",
  label: stop.name,
  address: stop.address,
  latitude: stop.lat,
  longitude: stop.lng,
  district: "大安區",
  note: "",
  source_type: "local_van_demo",
  source_row: null,
  source_file: null,
  location_precision: "representative_point_only",
  reported_count: null,
});
const vanOriginMarker = { ...VAN_ORIGIN, label: "起點" };
const vanInitialCenter: [number, number] = [
  VAN_ORIGIN.latitude,
  VAN_ORIGIN.longitude,
];
const vanMarker = (_: LocationRecord, active: boolean) =>
  L.divIcon({
    className: `pixel-marker mx-landmark vanstop ${active ? "selected" : ""}`,
    html: `<span class="marker-body">${vanStopSvg(2)}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 40],
  });
const slotSummary = (d: string, s: Shift, need: number) =>
  `${shortDate(d)} ${shifts[s].name} ${need > 0 ? `差 ${need} 人` : "已開站"}`;

function VanBrowse({ stopId, editId }: { stopId?: string; editId?: string }) {
  const bookings = useBookings();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const detail = stops.find((s) => s.id === stopId);
  const [q, setQ] = useState("");
  const [near, setNear] = useState(false);
  const [soon, setSoon] = useState(false);
  const all = useMemo(
    () =>
      stops
        .map((s) => ({
          stop: s,
          meters: distanceM(s),
          best: bestSlot(bookings, s.id),
        }))
        .sort((a, b) => a.meters - b.meters),
    [bookings],
  );
  const nearestId = all[0].stop.id;
  const rows = all.filter(
    ({ stop, meters, best }) =>
      `${stop.name}${stop.address}`.includes(q.trim()) &&
      (!near || meters <= NEAR_M) &&
      (!soon || best.need <= 3),
  );
  const highlightId = detail?.id ?? lastVanStop ?? nearestId;
  useEffect(() => {
    if (detail) lastVanStop = detail.id;
  }, [detail?.id]);
  const selected = stops.find((s) => s.id === highlightId);
  // 開著詳情時地圖顯示全部停靠點（篩選只作用在清單）。
  const shownIds = (detail ? all : rows).map((r) => r.stop.id).join(",");
  const mapItems = useMemo(() => {
    const shown = shownIds
      ? shownIds
          .split(",")
          .map((id) => stopRecord(stops.find((s) => s.id === id)!))
      : [];
    return selected && !shown.some((p) => p.id === selected.id)
      ? [...shown, stopRecord(selected)]
      : shown;
  }, [shownIds, selected?.id]);
  const suffix = editId ? `?edit=${editId}` : "";
  const select = useCallback(
    (p: LocationRecord) => {
      if (p.id === detail?.id) return;
      lastVanStop = p.id;
      const fromList = !detail;
      window.location.hash = `van/stop/${p.id}${suffix}`;
      // 記在這筆瀏覽紀錄上：上一筆就是清單，關閉詳情時直接回上一頁。
      if (fromList) history.replaceState({ vanFromList: true }, "");
    },
    [detail?.id, suffix],
  );
  const closeDetail = useCallback(() => {
    if (editId) window.location.hash = `van/booking/${editId}`;
    else if ((history.state as { vanFromList?: boolean } | null)?.vanFromList)
      history.back();
    else window.location.hash = "van";
  }, [editId]);
  useEffect(() => {
    if (!detail) return;
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closeDetail();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [detail?.id, closeDetail]);
  const description = useCallback(
    (p: LocationRecord) => {
      const row = all.find((r) => r.stop.id === p.id);
      return row
        ? `${distanceText(row.meters)}，${slotSummary(row.best.date, row.best.shift, row.best.need)}`
        : undefined;
    },
    [all],
  );
  // 抽屜（只在手機）：同 MapPage 的量法。
  const layoutRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ layout: 0, head: 0, toolbar: 0 });
  const [focusKey, setFocusKey] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const next = {
        layout: layoutRef.current?.clientHeight ?? 0,
        toolbar: toolbarRef.current?.offsetHeight ?? 0,
        head:
          (handleRef.current?.offsetHeight ?? 0) +
          (headRef.current?.offsetHeight ?? 0),
      };
      setDims((p) =>
        p.layout === next.layout &&
        p.head === next.head &&
        p.toolbar === next.toolbar
          ? p
          : next,
      );
    };
    measure();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    for (const ref of [layoutRef, handleRef, headRef, toolbarRef])
      if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [mobile, !!detail]);
  const heights = useMemo(() => {
    const full = Math.max(
      dims.head,
      dims.layout - (dims.toolbar ? dims.toolbar + 24 : 12),
    );
    // 詳情半開 65%：標題、幾列時段與底部固定的確認按鈕都看得到。
    const half = detail
      ? Math.round(dims.layout * 0.7)
      : Math.min(300, Math.round(dims.layout * 0.42));
    return {
      collapsed: dims.head,
      half: Math.min(full, Math.max(dims.head, half)),
      full,
    };
  }, [dims, !!detail]);
  const sheet = useBottomSheet({
    enabled: mobile,
    heights,
    dragZone: ".mx-panel-head",
    scrollRef: bodyRef,
  });
  const { stop: drawer, setStop: setDrawer, px: drawerPx } = sheet;
  useEffect(() => {
    if (detail) setDrawer("half");
  }, [detail?.id]);
  const previousDrawer = useRef(drawer);
  useEffect(() => {
    if (previousDrawer.current === "full" && drawer === "half")
      setFocusKey((k) => k + 1);
    previousDrawer.current = drawer;
  }, [drawer]);
  const focusOffsetY = mobile ? Math.round(heights.half / 2) : 0;
  const viewOffsetY = mobile
    ? Math.round(
        (heights[drawer] - (detail || !dims.toolbar ? 0 : dims.toolbar + 8)) /
          2,
      )
    : 0;
  const style = mobile
    ? ({
        "--mx-drawer-h": `${drawerPx}px`,
        "--mx-toolbar-h": `${dims.toolbar}px`,
      } as CSSProperties)
    : undefined;
  // 清單 ⇄ 詳情換畫面：詳情從頂端開始，回清單時捲回原本位置。
  const contentKey = detail ? `stop/${detail.id}` : "list";
  const listScroll = useRef(0);
  const shownContent = useRef(contentKey);
  useLayoutEffect(() => {
    if (shownContent.current === contentKey) return;
    shownContent.current = contentKey;
    if (bodyRef.current)
      bodyRef.current.scrollTop = detail ? 0 : listScroll.current;
  }, [contentKey]);
  const mine = bookings.filter((b) => b.date > today()).length;
  const reset = () => {
    setQ("");
    setNear(false);
    setSoon(false);
  };
  return (
    <main
      className={`mx-layout px-map van-browse${detail ? "" : " mx-home"}`}
      ref={layoutRef}
      style={style}
      data-drawer={mobile ? drawer : undefined}
    >
      {!detail && (
        <div
          ref={toolbarRef}
          className="mx-home-toolbar"
          aria-label="停靠點搜尋與篩選"
        >
          <div className="mx-home-controls">
            <label className="search-field">
              <span className="visually-hidden">搜尋停靠點</span>
              <input
                type="search"
                aria-label="搜尋停靠點"
                placeholder="搜尋站名、地址⋯"
                maxLength={200}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className="filter-chips" role="group" aria-label="篩選">
              <button
                type="button"
                aria-pressed={near}
                onClick={() => setNear(!near)}
              >
                離我近
              </button>
              <button
                type="button"
                aria-pressed={soon}
                onClick={() => setSoon(!soon)}
              >
                快開站
              </button>
            </div>
          </div>
        </div>
      )}
      <section
        className={`mx-panel${sheet.dragging ? " dragging" : ""}`}
        aria-label={detail ? "停靠點詳情" : "停靠點清單"}
        data-view={detail ? "stop" : "list"}
        ref={sheet.panelRef}
        {...sheet.panelProps}
      >
        <SheetHandle ref={handleRef} {...sheet.handleProps} />
        {detail ? (
          <StopDetail
            key={`${detail.id}/${editId}`}
            stop={detail}
            editId={editId}
            headRef={headRef}
            bodyRef={bodyRef}
            collapsed={sheet.collapsed}
            onBack={closeDetail}
          />
        ) : (
          <>
            <div className="mx-panel-head" ref={headRef}>
              <div className="mx-head-title">
                <h1 className="mx-title">預約清運小車</h1>
                <a className="text-button van-mine-link" href="#van/mine">
                  我的預約{mine ? `（${mine}）` : ""}
                </a>
              </div>
            </div>
            <div
              className="mx-panel-body"
              ref={bodyRef}
              inert={sheet.collapsed}
              onScroll={(e) => {
                listScroll.current = e.currentTarget.scrollTop;
              }}
            >
              <div className="mx-panel-content" key={contentKey}>
                {rows.length > 0 ? (
                  <ul className="mx-list" aria-label="小車停靠點">
                    {rows.map(({ stop, meters, best }) => (
                      <li key={stop.id}>
                        <button
                          type="button"
                          className={`location-row van-row${stop.id === highlightId ? " active" : ""}`}
                          aria-current={
                            stop.id === highlightId ? "true" : undefined
                          }
                          data-id={stop.id}
                          onClick={() => select(stopRecord(stop))}
                        >
                          <span className="row-buddy vanstop">
                            <VanStop />
                          </span>
                          <span className="row-copy">
                            <span className="mx-row-title">
                              <strong>{stop.name}</strong>
                              {stop.id === nearestId && (
                                <span className="status-pill">離你最近</span>
                              )}
                            </span>
                            <small>
                              {stop.address} · {distanceText(meters)}
                            </small>
                            <small className="van-row-slot">
                              最快：
                              {slotSummary(best.date, best.shift, best.need)}
                            </small>
                          </span>
                          <Icon name="arrow" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mx-empty">
                    <p>找不到符合的停靠點。</p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={reset}
                    >
                      清除搜尋與篩選
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
      <div className="mx-map van-browse-map">
        <LocationMap
          basemap="pixel"
          locations={mapItems}
          selected={selected ? stopRecord(selected) : null}
          onSelect={select}
          initialCenter={vanInitialCenter}
          fitKey={
            !detail && mapItems.length
              ? `${mapItems.map((p) => p.id).join(",")}/${focusOffsetY}`
              : undefined
          }
          markerIcon={vanMarker}
          markerLabel={(p) => `小車停靠點：${p.label}`}
          markerDescription={description}
          origin={vanOriginMarker}
          focusSelected={!!detail}
          focusMinZoom={15}
          focusOffsetY={focusOffsetY}
          viewOffsetY={viewOffsetY}
          focusKey={focusKey}
          onBackgroundTap={detail ? closeDetail : undefined}
        />
      </div>
    </main>
  );
}

// 抽屜／側欄裡的停靠點詳情：標題列（返回清單）、可捲動的 14 格時段、底部固定的確認按鈕。
function StopDetail({
  stop,
  editId,
  headRef,
  bodyRef,
  collapsed,
  onBack,
}: {
  stop: (typeof stops)[number];
  editId?: string;
  headRef: RefObject<HTMLDivElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  collapsed: boolean;
  onBack: () => void;
}) {
  const bookings = useBookings();
  const editing = editId ? bookings.find((b) => b.id === editId) : undefined;
  const others = bookings.filter((b) => b.id !== editing?.id);
  const dates = availableDates();
  const dayNeed = (d: string) =>
    Math.min(
      ...(Object.keys(shifts) as Shift[]).map((s) =>
        needAt(others, d, s, stop.id),
      ),
    );
  // 預設日期：最早有「快開站／已開站」時段的日期，否則明天；修改模式用原預約。
  const [date, setDate] = useState(
    editing?.date ?? dates.find((d) => dayNeed(d) <= 3) ?? dates[0],
  );
  const [shift, setShift] = useState<Shift | null>(editing?.shift ?? null);
  const [error, setError] = useState("");
  const chipsRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  // 選中的日期自動捲到可見（置中）；第一次直接到位，之後平滑捲動。
  useEffect(() => {
    const box = chipsRef.current;
    const chip = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !chip) return;
    box.scrollTo({
      left: chip.offsetLeft - (box.clientWidth - chip.offsetWidth) / 2,
      behavior: scrolled.current ? "smooth" : "auto",
    });
    scrolled.current = true;
  }, [date]);
  const seeded = useRef(!!editing);
  useEffect(() => {
    // 重新整理後 bookings 才讀到：把原本的日期與時段預選一次。
    if (editing && !seeded.current) {
      seeded.current = true;
      setDate(editing.date);
      setShift(editing.shift);
    }
  }, [editing]);
  const taken = (d: string, s: Shift) =>
    others.some((b) => b.date === d && b.shift === s);
  const chooseDate = (d: string) => {
    setDate(d);
    if (shift && taken(d, shift)) setShift(null);
    setError("");
  };
  const submit = () => {
    if (!shift) return;
    if (!dates.includes(date)) {
      setError("請選擇未來七天的日期");
      return;
    }
    if (taken(date, shift)) {
      setError("此日期與時段已有預約");
      return;
    }
    const next: Booking = {
      id: editing?.id ?? crypto.randomUUID(),
      date,
      shift,
      stop: stop.id,
    };
    try {
      writeBookings([...bookings.filter((b) => b.id !== next.id), next]);
      setError("");
      window.location.replace(`#van/booking/${next.id}`);
    } catch {
      setError("無法儲存預約，請允許瀏覽器儲存空間。");
    }
  };
  return (
    <>
      <div className="mx-panel-head van-detail-head" ref={headRef}>
        <span className="row-buddy vanstop">
          <VanStop />
        </span>
        <div className="van-head-text">
          <h1 className="mx-title">{stop.name}</h1>
          <small>離你 {distanceText(distanceM(stop))}</small>
        </div>
      </div>
      <div className="mx-panel-body" ref={bodyRef} inert={collapsed}>
        <div className="mx-panel-content van-sheet-content">
          {/* 平常視覺隱藏、鍵盤聚焦才出現（同桶地圖），讀屏與鍵盤用。 */}
          <button
            type="button"
            className="text-button mx-close-detail"
            onClick={onBack}
          >
            {editing ? "回到預約詳情" : "回到清單"}
          </button>
          {error && <p role="alert">{error}</p>}
          <section className="van-section" aria-labelledby="van-pick-date">
            <h2 id="van-pick-date">選日期</h2>
            <div
              className="van-datechips"
              role="group"
              aria-label="選日期"
              ref={chipsRef}
            >
              {dates.map((d, i) => {
                const need = dayNeed(d);
                const hint =
                  need === 0 ? "✓開站" : need <= 3 ? `差${need}人` : "";
                const weekday = "日一二三四五六"[
                  new Date(`${d}T12:00:00+08:00`).getUTCDay()
                ];
                return (
                  <button
                    type="button"
                    key={d}
                    className="van-datechip"
                    aria-pressed={d === date}
                    aria-label={`${shortDate(d)} 週${weekday}${hint ? `，${hint}` : ""}`}
                    onClick={() => chooseDate(d)}
                    onKeyDown={(e) => {
                      const to =
                        e.key === "ArrowRight"
                          ? i + 1
                          : e.key === "ArrowLeft"
                            ? i - 1
                            : -1;
                      const list =
                        chipsRef.current?.querySelectorAll<HTMLElement>(
                          ".van-datechip",
                        );
                      if (to < 0 || !list?.[to]) return;
                      e.preventDefault();
                      list[to].focus();
                    }}
                  >
                    <span>週{weekday}</span>
                    <strong>{shortDate(d)}</strong>
                    <em aria-hidden="true">{hint}</em>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="van-section" aria-labelledby="van-pick-shift">
            <h2 id="van-pick-shift">選時段</h2>
            <div className="van-shifts" role="group" aria-label="選時段">
              {(Object.keys(shifts) as Shift[]).map((s) => {
                const mine = taken(date, s);
                const need = needAt(others, date, s, stop.id);
                return (
                  <button
                    type="button"
                    key={s}
                    className={`van-slot${need === 0 ? " open" : need <= 3 ? " soon" : ""}`}
                    aria-pressed={mine ? undefined : shift === s}
                    disabled={mine}
                    onClick={() => {
                      setShift(s);
                      setError("");
                    }}
                  >
                    <b>{shifts[s].name}</b>
                    <span>{shifts[s].time}</span>
                    <strong>{mine ? "你已預約" : slotNeedText(need)}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      {!collapsed && (
        <div className="van-panel-foot">
          <button className="button primary" disabled={!shift} onClick={submit}>
            {shift
              ? `${editing ? "更新預約" : "預約"} ${shortDate(date)} ${shifts[shift].name} · ${stop.name}`
              : "請先選一個時段"}
          </button>
          <small>
            <Icon name="clock" /> 前一天 20:00 公布路線
          </small>
        </div>
      )}
    </>
  );
}

function VanMine() {
  const bookings = useBookings();
  const active = bookings
    .filter((b) => b.date > today())
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift),
    );
  return (
    <main className="van-page">
      <header className="van-heading">
        <a className="text-button" href="#member" aria-label="返回我的">
          <Icon name="back" />
        </a>
        <h1>我的小車預約</h1>
      </header>
      <div className="van-content">
        {active.length ? (
          <>
            <h2>已預約</h2>
            {active.map((b) => (
              <button
                className="van-booking"
                key={b.id}
                onClick={() => go(`van/booking/${b.id}`)}
              >
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
            <a className="button secondary" href="#van">
              ＋ 再預約其他日期
            </a>
          </>
        ) : (
          <>
            <p>還沒有預約。選一個停靠點與時段，滿 10 人小車就會停靠。</p>
            <a className="button primary" href="#van">
              預約清運小車
            </a>
          </>
        )}
      </div>
    </main>
  );
}

function VanBookingDetail({ bookingId }: { bookingId?: string }) {
  const bookings = useBookings();
  const [error, setError] = useState("");
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking)
    return (
      <main className="van-page">
        <header className="van-heading">
          <a className="text-button" href="#van/mine" aria-label="返回我的預約">
            <Icon name="back" />
          </a>
          <h1>我的清運預約</h1>
        </header>
        <div className="van-content">
          <p>找不到這筆預約，可能已取消。</p>
          <a className="button secondary" href="#van/mine">
            看我的預約
          </a>
        </div>
      </main>
    );
  const { date, shift } = booking;
  const selected = stops.find((s) => s.id === booking.stop)!;
  const count = countAt(bookings, date, shift, booking.stop);
  const published = isPublished(date);
  const assigned = routeFor(bookings, date, shift).find(
    (s) => s.id === booking.stop || s.merged.some((m) => m.id === booking.stop),
  );
  return (
    <main className="van-page">
      <header className="van-heading">
        <a className="text-button" href="#van/mine" aria-label="返回我的預約">
          <Icon name="back" />
        </a>
        <h1>我的清運預約</h1>
        <span className="van-pill">
          {published ? "路線已公布" : "等待公布路線"}
        </span>
      </header>
      {error && <p role="alert">{error}</p>}
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
              {assigned?.id === booking.stop
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
            onClick={() => go(`van/stop/${booking.stop}?edit=${booking.id}`)}
          >
            修改預約
          </button>
          <button
            className="button secondary"
            disabled={published}
            onClick={() => {
              try {
                writeBookings(bookings.filter((b) => b.id !== booking.id));
                go("van/mine");
              } catch {
                setError("無法儲存預約，請允許瀏覽器儲存空間。");
              }
            }}
          >
            取消預約
          </button>
        </div>
      </div>
    </main>
  );
}

export function CitizenVan({
  view,
  target,
  edit,
}: {
  view?: string;
  target?: string;
  edit?: string | null;
}) {
  return view === "stop" ? (
    <VanBrowse stopId={target} editId={edit ?? undefined} />
  ) : view === "mine" ? (
    <VanMine />
  ) : view === "booking" ? (
    <VanBookingDetail key={target} bookingId={target} />
  ) : (
    <VanBrowse />
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
