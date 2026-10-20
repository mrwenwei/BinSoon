import {
  wasteName,
  wasteHref,
  type WasteControls,
  type WasteType,
} from "../../data/waste";
import { WasteSelect } from "./Waste";
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
  type ApiLocation,
} from "../../data/api";
import { stateLabels, usableCount, type BinState } from "../../data/binState";
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
import { LoadState } from "./LoadState";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { ORIGIN } from "./mapShared";
import { BinPanel } from "./BinPage";

// ── 地圖瀏覽模式 ─────────────────────────────────────────────────────
// 手機：地圖滿版＋下方抽屜（收起／半開／全開）；桌面：左側面板＋右側地圖。
// 面板未選桶時是「附近的桶」清單；選桶（#bin/<id>）時原地顯示桶資訊。
// 資料流照原本：/map/locations 全部分頁讀完、?waste_type= 決定看哪一槽。

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
const originMarker = { ...ORIGIN, label: "起點（示意）" };
const initialCenter: [number, number] = [ORIGIN.latitude, ORIGIN.longitude];

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
// 所選種類那一槽的白話狀態。
function slotText(item: ApiLocation, wasteType: WasteType, state: BinState) {
  const part = apiCompartments(item.bin_status, item.compartments).find(
    (c) => c.waste_type === wasteType,
  );
  if (state === "hungry") return "還能丟";
  if (state === "full") return "滿了";
  const status = part ?? item.bin_status;
  return status?.operational_status === "removed"
    ? "已撤除"
    : status?.operational_status === "repair"
      ? "維修中"
      : stateLabels.offline;
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function MapPage({
  wasteType,
  onWasteChange,
  binId,
}: WasteControls & { binId?: string }) {
  const { session } = useSession();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [place, setPlace] = useState<ApiLocation | null>(null);
  const [binLocation, setBinLocation] = useState<ApiLocation | null>(null);
  const mobile = useMediaQuery(MOBILE_QUERY);
  // 全台北市一次讀完（district=all，後端可接受），建議點也一起讀，前端再依篩選分：
  // 「還能丟」看所選種類那一槽；「新設」跟原本一樣交給後端 filter=new。
  const path = query("/map/locations", {
    waste_type: wasteType,
    district: "all",
    kind: "all",
    filter: filter === "new" ? "new" : "all",
    q,
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
  const selected: ApiLocation | null = binId
    ? (items?.find((item) => item.id === binId) ??
      (binLocation?.id === binId ? binLocation : null))
    : place;
  // 地圖：「全部」顯示桶＋地標＋建議點；其他篩選只顯示清單上的點。選中的點一定顯示。
  const mapItems = useMemo(() => {
    const shown = (filter === "all" ? items : rows) ?? [];
    return selected && !shown.some((item) => item.id === selected.id)
      ? [...shown, selected]
      : shown;
  }, [items, rows, filter, selected]);
  const select = useCallback(
    (item: LocationRecord) => {
      if (item.kind === "bin") {
        window.location.hash = wasteHref(`bin/${item.id}`, wasteType).slice(1);
        return;
      }
      setPlace(item as ApiLocation);
      if (binId) window.location.hash = wasteHref("map", wasteType).slice(1);
    },
    [wasteType, binId],
  );
  useEffect(() => {
    if (binId) setPlace(null);
  }, [binId]);
  const iconFor = useCallback(
    (location: LocationRecord, active: boolean) =>
      browseMarkerIcon(location, active, wasteType),
    [wasteType],
  );

  // ── 抽屜（只在手機） ──
  const layoutRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState<Drawer>("half");
  const [dims, setDims] = useState({ layout: 0, head: 0 });
  const [dragPx, setDragPx] = useState<number | null>(null);
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
  useEffect(() => {
    if (binId || place) setDrawer((d) => (d === "collapsed" ? "half" : d));
  }, [binId, place]);
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
  const focusOffsetY = mobile
    ? Math.round(Math.max(drawerPx, heights.half) / 2)
    : 0;
  const style = mobile
    ? ({ "--mx-drawer-h": `${drawerPx}px` } as CSSProperties)
    : undefined;
  const resetFilters = () => {
    setQ("");
    setFilter("all");
  };
  const view = binId ? "bin" : place ? "place" : "list";

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
          {view === "bin" ? (
            <a className="mx-back" href={wasteHref("map", wasteType)}>
              ← 返回清單
            </a>
          ) : view === "place" ? (
            <>
              <h1 className="mx-title">{place!.label}</h1>
              <button
                type="button"
                className="mx-close"
                aria-label="關閉，回到附近的桶"
                onClick={() => setPlace(null)}
              >
                ×
              </button>
            </>
          ) : (
            <>
              <h1 className="mx-title">附近的桶</h1>
              <span className="mx-count">
                {rows ? `${rows.length} 個` : "—"}
              </span>
            </>
          )}
        </div>
        <div className="mx-panel-body" inert={collapsed}>
          {view === "bin" ? (
            <BinPanel
              key={`${binId}/${wasteType}`}
              id={binId!}
              wasteType={wasteType}
              onWasteChange={onWasteChange}
              onLocation={setBinLocation}
            />
          ) : view === "place" ? (
            <PlaceDetails place={place!} />
          ) : (
            <>
              <div className="mx-filters">
                <label className="mx-search">
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
                <div className="mx-filter-row">
                  <div className="mx-chips" role="group" aria-label="篩選">
                    {filters.map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        className="mx-chip"
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <WasteSelect
                    value={wasteType}
                    onChange={(value) => {
                      if (value) onWasteChange(value);
                    }}
                  />
                </div>
              </div>
              <p className="mx-caption">
                {wasteName(wasteType)}
                還能丟的排前面，再依離地圖上「起點（示意）」的距離排序；起點是固定示意位置，不是你的定位。桶況為模擬讀值。
              </p>
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
        </div>
      </section>
      <div className="mx-map">
        <LocationMap
          locations={mapItems}
          selected={selected}
          onSelect={select}
          initialCenter={initialCenter}
          autoFit={q.trim() !== ""}
          markerIcon={iconFor}
          markerLabel={browseMarkerLabel}
          origin={originMarker}
          focusOffsetY={focusOffsetY}
        />
        <BrowseLegend wasteType={wasteType} />
      </div>
    </main>
  );
}

function NearbyRow({
  item,
  wasteType,
  onSelect,
}: {
  item: ApiLocation;
  wasteType: WasteControls["wasteType"];
  onSelect: (item: LocationRecord) => void;
}) {
  const proposed = isProposed(item);
  const state = wasteState(item, wasteType);
  const parts = apiCompartments(item.bin_status, item.compartments);
  const usable = usableCount(parts.map((c) => ({ state: apiBinState(c) })));
  const walk = walkText(item);
  return (
    <button type="button" className="mx-row" onClick={() => onSelect(item)}>
      <span
        className={`mx-row-icon ${proposed ? "proposed" : stateVisual[state].className}`}
      >
        {proposed ? (
          <span className="mx-proposed-mini" aria-hidden="true">
            ＋
          </span>
        ) : (
          <Mascot state={state} />
        )}
      </span>
      <span className="mx-row-main">
        <span className="mx-row-name">
          {proposed ? (
            <span className="mx-tag dashed">建議點</span>
          ) : (
            item.bin_status?.is_new && <span className="mx-tag new">新設</span>
          )}
          {item.label}
        </span>
        <span className="mx-row-sub">
          {distanceText(item)}
          {walk && ` · ${walk}`}
        </span>
        <span className="mx-row-sub">
          {proposed
            ? "建議設置的位置，現場還沒有桶"
            : `${wasteName(wasteType)}：${slotText(item, wasteType, state)}`}
        </span>
      </span>
      <span className="mx-row-side">
        {proposed ? (
          <span className="mx-side-muted">尚未設置</span>
        ) : (
          <>
            <small>可丟</small>
            <b className={usable === 0 ? "mx-zero" : "mx-ok"}>
              {usable}/{parts.length}
            </b>
          </>
        )}
      </span>
    </button>
  );
}

// 地標（場所代表點）：只在地圖上出現，點了在面板說明它不是垃圾桶。
function PlaceDetails({ place }: { place: ApiLocation }) {
  const walk = walkText(place);
  return (
    <section className="mx-place" aria-label="位置詳情">
      <p className="mx-sub">
        <span className="mx-tag">地標</span>
        {place.district} · 距起點 {distanceText(place)}
        {walk && ` · ${walk}`}
      </p>
      <p className="mx-note">
        這是地標，不是垃圾桶，周邊約 {place.reported_count ?? "—"} 處清潔箱。
      </p>
      <p className="mx-caption">
        此為場所代表點，並非個別清潔箱位置；周邊數量是來源統計，不代表桶的實際座標。
      </p>
      <details className="mx-source">
        <summary>來源與位置精度</summary>
        <p>
          {place.source_file} · 原始列 {place.source_row}
        </p>
        <p>
          {place.source_type}
          <br />
          {place.location_precision}
        </p>
      </details>
    </section>
  );
}

// 地圖瀏覽模式的圖例：顏色依所選種類那一槽。
function BrowseLegend({
  wasteType,
}: {
  wasteType: WasteControls["wasteType"];
}) {
  return (
    <div className="mx-legend" aria-label="圖例">
      <span className="mx-legend-title">依{wasteName(wasteType)}</span>
      <span>
        <i className="legend-swatch state-hungry" />
        {stateLabels.hungry}
      </span>
      <span>
        <i className="legend-swatch state-full" />
        {stateLabels.full}
      </span>
      <span>
        <i className="legend-swatch state-offline" />
        失聯／維修／撤除
      </span>
      <span>
        <i
          className="mx-legend-flag"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: landmarkSvg }}
        />
        地標
      </span>
      <span>
        <i className="mx-legend-proposed" aria-hidden="true">
          ＋
        </i>
        建議點
      </span>
    </div>
  );
}

// 圖例：桶況三態＋場所代表點（失聯一定有虛線外框）。
export function MapLegend() {
  return (
    <div className="map-legend" aria-label="圖例">
      <span className="label">STATUS</span>
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
        {stateLabels.offline}
      </span>
      <span>
        <i className="legend-swatch place" />
        場所代表點
      </span>
    </div>
  );
}
