import {
  wasteName,
  wasteHref,
  type WasteControls,
  type WasteType,
} from "../../data/waste";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  allPages,
  apiBinState,
  apiCompartments,
  query,
  type ApiCompartment,
  type ApiLocation,
} from "../../data/api";
import { stateLabels, usableCount } from "../../data/binState";
import { stateVisual } from "../binVisual";
import type { LocationRecord } from "../../data/locations";
import { LocationMap } from "../../map/LocationMap";
import {
  browseMarkerIcon,
  browseMarkerLabel,
  isProposed,
  landmarkSvg,
  usableFor,
  wasteState,
} from "../../map/browseMarkers";
import { Mascot } from "../Mascot";
import { WasteIcon, WastePicker } from "../WasteType";
import { FillBar } from "../StationCard";
import { LocationDetails } from "../LocationDetails";
import { LoadState } from "./LoadState";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { ORIGIN } from "./mapShared";
import { BinPanel } from "./BinPage";

// ── 地圖瀏覽模式 ─────────────────────────────────────────────────────
// 手機：地圖滿版＋下方抽屜（收起／半開／全開）；桌面：左側面板＋右側地圖。
// 面板未選桶時是「附近的桶」清單；選桶（#bin/<id>）或地標（#map?place=<id>）
// 時原地顯示資訊。資料流照原本：/map/locations 全部分頁讀完、?waste_type=
// 決定看哪一槽。清單列、篩選膠囊、狀態膠囊、圖例都沿用既有元件。

type Filter = "all" | "usable" | "new" | "proposed";
const filters: [Filter, string][] = [
  ["all", "全部"],
  ["usable", "還能丟"],
  ["new", "新設"],
  ["proposed", "建議點"],
];
type Drawer = "collapsed" | "half" | "full";
const drawerOrder: Drawer[] = ["collapsed", "half", "full"];
const drawerNames: Record<Drawer, string> = {
  collapsed: "收起",
  half: "半開",
  full: "全開",
};
const MOBILE_QUERY = "(max-width: 760px)";
const SEARCH_DELAY_MS = 300;
const originMarker = { ...ORIGIN, label: "起點（示意）" };
const initialCenter: [number, number] = [ORIGIN.latitude, ORIGIN.longitude];
// 原本頁尾的資料揭露句；地圖頁不再顯示頁尾（避免整頁可捲），改放在面板底部。
const DISCLOSURE = "所有滿度目前皆為 simulated 模擬讀值，尚無真實 IoT 接收。";

function useMediaQuery(media: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(media).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(media);
    const change = () => setMatches(list.matches);
    change();
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [media]);
  return matches;
}
function distanceText(item: ApiLocation) {
  if (item.distance_m == null) return "距離未知";
  return item.distance_m < 1000
    ? `${Math.round(item.distance_m)} 公尺`
    : `${(item.distance_m / 1000).toFixed(1)} 公里`;
}
function walkText(item: ApiLocation) {
  return item.walking_estimate_seconds == null
    ? null
    : `步行 ${Math.max(1, Math.round(item.walking_estimate_seconds / 60))} 分鐘`;
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
// 換種類只換網址參數，不多一筆瀏覽紀錄（返回鍵直接回上一個畫面）。
function replaceWaste(value: WasteType) {
  window.location.replace(
    wasteHref(window.location.hash.slice(1) || "map", value),
  );
}

export function MapPage({
  wasteType,
  binId,
  placeId,
}: WasteControls & { binId?: string; placeId?: string }) {
  const { session } = useSession();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  // 搜尋停止輸入 300ms 後才送出；換字時 useApi 會取消上一個讀取。
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(q), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [q]);
  const [binLocation, setBinLocation] = useState<ApiLocation | null>(null);
  const mobile = useMediaQuery(MOBILE_QUERY);
  // 全台北市一次讀完（district=all，後端可接受），建議點也一起讀，前端再依篩選分：
  // 「還能丟」看所選種類那一槽；「新設」跟原本一樣交給後端 filter=new。
  const path = query("/map/locations", {
    waste_type: wasteType,
    district: "all",
    kind: "all",
    filter: filter === "new" ? "new" : "all",
    q: search,
    include_proposed: true,
    ...ORIGIN,
  });
  const list = useApi(
    path,
    async (signal) => ({
      data: await allPages<ApiLocation>(path, {
        signal,
        token: session?.access_token,
      }),
      etag: null,
      replayed: false,
    }),
    true,
    // 開著桶面板時暫停清單輪詢（用不到清單）；回到清單立刻重抓一次再恢復。
    { paused: Boolean(binId) },
  );
  const items = list.data;
  // 清單只列桶；選「建議點」時才列建議點。所選種類還能丟的排前面，其餘照後端距離順序。
  const rows = useMemo(() => {
    if (!items) return undefined;
    const bins = items.filter(
      (item) =>
        item.kind === "bin" &&
        (filter === "proposed"
          ? isProposed(item)
          : !isProposed(item) &&
            (filter !== "usable" || usableFor(item, wasteType))),
    );
    return bins
      .map((item, index) => ({ item, index, ok: usableFor(item, wasteType) }))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.index - b.index)
      .map(({ item }) => item);
  }, [items, filter, wasteType]);
  const place =
    !binId && placeId
      ? (items?.find((item) => item.id === placeId && item.kind === "place") ??
        null)
      : null;
  // 開著桶面板時清單暫停輪詢；面板的 view 每次更新都帶最新桶況，
  // 拿它蓋過清單裡那一筆，地圖上這個桶的標記才會跟面板一致。
  const fresh = binId && binLocation?.id === binId ? binLocation : null;
  const withFresh = useCallback(
    (item: ApiLocation) =>
      fresh && item.id === fresh.id
        ? {
            ...item,
            bin_status: fresh.bin_status,
            compartments: fresh.compartments,
          }
        : item,
    [fresh],
  );
  const listed = binId ? items?.find((item) => item.id === binId) : undefined;
  const selected: ApiLocation | null = binId
    ? listed
      ? withFresh(listed)
      : fresh
    : place;
  // 地圖：「全部」顯示桶＋地標＋建議點；其他篩選只顯示清單上的點。選中的點一定顯示。
  const mapItems = useMemo(() => {
    const shown = ((filter === "all" ? items : rows) ?? []).map(withFresh);
    return selected && !shown.some((item) => item.id === selected.id)
      ? [...shown, selected]
      : shown;
  }, [items, rows, filter, selected, withFresh]);
  // 選桶、選地標都寫進網址（push），瀏覽器返回鍵回到清單；選完把焦點移到面板標題。
  const pendingFocus = useRef<string | null>(null);
  const layoutRef = useRef<HTMLElement>(null);
  const focusTitle = useCallback((id: string) => {
    if (pendingFocus.current !== id) return;
    const title = layoutRef.current?.querySelector<HTMLElement>(
      ".mx-panel-body h1, .mx-panel-body h2",
    );
    if (!title) return;
    pendingFocus.current = null;
    title.setAttribute("tabindex", "-1");
    title.focus({ preventScroll: true });
  }, []);
  const select = useCallback(
    (item: LocationRecord) => {
      // 再點一次已選取的桶／地標不做任何事（焦點只在選取對象改變時移動一次）。
      if (item.id === (item.kind === "bin" ? binId : placeId)) return;
      pendingFocus.current = item.id;
      window.location.hash = (
        item.kind === "bin"
          ? wasteHref(`bin/${item.id}`, wasteType)
          : wasteHref(`map?place=${encodeURIComponent(item.id)}`, wasteType)
      ).slice(1);
    },
    [wasteType, binId, placeId],
  );
  const binLoaded = useCallback(
    (location: ApiLocation) => {
      setBinLocation(location);
      focusTitle(location.id);
    },
    [focusTitle],
  );
  useEffect(() => {
    if (place) focusTitle(place.id);
  }, [place?.id, focusTitle]);
  const iconFor = useCallback(
    (location: LocationRecord, active: boolean) =>
      browseMarkerIcon(location, active, wasteType),
    [wasteType],
  );

  // ── 抽屜（只在手機） ──
  const handleRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState<Drawer>("half");
  const [dims, setDims] = useState({ layout: 0, head: 0 });
  const [dragPx, setDragPx] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const drag = useRef<{
    id: number;
    y: number;
    h: number;
    moved: boolean;
    onHandle: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const measure = () =>
      setDims({
        layout: layoutRef.current?.clientHeight ?? 0,
        head:
          (handleRef.current?.offsetHeight ?? 0) +
          (headRef.current?.offsetHeight ?? 0),
      });
    measure();
    const observer = new ResizeObserver(measure);
    for (const ref of [layoutRef, handleRef, headRef])
      if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [mobile]);
  const heights = useMemo(() => {
    const full = Math.max(dims.head, dims.layout - 12);
    return {
      collapsed: dims.head,
      half: Math.min(full, Math.max(dims.head, Math.round(dims.layout * 0.5))),
      full,
    };
  }, [dims]);
  const drawerPx = dragPx ?? heights[drawer];
  // 全開時點把手回半開；收起只靠往下拖。
  const cycle = () =>
    setDrawer((d) =>
      d === "collapsed" ? "half" : d === "half" ? "full" : "half",
    );
  // 選了桶或地標：抽屜一律回半開（全開時地圖幾乎被蓋住，收起時看不到資訊）。
  useEffect(() => {
    if (binId || placeId) setDrawer("half");
  }, [binId, placeId]);
  // 從全開回到半開時，把目前選取重新置中到抽屜上方的可見區。
  const previousDrawer = useRef<Drawer>(drawer);
  useEffect(() => {
    if (previousDrawer.current === "full" && drawer === "half")
      setFocusKey((k) => k + 1);
    previousDrawer.current = drawer;
  }, [drawer]);
  const pointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!mobile) return;
    const target = e.target as HTMLElement;
    if (!target.closest(".mx-handle-wrap, .mx-panel-head")) return;
    const control = target.closest("button, a, input, select, label");
    if (control && !control.classList.contains("mx-handle")) return;
    drag.current = {
      id: e.pointerId,
      y: e.clientY,
      h: drawerPx,
      moved: false,
      onHandle: Boolean(target.closest(".mx-handle-wrap")),
    };
  };
  const pointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dy) < 6) return;
      d.moved = true;
      try {
        e.currentTarget.setPointerCapture(d.id);
      } catch {
        /* 有些瀏覽器在指標已放開時會丟例外，拖曳照樣可用。 */
      }
    }
    setDragPx(clamp(d.h - dy, heights.collapsed, heights.full));
  };
  const pointerEnd = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.moved) {
      const current = clamp(
        d.h - (e.clientY - d.y),
        heights.collapsed,
        heights.full,
      );
      const best = drawerOrder.reduce((a, b) =>
        Math.abs(heights[b] - current) < Math.abs(heights[a] - current) ? b : a,
      );
      setDrawer(best);
      setDragPx(null);
    } else if (e.type === "pointerup") {
      if (d.onHandle) cycle();
      else if (drawer === "collapsed") setDrawer("half");
    }
  };
  const handleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = drawerOrder.indexOf(drawer);
    if (e.key === "ArrowUp" && i < 2) {
      e.preventDefault();
      setDrawer(drawerOrder[i + 1]);
    } else if (e.key === "ArrowDown" && i > 0) {
      e.preventDefault();
      setDrawer(drawerOrder[i - 1]);
    }
  };
  const collapsed = mobile && drawer === "collapsed" && dragPx === null;
  // 選取一律在半開時置中，所以位移固定用半開高度的一半。
  const focusOffsetY = mobile ? Math.round(heights.half / 2) : 0;
  const style = mobile
    ? ({ "--mx-drawer-h": `${drawerPx}px` } as CSSProperties)
    : undefined;
  const resetFilters = () => {
    setQ("");
    setSearch("");
    setFilter("all");
  };
  const view = binId ? "bin" : place ? "place" : "list";
  const listHref = wasteHref("map", wasteType);

  return (
    <main
      className="mx-layout"
      ref={layoutRef}
      style={style}
      data-drawer={mobile ? drawer : undefined}
    >
      <section
        className={`mx-panel${dragPx !== null ? " dragging" : ""}`}
        aria-label="資訊面板"
        data-view={view}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
      >
        <div className="mx-handle-wrap" ref={handleRef}>
          <button
            type="button"
            className="mx-handle"
            aria-label={`面板高度：${drawerNames[drawer]}。按一下切換，或用上下鍵調整`}
            onClick={(e) => {
              if (e.detail === 0) cycle();
            }}
            onKeyDown={handleKey}
          >
            <span aria-hidden="true" />
          </button>
        </div>
        <div className="mx-panel-head" ref={headRef}>
          {view === "list" ? (
            <>
              {/* 標題下方小字：數量＋排序依據（所選種類能丟的排前面）。 */}
              <div className="mx-head-title">
                <h1 className="mx-title">附近的桶</h1>
                <span className="tiny">
                  {rows
                    ? `${rows.length} 個桶 · ${wasteName(wasteType)}優先`
                    : "—"}
                </span>
              </div>
              <WastePicker
                name="map-waste"
                legend="垃圾種類"
                iconOnly
                value={wasteType}
                onChange={replaceWaste}
              />
            </>
          ) : (
            <a className="back-link" href={listHref}>
              ← 返回清單
            </a>
          )}
        </div>
        <div className="mx-panel-body" inert={collapsed}>
          {view === "bin" ? (
            <BinPanel
              key={`${binId}/${wasteType}`}
              id={binId!}
              wasteType={wasteType}
              onLocation={binLoaded}
            />
          ) : view === "place" ? (
            <>
              <p className="mx-note">
                這是地標，不是垃圾桶，周邊約 {place!.reported_count ?? "—"}{" "}
                處清潔箱。
                {walkText(place!) &&
                  `距起點 ${distanceText(place!)} · ${walkText(place!)}。`}
              </p>
              <LocationDetails
                location={place!}
                onClose={() => {
                  window.location.hash = listHref.slice(1);
                }}
              />
            </>
          ) : (
            <>
              <div className="mx-filters">
                {/* 搜尋框、篩選膠囊各自一列；種類切換在上方標題列。 */}
                <label className="search-field">
                  <span className="visually-hidden">搜尋地點</span>
                  <input
                    type="search"
                    aria-label="搜尋地點"
                    placeholder="搜尋路名、地點⋯"
                    maxLength={200}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </label>
                <div className="filter-chips" role="group" aria-label="篩選">
                  {filters.map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <LoadState {...list} />
              {rows && rows.length > 0 && (
                <ul className="mx-list" aria-label="附近的桶">
                  {rows.map((item) => (
                    <li key={item.id}>
                      <NearbyRow
                        item={item}
                        wasteType={wasteType}
                        onSelect={select}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {rows?.length === 0 && (
                <div className="mx-empty">
                  <p>找不到符合的桶。</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={resetFilters}
                  >
                    清除搜尋與篩選
                  </button>
                </div>
              )}
            </>
          )}
          <p className="tiny mx-disclosure">{DISCLOSURE}</p>
        </div>
      </section>
      <div className="mx-map">
        <LocationMap
          locations={mapItems}
          selected={selected}
          onSelect={select}
          initialCenter={initialCenter}
          fitKey={search.trim() || undefined}
          markerIcon={iconFor}
          markerLabel={browseMarkerLabel}
          origin={originMarker}
          focusOffsetY={focusOffsetY}
          focusKey={focusKey}
        />
        <LegendPopover
          wasteType={wasteType}
          closeKey={`${binId ?? ""}|${placeId ?? ""}`}
        />
      </div>
    </main>
  );
}

// 清單列沿用 .location-row：電子雞（所選種類那一槽的狀態）、桶名（新設時旁邊
// 一顆「新設」膠囊）、距離，下一行兩槽滿度條並排（所選種類在左），右側兩槽可丟數。
function NearbyRow({
  item,
  wasteType,
  onSelect,
}: {
  item: ApiLocation;
  wasteType: WasteType;
  onSelect: (item: LocationRecord) => void;
}) {
  const proposed = isProposed(item);
  const state = proposed ? "offline" : wasteState(item, wasteType);
  const parts = apiCompartments(item.bin_status, item.compartments);
  const ordered = [...parts].sort(
    (a, b) =>
      Number(b.waste_type === wasteType) - Number(a.waste_type === wasteType),
  );
  const usable = usableCount(parts.map((c) => ({ state: apiBinState(c) })));
  const walk = walkText(item);
  return (
    <button
      type="button"
      className="location-row"
      onClick={() => onSelect(item)}
    >
      <span className={`row-buddy ${stateVisual[state].className}`}>
        <Mascot state={state} />
      </span>
      <span className="row-copy">
        <span className="mx-row-title">
          <strong>{item.label}</strong>
          {!proposed && item.bin_status?.is_new && (
            <span className="status-pill">新設</span>
          )}
        </span>
        <small>
          {distanceText(item)}
          {walk && ` · ${walk}`}
        </small>
        {proposed ? (
          <small>建議點／待現勘，尚未設置</small>
        ) : (
          <span className="mx-slots">
            {ordered.map((part) => (
              <SlotBar key={part.waste_type} part={part} />
            ))}
          </span>
        )}
      </span>
      {!proposed && (
        <span
          className={`mx-usable ${usable === 0 ? "state-full" : "state-hungry"}`}
        >
          <small>可丟</small>
          <span className="numeral-sm">
            {usable}/{parts.length}
          </span>
        </span>
      )}
    </button>
  );
}

// 清單列裡的一槽：種類圖示＋短滿度條（沿用 StationCard 的 FillBar）＋百分比。
// 不寫「餓了／吃飽了」；失聯／維修／撤除不放百分比，改虛線空條加狀態字。
// 無障礙名稱寫完整，例如「一般垃圾，吃飽了，92%」。
function SlotBar({ part }: { part: ApiCompartment }) {
  const state = apiBinState(part);
  const word =
    part.operational_status === "removed"
      ? "已撤除"
      : part.operational_status === "repair"
        ? "維修中"
        : stateLabels.offline;
  const pct = state === "offline" ? null : part.fill_level_pct;
  const label = `${wasteName(part.waste_type)}，${state === "offline" ? word : stateLabels[state]}${pct === null ? "" : `，${pct}%`}`;
  return (
    <span
      className={`mx-slot ${stateVisual[state].className}`}
      role="img"
      aria-label={label}
    >
      <WasteIcon type={part.waste_type} />
      <FillBar
        c={{
          wasteType: part.waste_type,
          state,
          pct,
          statusText: label,
        }}
      />
      <span className="mx-slot-value" aria-hidden="true">
        {pct === null ? word : `${pct}%`}
      </span>
    </span>
  );
}

// 圖例：桶況三態＋場所代表點（失聯一定有虛線外框）。
// 地圖瀏覽模式另外傳 wasteType（標題「依〈種類〉」）、landmarks（地標旗子＋建議點，
// 取代場所代表點色塊）、stacked（直式排列，放進圖例 popover）。
export function MapLegend({
  wasteType,
  landmarks = false,
  stacked = false,
}: {
  wasteType?: WasteType;
  landmarks?: boolean;
  stacked?: boolean;
} = {}) {
  return (
    <div className={`map-legend${stacked ? " stacked" : ""}`} aria-label="圖例">
      {wasteType && (
        <span className="map-legend-title">依{wasteName(wasteType)}</span>
      )}
      <span>
        <i className="legend-swatch state-hungry" />
        {stateLabels.hungry}
        <small>0–79%</small>
      </span>
      <span>
        <i className="legend-swatch state-full" />
        {stateLabels.full}
        <small>80%+</small>
      </span>
      <span>
        <i className="legend-swatch state-offline" />
        {landmarks ? "失聯／維修／撤除" : stateLabels.offline}
      </span>
      {landmarks ? (
        <>
          <span>
            <i
              className="map-legend-flag"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: landmarkSvg }}
            />
            地標
          </span>
          <span>
            <i className="map-legend-proposed" aria-hidden="true">
              ＋
            </i>
            建議點
          </span>
        </>
      ) : (
        <span>
          <i className="legend-swatch place" />
          場所代表點
        </span>
      )}
    </div>
  );
}

// 地圖右上角的圖例按鈕（沿用 .menu-button 圖示按鈕）＋按鈕下方的 popover。
// 預設收起；點外面、按 Esc、再點一次按鈕都會關閉，Esc 與按鈕關閉後焦點回到按鈕。
// 面板換畫面（選桶／地標／回清單）或焦點離開圖例時也會關閉。
function LegendPopover({
  wasteType,
  closeKey,
}: {
  wasteType: WasteType;
  closeKey: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [closeKey]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="mx-legend"
      ref={root}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        type="button"
        ref={button}
        className="menu-button"
        aria-label="圖例"
        aria-expanded={open}
        aria-controls="mx-legend-popover"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          viewBox="0 0 20 20"
          width="20"
          height="20"
          aria-hidden="true"
          fill="currentColor"
        >
          <path d="M3 4h4v4H3zM9 5h8v2H9zM3 12h4v4H3zM9 13h8v2H9z" />
        </svg>
      </button>
      {open && (
        <div className="mx-legend-popover" id="mx-legend-popover" tabIndex={-1}>
          <MapLegend wasteType={wasteType} landmarks stacked />
        </div>
      )}
    </div>
  );
}
