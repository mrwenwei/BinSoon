import type { OperationalState } from "../data/workOrders";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl, setWorkerCount } from "maplibre-gl";
import { observeMapSize } from "./observeMapSize";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { kindLabel, type LocationRecord } from "../data/locations";
import { locationMarkerIcon, selectedBaseLayerHtml } from "./marker";
import { BOT_BARS_MIN_ZOOM } from "./botBars";
import {
  BOT_MID_MAX_ZOOM,
  BOT_SMALL_MAX_ZOOM,
  bestState,
  clusterIcon,
  groupOverlapping,
  stateFromIconClass,
} from "./botClusters";
import {
  binsoonBasemapStyle,
  registerBasemapImages,
  token,
} from "./basemapStyle";
import {
  pixelBasemapStyle,
  registerPixelBasemapImages,
} from "./pixelBasemapStyle";
import { useTheme } from "../theme";
import type { Point } from "../data/participation";
import {
  cumulativeMeters,
  splitRoute,
  type LatLng,
} from "../data/routeGeometry";
setWorkerUrl(workerUrl);
const compactMap = window.matchMedia(
  "(max-width: 760px), (pointer: coarse)",
).matches;
if (compactMap) setWorkerCount(1);

interface Props {
  /** Keep a compact multi-stop map framed while highlighting a selection. */
  focusSelected?: boolean;
  /** 瀏覽模式選取時至少放大到這個級距（預設 BOT_BARS_MIN_ZOOM；小車停靠點用較低級距方便比較）。 */
  focusMinZoom?: number;
  operations?: OperationalState;
  binMarkerLabel?: string;
  locations: LocationRecord[];
  selected: LocationRecord | null;
  onSelect: (location: LocationRecord) => void;
  demoRoute?: [number, number][];
  roadRoute?: [number, number][];
  routeOrigin?: [number, number];
  routeLabel?: string;
  routeOriginLabel?: string;
  /** 市民步行導航路線：橘色粗線＋深色外框，walkedMeters 之前的路段變淡。畫在標記之下。 */
  navRoute?: {
    geometry: [number, number][];
    walkedMeters: number;
    startLabel: string;
    /** 地圖上方被浮動指示條蓋住的像素，框住路線時多留這麼多。 */
    topInset?: number;
    /** 地圖下方被手機底部抽屜蓋住的像素（抽屜停點高度，不是拖曳中的每一格）。 */
    bottomInset?: number;
  };
  removedIds?: string[];
  point?: Point;
  onPointChange?: (point: Point) => void;
  proposalPoints?: (Point & { id: string; label: string; count: number })[];
  onProposalSelect?: (id: string) => void;
  selectedProposalId?: string;
  selectionBounds?: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
  // 地圖瀏覽模式（MapPage）專用，其他頁不傳時維持原行為。
  /** 初始中心（zoom 15）；有給時，位置清單變動不自動 fitBounds（除非 autoFit）。 */
  initialCenter?: [number, number];
  autoFit?: boolean;
  /** 瀏覽模式：這個字串變了（例如搜尋字）且有資料時，框住目前的點一次；輪詢不會再框。 */
  fitKey?: string;
  /** 自訂標記圖示與無障礙名稱。 */
  markerIcon?: (location: LocationRecord, selected: boolean) => L.DivIcon;
  markerLabel?: (location: LocationRecord) => string;
  markerDescription?: (location: LocationRecord) => string | undefined;
  /** 底圖樣式；不給時跟著主題（day＝"pixel" 像素插畫、night＝"default" 原版），切換主題時會即時換底圖。 */
  basemap?: "default" | "pixel";
  /** 固定起點標記（不可點、不影響視野）。 */
  origin?: { latitude: number; longitude: number; label: string };
  /** 有給時：只在選取對象改變時置中，並把選取點往上移這麼多像素（手機抽屜遮住下半部）。 */
  focusOffsetY?: number;
  /** 瀏覽上方工具列佔用的高度，與底部抽屜一起決定可見區。 */
  browseTopInset?: number;
  /** 瀏覽模式：數字變了就把目前選取重新置中（例如抽屜從全開回到半開）。 */
  focusKey?: number;
  /** 瀏覽模式：點地圖空白處（不是標記、控制項，也不是拖曳、雙擊或雙指縮放）時呼叫。 */
  onBackgroundTap?: () => void;
  /** 瀏覽模式：目前看得到的地圖區（扣掉頂部工具列與目前停點的抽屜）中心相對於地圖中心的位移；
   *  點聚合桶放大時以這裡為中心。沒給時用 focusOffsetY。 */
  viewOffsetY?: number;
}
// 減少動態效果：地圖改成直接跳到定位，不做平移／飛行動畫。
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// 選取飛行：同縮放、距離不到一個畫面時只平移；否則用 flyTo（縮放與平移一起）。
const PAN_SECONDS = 0.5;
const FLY_SECONDS = 0.7;
// 點地圖後等這麼久確認不是雙擊縮放的第一下，才當成「點空白處」：觸控 250ms；
// 滑鼠（pointer: fine）的系統雙擊間隔較長，等 350ms。
const tapConfirmMs = () =>
  window.matchMedia("(pointer: fine)").matches ? 350 : 250;
// 標記播完一次 CSS 動畫就拿掉 class（className 之後換圖示也會被 Leaflet 重設）。
function playOnce(element: HTMLElement, className: string, animation: string) {
  element.classList.add(className);
  const done = (event: AnimationEvent) => {
    if (event.animationName !== animation) return;
    element.classList.remove(className);
    element.removeEventListener("animationend", done);
  };
  element.addEventListener("animationend", done);
}
export function LocationMap({
  focusSelected = true,
  focusMinZoom,
  locations,
  selected,
  onSelect,
  demoRoute,
  roadRoute,
  routeOrigin,
  routeLabel,
  routeOriginLabel = "大安森林公園起點",
  navRoute,
  point,
  onPointChange,
  proposalPoints,
  onProposalSelect,
  selectedProposalId,
  selectionBounds,
  removedIds,
  operations,
  binMarkerLabel,
  initialCenter,
  autoFit,
  markerIcon,
  markerLabel,
  markerDescription,
  basemap: basemapProp,
  origin,
  focusOffsetY,
  browseTopInset = 0,
  focusKey,
  fitKey,
  onBackgroundTap,
  viewOffsetY,
}: Props) {
  const fittedKey = useRef<string | undefined>(undefined);
  const browse = focusOffsetY !== undefined;
  const offsetRef = useRef(focusOffsetY ?? 0);
  offsetRef.current = focusOffsetY ?? 0;
  const viewOffsetRef = useRef(viewOffsetY ?? focusOffsetY ?? 0);
  viewOffsetRef.current = viewOffsetY ?? focusOffsetY ?? 0;
  // 某一點在 zoom 時要放在「看得到的地圖區」正中間，地圖中心應該在哪（像素座標一次算好）。
  const centreFor = (
    instance: L.Map,
    point: L.LatLngExpression,
    zoom: number,
    offsetY: number,
  ) =>
    instance.unproject(instance.project(point, zoom).add([0, offsetY]), zoom);
  const topInsetRef = useRef(browseTopInset);
  topInsetRef.current = browseTopInset;
  const iconFor = (location: LocationRecord, active: boolean) =>
    markerIcon
      ? markerIcon(location, active)
      : locationMarkerIcon(location, active, removedIds, operations);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const markerRecords = useRef<
    {
      marker: L.Marker;
      location: LocationRecord;
      iconSignature: string;
      active: boolean;
    }[]
  >([]);
  const markerPositions = useRef("");
  const clusters = useRef<L.LayerGroup | null>(null);
  const selectedId = useRef<string | undefined>(undefined);
  selectedId.current = selected?.id;
  // 瀏覽模式：剛選中的桶播一次放大（.mx-pick）；記下播過的 id，同一個桶之後換圖示
  // （例如輪詢更新桶況）不重播。標記還沒放上地圖時，等 declutter 放上去再播。
  const pickedId = useRef<string | undefined>(undefined);
  const playPick = (record: { marker: L.Marker; location: LocationRecord }) => {
    const id = record.location.id;
    if (!browse || id !== selectedId.current || pickedId.current === id) return;
    const element = record.marker.getElement();
    if (!element || reducedMotion()) return;
    pickedId.current = id;
    playOnce(element, "mx-pick", "mx-bot-pick");
  };
  // 垃圾桶機器人會疊在一起時合成一隻代表桶（右上角數字＝桶數），點它放大兩級。
  // 只處理一般的桶標記：選中的桶、撤除、地標、建議點都照常單獨顯示。
  // 資料更新後與每次縮放結束時重算；被合併的桶先從圖層移開，展開時再加回來。
  const declutter = useRef(() => {});
  declutter.current = () => {
    const instance = map.current;
    if (!instance || !markers.current || !clusters.current) return;
    const zoom = instance.getZoom();
    const visibleBounds = instance.getBounds().pad(0.2);
    const focusedRecord = markerRecords.current.find(
      (record) => record.marker.getElement() === document.activeElement,
    );
    const visibleRecords = markerRecords.current.filter(
      (record) =>
        !browse ||
        record === focusedRecord ||
        record.location.id === selectedId.current ||
        visibleBounds.contains(record.marker.getLatLng()),
    );
    const visibleSet = new Set(visibleRecords);
    for (const record of markerRecords.current)
      if (!visibleSet.has(record)) markers.current.removeLayer(record.marker);
    container.current?.classList.toggle(
      "bot-small",
      zoom <= BOT_SMALL_MAX_ZOOM,
    );
    container.current?.classList.toggle(
      "bot-mid",
      zoom > BOT_SMALL_MAX_ZOOM && zoom <= BOT_MID_MAX_ZOOM,
    );
    container.current?.classList.toggle(
      "bot-bars-on",
      zoom >= BOT_BARS_MIN_ZOOM,
    );
    clusters.current.clearLayers();
    const items = visibleRecords.flatMap((record) => {
      const className = record.marker.options.icon?.options.className;
      const state = stateFromIconClass(className);
      if (
        !className?.includes("bot-marker") ||
        className.includes("removed") ||
        !state ||
        record === focusedRecord ||
        record.location.id === selectedId.current
      )
        return [];
      return [
        {
          record,
          state,
          // 自己認領的 BinU（標記 class 有 mine）：聚合後代表桶腳下掛一顆愛心。
          mine: / mine\b/.test(className),
          point: instance.project(record.marker.getLatLng(), zoom),
        },
      ];
    });
    const show = (record: (typeof markerRecords.current)[number]) => {
      const marker = record.marker;
      if (markers.current!.hasLayer(marker)) return;
      markers.current!.addLayer(marker);
      playPick(record);
      const element = marker.getElement();
      if (marker.options.title)
        element?.setAttribute("aria-label", marker.options.title);
      const description = markerDescription?.(record.location);
      if (description) element?.setAttribute("aria-description", description);
    };
    for (const record of visibleRecords)
      if (!items.some((item) => item.record === record)) show(record);
    for (const group of groupOverlapping(items, zoom)) {
      if (group.items.length === 1) {
        show(group.items[0].record);
        continue;
      }
      for (const item of group.items)
        markers.current.removeLayer(item.record.marker);
      const center = instance.unproject([group.x, group.y], zoom);
      const mine = group.items.some((item) => item.mine);
      const label = `${group.items.length} 個桶${mine ? "（含你的 BinU）" : ""}，放大查看`;
      // 放大兩級，並把這群桶放在看得到的地圖區正中間（手機上扣掉抽屜與頂部工具列）。
      const zoomIn = () => {
        const next = Math.min(zoom + 2, instance.getMaxZoom());
        instance.setView(
          browse
            ? centreFor(instance, center, next, viewOffsetRef.current)
            : center,
          next,
        );
      };
      L.marker(center, {
        icon: clusterIcon(
          bestState(group.items.map((item) => item.state)),
          group.items.length,
          mine,
        ),
        title: label,
        alt: label,
        riseOnHover: true,
        // 數字泡泡凸出標記框外，要高過旁邊的垃圾桶，才不會被蓋到。
        zIndexOffset: 800, // 低於選中的標記（900）
      })
        .on("click", zoomIn)
        .on("add", (event) => {
          const element = (event.target as L.Marker).getElement();
          element?.setAttribute("aria-label", label);
          element?.addEventListener("keydown", (key) => {
            if (key.key !== "Enter" && key.key !== " ") return;
            key.preventDefault();
            zoomIn();
          });
        })
        .addTo(clusters.current);
    }
    syncSelectedBase();
  };
  // 選中底盤與十字定位線：另一個不可點的標記，放在 shadowPane（所有標記下面），鄰居角色會壓在
  // 底盤上；選中角色本身仍在最上層。位置＝選中標記的經緯度（腳底），格數依縮放級距
  // （底盤寬÷2）。每次標記更新、縮放、平移、聚合重算後同步；取消選取或換桶時播縮回再移除。
  const selectedBase = useRef<{
    id: string;
    marker: L.Marker;
    signature: string;
  } | null>(null);
  const retireSelectedBase = () => {
    const current = selectedBase.current;
    if (!current) return;
    selectedBase.current = null;
    const element = current.marker.getElement();
    if (browse && element && !reducedMotion()) {
      element.classList.add("mx-unpick");
      window.setTimeout(() => current.marker.remove(), 220);
    } else current.marker.remove();
  };
  const syncSelectedBase = () => {
    const instance = map.current;
    if (!instance || !markers.current) return;
    const record = markerRecords.current.find(
      (r) => r.active && r.location.id === selectedId.current,
    );
    const className = record?.marker.options.icon?.options.className ?? "";
    const kind =
      !record || !markers.current.hasLayer(record.marker)
        ? null
        : className.includes("bot-marker")
          ? "bot"
          : className.includes("mx-proposed")
            ? "proposed"
            : className.includes("pixel-marker")
              ? "landmark"
              : null;
    if (!record || !kind) {
      retireSelectedBase();
      return;
    }
    const zoom = Math.round(instance.getZoom());
    const cells =
      kind !== "bot"
        ? kind === "landmark"
          ? 21
          : 36
        : zoom <= BOT_SMALL_MAX_ZOOM
          ? 21
          : zoom <= BOT_MID_MAX_ZOOM
            ? 28
            : 36;
    const signature = `${kind}/${cells}`;
    const icon = () =>
      L.divIcon({
        className: `mx-selected-base kind-${kind}`,
        html: selectedBaseLayerHtml(cells),
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    const latlng = record.marker.getLatLng();
    const current = selectedBase.current;
    if (current?.id === record.location.id) {
      if (!current.marker.getLatLng().equals(latlng))
        current.marker.setLatLng(latlng);
      if (current.signature !== signature) {
        current.marker.setIcon(icon());
        current.signature = signature;
      }
      return;
    }
    retireSelectedBase();
    const marker = L.marker(latlng, {
      icon: icon(),
      pane: "shadowPane",
      interactive: false,
      keyboard: false,
    }).addTo(instance);
    selectedBase.current = { id: record.location.id, marker, signature };
    const element = marker.getElement();
    // 跟選中角色的放大同步播一次（減少動態效果時不播）。
    if (browse && element && !reducedMotion())
      playOnce(element, "mx-pick", "mx-base-pick");
  };
  const theme = useTheme();
  const basemapKind = basemapProp ?? (theme === "day" ? "pixel" : "default");
  const basemapKindRef = useRef(basemapKind);
  const basemapLayer = useRef<L.MaplibreGL | undefined>(undefined);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const [rasterFallback, setRasterFallback] = useState(false);
  useEffect(() => {
    const instance = L.map(container.current!, {
      zoomControl: false,
      minZoom: 8,
      maxZoom: 19,
    }).setView(initialCenter || [25.04, 121.54], initialCenter ? 15 : 13);
    map.current = instance;
    const zoomControl = L.control.zoom({ position: "bottomright" });
    if (browse) {
      // 瀏覽模式：＋／－以「看得到的地圖區」中心為基準縮放（手機抽屜蓋住地圖下半部，
      // 地圖幾何中心常在抽屜邊上）；選了桶時那裡就是桶，縮放後桶仍在正中間。
      const zoomBy = (delta: number) => (event: MouseEvent) => {
        const next = instance.getZoom() + delta * (event?.shiftKey ? 3 : 1);
        if (next > instance.getMaxZoom() || next < instance.getMinZoom())
          return;
        const size = instance.getSize();
        instance.setZoomAround(
          L.point(size.x / 2, size.y / 2 - viewOffsetRef.current),
          next,
        );
      };
      Object.assign(zoomControl, { _zoomIn: zoomBy(1), _zoomOut: zoomBy(-1) });
    }
    zoomControl.addTo(instance);
    L.control
      .scale({ imperial: false, position: "bottomleft" })
      .addTo(instance);
    // 署名：移除 Leaflet 前綴；預設收合成「i」按鈕，點開顯示完整署名（文字與連結不刪減）。
    const attribution = instance.attributionControl;
    attribution.setPrefix(false);
    let attributionOpen = false;
    const renderAttribution = () => {
      const box = attribution.getContainer();
      if (!box) return;
      const text = document.createElement("span");
      text.className = "px-attr-text";
      text.id = "map-attribution-text";
      text.innerHTML = box.innerHTML;
      text.hidden = !attributionOpen;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "px-attr-toggle";
      toggle.textContent = "i";
      toggle.setAttribute("aria-label", "地圖資料來源與署名");
      toggle.setAttribute("aria-controls", text.id);
      toggle.setAttribute("aria-expanded", String(attributionOpen));
      const setOpen = (open: boolean) => {
        attributionOpen = open;
        text.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        box.classList.toggle("is-open", open);
      };
      toggle.addEventListener("click", () => setOpen(!attributionOpen));
      box.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && attributionOpen) {
          setOpen(false);
          toggle.focus();
        }
      });
      box.classList.toggle("is-open", attributionOpen);
      box.replaceChildren(toggle, text);
      L.DomEvent.disableClickPropagation(box);
    };
    const updateAttribution = attribution as unknown as {
      _update: () => void;
    };
    const originalUpdate = updateAttribution._update.bind(attribution);
    updateAttribution._update = () => {
      originalUpdate();
      renderAttribution();
    };
    instance.attributionControl.addAttribution(
      '<a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>',
    );
    let basemap: L.MaplibreGL | undefined;
    let raster: L.TileLayer | undefined;
    let switchedToRaster = false;
    let disposed = false;
    const failure = () => {
      if (!disposed) setBasemapFailed(true);
    };
    const useRaster = () => {
      if (disposed || switchedToRaster) return;
      switchedToRaster = true;
      if (basemap && instance.hasLayer(basemap)) instance.removeLayer(basemap);
      raster = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        className: "map-raster-fallback",
        maxZoom: 19,
        keepBuffer: 1,
        updateWhenIdle: true,
        detectRetina: false,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);
      setRasterFallback(true);
    };
    const timeout = window.setTimeout(() => {
      failure();
      useRaster();
    }, 15000);
    try {
      const basemapKind = basemapKindRef.current;
      basemap = maplibreGL({
        // 自訂灰綠底圖：OpenFreeMap openmaptiles 圖磚＋色票 token。
        // pixel：同一組圖磚的像素插畫樣式，顏色讀容器上的 --px-* 變數。
        style:
          basemapKind === "pixel"
            ? pixelBasemapStyle(container.current!)
            : binsoonBasemapStyle(),
        attributionControl: false,
        pixelRatio: compactMap
          ? Math.min(window.devicePixelRatio || 1, 1.5)
          : undefined,
        maxTileCacheSize: compactMap ? 32 : undefined,
        maxTileCacheZoomLevels: compactMap ? 2 : undefined,
        canvasContextAttributes: compactMap
          ? { powerPreference: "low-power" }
          : undefined,
      });
      const layer = basemap;
      const removeLayer = layer.onRemove.bind(layer);
      layer.onRemove = (map) => {
        if (layer.getMaplibreMap()) return removeLayer(map);
        // A failed WebGL constructor leaves the adapter without a GL map.
        layer.getContainer()?.remove();
        return layer;
      };
      basemap.addTo(instance);
      basemapLayer.current = basemap;
      const gl = basemap.getMaplibreMap();
      if (basemapKind === "pixel")
        registerPixelBasemapImages(gl, container.current!);
      else registerBasemapImages(gl);
      // 樣式是內嵌的，所以「載入成功」改以 OpenFreeMap 圖磚來源的 TileJSON
      // 成功讀到為準；任何來源錯誤都顯示提示，之後不自動清除。
      let failed = false;
      gl.on("data", (event) => {
        if (
          !failed &&
          event.dataType === "source" &&
          "sourceDataType" in event &&
          event.sourceDataType === "metadata"
        )
          window.clearTimeout(timeout);
      });
      gl.on("error", () => {
        failed = true;
        failure();
      });
      gl.on("webglcontextlost", () => {
        failure();
        useRaster();
      });
    } catch {
      failure();
      useRaster();
    }
    markers.current = L.layerGroup().addTo(instance);
    clusters.current = L.layerGroup().addTo(instance);
    instance.on("zoomend moveend", () => declutter.current());
    // 地圖大小變了（例如手機網址列收合、改變視窗）：保持左上角不動；如果正跟著選取的桶，
    // 再把它放回看得到的地圖區正中間。
    const stopObserving = observeMapSize(container.current!, () => {
      instance.invalidateSize({ pan: false });
      followSelection.current("jump");
    });
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(timeout);
      stopObserving();
      instance.remove();
      map.current = null;
      markerRecords.current = [];
      selectedBase.current = null;
      markerPositions.current = "";
    };
    const pageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) dispose();
    };
    window.addEventListener("pagehide", pageHide);
    return () => {
      window.removeEventListener("pagehide", pageHide);
      dispose();
    };
  }, []);
  // 主題切換：就地換底圖樣式（地圖、標記、選取、視野都不動）。
  const appliedKind = useRef(basemapKind);
  useEffect(() => {
    basemapKindRef.current = basemapKind;
    if (appliedKind.current === basemapKind) return;
    appliedKind.current = basemapKind;
    const gl = basemapLayer.current?.getMaplibreMap();
    const scope = container.current;
    if (!gl || !scope) return;
    // 讀的是 <html data-theme> 已生效的 token，所以要在屬性改完之後才建樣式。
    const register = () => {
      if (basemapKind === "pixel") registerPixelBasemapImages(gl, scope);
      else registerBasemapImages(gl);
    };
    gl.once("style.load", register);
    gl.setStyle(
      basemapKind === "pixel"
        ? pixelBasemapStyle(scope)
        : binsoonBasemapStyle(),
    );
  }, [basemapKind]);
  // 標記依 kind/id 增量更新：背景輪詢不重建標記，位置、圖示、名稱沒變就不動，
  // 停在標記上的鍵盤焦點、選取高亮與使用者目前的平移縮放都不會因為輪詢而遺失。
  // 瀏覽模式（MapPage）與其他頁共用這一套，只有自動框選的時機不同。
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  useEffect(() => {
    const instance = map.current!;
    // 沒有選取時清掉「播過」的紀錄，之後再選同一個桶仍會播放大。
    if (!selected) pickedId.current = undefined;
    const previous = new Map(
      markerRecords.current.map((record) => [
        `${record.location.kind}/${record.location.id}`,
        record,
      ]),
    );
    const next: typeof markerRecords.current = [];
    for (const location of locations) {
      const key = `${location.kind}/${location.id}`;
      const active = location.id === selected?.id;
      const label = markerLabel
        ? markerLabel(location)
        : `${location.kind === "bin" && binMarkerLabel ? binMarkerLabel : kindLabel[location.kind]}：${location.label}`;
      const icon = iconFor(location, active);
      const iconSignature = JSON.stringify(icon.options);
      let record = previous.get(key);
      if (!record) {
        const created = {
          marker: L.marker([location.latitude, location.longitude], {
            icon,
            title: label,
            alt: label,
            riseOnHover: true,
          }),
          location,
          iconSignature,
          active,
        };
        created.marker.on("click", () => onSelectRef.current(created.location));
        record = created;
      } else {
        const wasActive = record.active;
        if (
          !record.marker
            .getLatLng()
            .equals([location.latitude, location.longitude])
        )
          record.marker.setLatLng([location.latitude, location.longitude]);
        if (record.iconSignature !== iconSignature) record.marker.setIcon(icon);
        record.marker.options.title = label;
        record.location = location;
        record.iconSignature = iconSignature;
        record.active = active;
        // 換圖示會重建標記內容，CSS transition 不會觸發：剛選中的桶加 .mx-pick、
        // 剛取消選取的桶加 .mx-unpick，各播一次就拿掉（只在瀏覽模式、沒有減少動態效果時）。
        const element = record.marker.getElement();
        if (browse && wasActive && !active && element && !reducedMotion())
          playOnce(element, "mx-unpick", "mx-bot-unpick");
        if (active) playPick(record);
      }
      const element = record.marker.getElement();
      element?.setAttribute("aria-label", label);
      const description = markerDescription?.(location);
      element?.setAttribute(
        "title",
        description ? `${label}（${description}）` : label,
      );
      if (description) element?.setAttribute("aria-description", description);
      else element?.removeAttribute("aria-description");
      record.marker.setZIndexOffset(active ? 1000 : 0);
      next.push(record);
      previous.delete(key);
    }
    for (const record of previous.values())
      markers.current!.removeLayer(record.marker);
    markerRecords.current = next;
    // 只有點位集合真的變了才重新框選；輪詢回來的 DTO 即使是新物件，
    // 也要保留使用者目前的平移與縮放。
    const positions = locations
      .map((p) => JSON.stringify([p.kind, p.id, p.latitude, p.longitude]))
      .sort()
      .join(";");
    if (browse) {
      // 瀏覽模式：只在 fitKey（例如搜尋字）變了且有資料時框一次。
      if (!fitKey) fittedKey.current = undefined;
      else if (fittedKey.current !== fitKey && locations.length) {
        fittedKey.current = fitKey;
        // 手機抽屜蓋住下半部：下方留白加上半開抽屜的高度（offset 的兩倍）。
        if (!selectionBounds)
          instance.fitBounds(
            L.latLngBounds(locations.map((p) => [p.latitude, p.longitude])),
            {
              paddingTopLeft: [50, 45 + topInsetRef.current],
              paddingBottomRight: [50, 45 + offsetRef.current * 2],
              maxZoom: 15,
              animate: false,
            },
          );
      }
    } else if (
      positions !== markerPositions.current &&
      locations.length &&
      !selectionBounds &&
      (autoFit ?? !initialCenter)
    )
      instance.fitBounds(
        L.latLngBounds(locations.map((p) => [p.latitude, p.longitude])),
        { padding: [45, 50], maxZoom: 15, animate: false },
      );
    markerPositions.current = positions;
    declutter.current();
  }, [
    browse,
    locations,
    selected?.id,
    removedIds,
    operations,
    selectionBounds,
    binMarkerLabel,
    markerIcon,
    markerLabel,
    markerDescription,
    autoFit,
    fitKey,
  ]);
  // 瀏覽模式：標記可用鍵盤 Enter／空白鍵選取（Leaflet 預設不會觸發 click）。
  useEffect(() => {
    if (!browse || !container.current) return;
    const element = container.current;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const icon = (event.target as HTMLElement).closest?.(
        ".leaflet-marker-icon",
      );
      const record = icon
        ? markerRecords.current.find((r) => r.marker.getElement() === icon)
        : undefined;
      if (!record) return;
      event.preventDefault();
      onSelectRef.current(record.location);
    };
    element.addEventListener("keydown", keydown);
    return () => element.removeEventListener("keydown", keydown);
  }, [browse]);
  // 只在選取對象換了（或瀏覽模式的 focusKey 變了）才置中，輪詢更新不會把地圖拉回來。
  // 瀏覽模式：目標中心在像素座標一次算好（選取點往上移 focusOffsetY＝最終半開抽屜高度的
  // 一半，落在抽屜上方可見區的正中間），再平滑飛過去；同縮放且距離不到一個畫面時只平移。
  // 減少動態效果時直接跳過去。之後只要使用者還沒動過地圖，地圖大小或抽屜高度改變時
  // 也會把桶放回正中間（followSelection）。
  const following = useRef<L.LatLng | null>(null);
  const offsetAtSelection = useRef<number | null>(null);
  const followSelection = useRef((_mode: "fly" | "pan" | "jump") => {});
  followSelection.current = (mode) => {
    const instance = map.current;
    const point = following.current;
    if (!browse || !instance || !point) return;
    // 縮放取整數：飛行中途被打斷（桶換桶、抽屜開合）時 getZoom() 可能是小數。
    // 選桶一次放大到看得到詳細資訊的級距（18：頭上血條、完整名牌、全部展開）；
    // 已經在 18 以上就維持，不拉遠。
    const zoom = Math.max(
      Math.round(instance.getZoom()),
      focusMinZoom ?? BOT_BARS_MIN_ZOOM,
    );
    const target = centreFor(instance, point, zoom, offsetRef.current);
    if (mode === "jump" || reducedMotion()) {
      instance.setView(target, zoom, { animate: false });
      return;
    }
    // 先停掉還在跑的飛行或平移：panTo 不會停掉 flyTo，兩個動畫疊在一起會讓桶停偏。
    instance.stop();
    const size = instance.getSize();
    const shift = instance
      .project(target, zoom)
      .subtract(instance.project(instance.getCenter(), zoom));
    if (
      zoom === instance.getZoom() &&
      (mode === "pan" ||
        (Math.abs(shift.x) < size.x && Math.abs(shift.y) < size.y))
    )
      instance.panTo(target, {
        animate: true,
        duration: PAN_SECONDS,
        easeLinearity: 0.25,
      });
    else instance.flyTo(target, zoom, { duration: FLY_SECONDS });
  };
  useEffect(() => {
    if (!focusSelected || !selected || !map.current) {
      following.current = null;
      return;
    }
    const instance = map.current;
    const point = L.latLng(selected.latitude, selected.longitude);
    if (!browse) {
      instance.setView(point, Math.max(instance.getZoom(), 16), {
        animate: false,
      });
      return;
    }
    following.current = point;
    offsetAtSelection.current = offsetRef.current;
    followSelection.current("fly");
  }, [
    browse,
    selected?.id,
    selected?.latitude,
    selected?.longitude,
    focusKey,
    focusSelected,
  ]);
  // 使用者自己拖、縮放或用鍵盤移動地圖後，就不再自動把選取的桶拉回中間。
  useEffect(() => {
    const element = container.current;
    if (!browse || !element) return;
    const stop = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        ![
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "+",
          "-",
          "=",
        ].includes(event.key)
      )
        return;
      // 點標記（另選）或縮放鈕（以桶為中心縮放）不算「自己移動地圖」。
      if (
        (event.target as HTMLElement).closest?.(
          ".leaflet-marker-icon, .leaflet-control",
        )
      )
        return;
      following.current = null;
    };
    element.addEventListener("pointerdown", stop);
    element.addEventListener("wheel", stop, { passive: true });
    element.addEventListener("keydown", stop);
    return () => {
      element.removeEventListener("pointerdown", stop);
      element.removeEventListener("wheel", stop);
      element.removeEventListener("keydown", stop);
    };
  }, [browse]);
  // 抽屜的最終高度變了（例如畫面高度改變、投票面板確認後才知道要 55%）：平滑補正一次。
  useEffect(() => {
    // 跟選取同一次更新（清單 0.42 → 詳情 0.5）時，飛行已經用新高度算好，不再補。
    if (offsetAtSelection.current === focusOffsetY) return;
    offsetAtSelection.current = focusOffsetY ?? null;
    followSelection.current("pan");
  }, [focusOffsetY]);
  // 瀏覽模式：點地圖空白處。Leaflet 的 click 在拖曳後不會觸發，標記與縮放鈕的點擊
  // 也不會傳到地圖；再等 tapConfirmMs() 排除雙擊縮放的第一下（雙擊或開始縮放就取消）。
  // 等待期間選了別的桶（標記的 click 不會冒泡到地圖）：選取一變就取消，觸發時也再
  // 比對一次選取 id，不同就不關閉，避免把剛開的桶關掉。
  const backgroundTapRef = useRef(onBackgroundTap);
  backgroundTapRef.current = onBackgroundTap;
  const tapTimer = useRef(0);
  useEffect(() => {
    if (!browse || !map.current) return;
    const instance = map.current;
    const cancel = () => window.clearTimeout(tapTimer.current);
    const click = () => {
      cancel();
      if (!backgroundTapRef.current) return;
      const tappedOn = selectedId.current;
      tapTimer.current = window.setTimeout(() => {
        if (selectedId.current === tappedOn) backgroundTapRef.current?.();
      }, tapConfirmMs());
    };
    instance.on("click", click);
    instance.on("dblclick zoomstart", cancel);
    return () => {
      cancel();
      instance.off("click", click);
      instance.off("dblclick zoomstart", cancel);
    };
  }, [browse]);
  useEffect(() => {
    window.clearTimeout(tapTimer.current);
  }, [selected?.id]);
  // 瀏覽模式第一次量到抽屜高度時，把初始中心移到抽屜上方的可見區（只做一次）。
  const initialOffsetDone = useRef(false);
  const previousTopInset = useRef(browseTopInset);
  useEffect(() => {
    if (!browse || !initialCenter || !focusOffsetY || !map.current) return;
    if (initialOffsetDone.current) {
      if (!selected && previousTopInset.current !== browseTopInset)
        map.current.panBy(
          [0, (previousTopInset.current - browseTopInset) / 2],
          { animate: false },
        );
      previousTopInset.current = browseTopInset;
      return;
    }
    initialOffsetDone.current = true;
    previousTopInset.current = browseTopInset;
    if (selected) return;
    map.current.setView(initialCenter, map.current.getZoom(), {
      animate: false,
    });
    map.current.panBy([0, focusOffsetY - browseTopInset / 2], {
      animate: false,
    });
  }, [browse, focusOffsetY, browseTopInset, selected?.id]);
  useEffect(() => {
    if (!origin || !map.current) return;
    const marker = L.marker([origin.latitude, origin.longitude], {
      icon: L.divIcon({
        className: "mx-origin",
        html: `<span class="mx-origin-pin" aria-hidden="true">起</span><span class="mx-origin-label">${origin.label}</span>`,
        iconSize: [112, 32],
        iconAnchor: [16, 16],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: -500,
    }).addTo(map.current);
    return () => {
      marker.remove();
    };
  }, [origin?.latitude, origin?.longitude, origin?.label]);
  useEffect(() => {
    const points = roadRoute || demoRoute;
    const start = routeOrigin || points?.[0];
    if (!start || !map.current) return;
    const instance = map.current;
    const line = points?.length
      ? L.polyline(points, {
          color: token("text-on-light"),
          weight: 4,
          dashArray: roadRoute ? undefined : "8 7",
          className: roadRoute ? "road-route" : "demo-route",
        }).addTo(instance)
      : undefined;
    const origin = L.marker(start, {
      icon: L.divIcon({
        className: "demo-origin",
        html: "<span>起</span>",
        iconSize: [44, 44],
      }),
      title: routeOriginLabel,
    }).addTo(instance);
    const bounds =
      line?.getBounds() ||
      L.latLngBounds([
        start,
        ...locations.map((p) => [p.latitude, p.longitude] as [number, number]),
      ]);
    instance.fitBounds(bounds, {
      padding: [55, 65],
      maxZoom: 16,
      animate: false,
    });
    return () => {
      line?.remove();
      origin.remove();
    };
  }, [demoRoute, roadRoute, routeOrigin, routeOriginLabel, locations]);
  // 市民步行導航路線（圖層在標記之下：Leaflet 向量線在 overlayPane，標記在 markerPane）。
  // 先畫兩條外框、再畫兩條主線：每段（走過／剩下）的外框與主線同步變淡。
  const navLayers = useRef<{
    geometry: LatLng[];
    cum: number[];
    walkedCasing: L.Polyline;
    remainCasing: L.Polyline;
    walkedLine: L.Polyline;
    remainLine: L.Polyline;
    here: L.Marker;
    refit: () => void;
  } | null>(null);
  const navInset = useRef(0);
  navInset.current = navRoute?.topInset ?? 0;
  const navBottom = useRef(0);
  navBottom.current = navRoute?.bottomInset ?? 0;
  const navGeometry = navRoute?.geometry;
  const navStartLabel = navRoute?.startLabel;
  useEffect(() => {
    if (!navGeometry || navGeometry.length < 2 || !map.current) return;
    const instance = map.current;
    const shared = {
      lineCap: "round" as const,
      lineJoin: "round" as const,
      interactive: false,
    };
    const casing = (name: string) =>
      L.polyline([], {
        ...shared,
        color: token("route-casing"),
        weight: 11,
        className: `nav-route-casing ${name}`,
      }).addTo(instance);
    const line = (name: string) =>
      L.polyline([], {
        ...shared,
        color: token("route"),
        weight: 7,
        className: `nav-route-line ${name}`,
      }).addTo(instance);
    const walkedCasing = casing("walked");
    const remainCasing = casing("remaining");
    const walkedLine = line("walked");
    const remainLine = line("remaining");
    const start = L.marker(navGeometry[0], {
      icon: L.divIcon({
        className: "nav-start",
        html: `<span class="nav-start-dot" aria-hidden="true"></span><span class="nav-start-label">${navStartLabel || "起點"}</span>`,
        iconSize: [150, 56],
        iconAnchor: [14, 14],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: -500,
    }).addTo(instance);
    const here = L.marker(navGeometry[0], {
      icon: L.divIcon({
        className: "nav-here",
        html: '<span class="nav-here-dot" aria-hidden="true"></span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 900,
      opacity: 0,
    }).addTo(instance);
    navLayers.current = {
      geometry: navGeometry,
      cum: cumulativeMeters(navGeometry),
      walkedCasing,
      remainCasing,
      walkedLine,
      remainLine,
      here,
      refit: () => {
        if (!moved) fit(!reducedMotion());
      },
    };
    // 畫面（含底部資訊卡展開縮小地圖）改變時重新框住整條路線；使用者自己動過地圖就不再框。
    // 手機抽屜蓋住的高度算進下方留白；抽屜換停點時平滑重框（減少動態效果時直接跳）。
    const fit = (animate = false) =>
      instance.fitBounds(L.latLngBounds(navGeometry), {
        paddingTopLeft: [40, 40 + navInset.current],
        paddingBottomRight: [40, 40 + navBottom.current],
        maxZoom: 17,
        animate,
      });
    let moved = false;
    const touched = () => {
      moved = true;
    };
    const element = container.current;
    element?.addEventListener("pointerdown", touched);
    element?.addEventListener("wheel", touched, { passive: true });
    fit();
    const stopObserving = element
      ? observeMapSize(element, () => {
          if (moved) return;
          instance.invalidateSize();
          fit();
        })
      : () => {};
    return () => {
      stopObserving();
      element?.removeEventListener("pointerdown", touched);
      element?.removeEventListener("wheel", touched);
      for (const layer of [
        walkedCasing,
        remainCasing,
        walkedLine,
        remainLine,
        start,
        here,
      ])
        layer.remove();
      navLayers.current = null;
    };
  }, [navGeometry, navStartLabel]);
  const navTopInset = navRoute?.topInset ?? 0;
  const navBottomInset = navRoute?.bottomInset ?? 0;
  useEffect(() => {
    if (navLayers.current?.geometry === navGeometry) navLayers.current?.refit();
  }, [navGeometry, navTopInset, navBottomInset]);
  const navWalked = navRoute?.walkedMeters ?? 0;
  useEffect(() => {
    const layers = navLayers.current;
    if (!layers || layers.geometry !== navGeometry) return;
    const { walked, remaining, here } = splitRoute(
      layers.geometry,
      layers.cum,
      navWalked,
    );
    layers.walkedCasing.setLatLngs(walked);
    layers.walkedLine.setLatLngs(walked);
    layers.remainCasing.setLatLngs(remaining);
    layers.remainLine.setLatLngs(remaining);
    layers.here.setLatLng(here);
    layers.here.setOpacity(navWalked > 0 ? 1 : 0);
  }, [navGeometry, navWalked, navStartLabel]);
  useEffect(() => {
    if (!selectionBounds) return;
    const instance = map.current!;
    const bounds: L.LatLngBoundsExpression = [
      [selectionBounds.south, selectionBounds.west],
      [selectionBounds.north, selectionBounds.east],
    ];
    const outline = L.rectangle(bounds, {
      color: token("signal-on-light"),
      weight: 2,
      fillOpacity: 0.03,
      interactive: false,
    }).addTo(instance);
    instance.fitBounds(bounds, { padding: [25, 25], animate: false });
    return () => {
      outline.remove();
    };
  }, [selectionBounds]);
  useEffect(() => {
    const instance = map.current!;
    const layer = L.layerGroup().addTo(instance);
    for (const proposal of proposalPoints || []) {
      const marker = L.marker([proposal.latitude, proposal.longitude], {
        icon: L.divIcon({
          className: `proposal-marker ${proposal.id === selectedProposalId ? "active" : ""}`,
          html: `<span>${proposal.count}</span>`,
          iconSize: [34, 34],
        }),
        zIndexOffset: proposal.id === selectedProposalId ? 1600 : 1000,
        title: `提案：${proposal.label}`,
        alt: `提案：${proposal.label}`,
      }).addTo(layer);
      marker
        .getElement()
        ?.setAttribute(
          "aria-pressed",
          String(proposal.id === selectedProposalId),
        );
      marker.on("click", () => onProposalSelect?.(proposal.id));
    }
    if (
      point &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude)
    ) {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          className: "point-marker",
          html: "<span>＋</span>",
          iconSize: [38, 38],
        }),
        draggable: Boolean(onPointChange),
        zIndexOffset: 2000,
        title: "選點位置（可拖曳）",
        alt: "選點位置（可拖曳）",
      }).addTo(layer);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onPointChange?.({ latitude: p.lat, longitude: p.lng });
      });
    }
    const pick = (event: L.LeafletMouseEvent) =>
      onPointChange?.({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    if (onPointChange) instance.on("click", pick);
    return () => {
      instance.off("click", pick);
      layer.remove();
    };
  }, [
    point,
    onPointChange,
    proposalPoints,
    onProposalSelect,
    selectedProposalId,
  ]);
  const selectedProposal = proposalPoints?.find(
    (p) => p.id === selectedProposalId,
  );
  useEffect(() => {
    if (selectedProposal)
      map.current!.setView(
        [selectedProposal.latitude, selectedProposal.longitude],
        Math.max(map.current!.getZoom(), 16),
        { animate: false },
      );
  }, [
    selectedProposalId,
    selectedProposal?.latitude,
    selectedProposal?.longitude,
  ]);
  return (
    <div className="map-wrap">
      <div
        className="map-canvas"
        ref={container}
        role="region"
        aria-label="台北位置地圖"
      />
      {basemapFailed && (
        <p className="map-warning" role="status">
          {rasterFallback
            ? "已切換輕量底圖。位置標記、搜尋與清單仍可使用。"
            : "底圖暫時無法完整載入。位置標記與清單仍可查看。"}
        </p>
      )}
      {!browse && (
        <span className="map-note">
          {onPointChange
            ? "點擊地圖或拖曳＋選點 · 方塊為市民提案"
            : selected
              ? "已選取位置 · 可縮放地圖查看周邊"
              : roadRoute || navRoute
                ? routeLabel || "沿道路規劃的路線"
                : demoRoute
                  ? "虛線為路線 · 未依實際道路規劃"
                  : routeOrigin
                    ? "選擇交通方式後，產生道路路線"
                    : "點選像素小夥伴，查看位置詳情"}
        </span>
      )}
    </div>
  );
}
