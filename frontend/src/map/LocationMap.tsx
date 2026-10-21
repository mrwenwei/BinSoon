import type { OperationalState } from "../data/workOrders";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { kindLabel, type LocationRecord } from "../data/locations";
import { locationMarkerIcon } from "./marker";
import {
  BOT_SMALL_MAX_ZOOM,
  bestState,
  clusterIcon,
  groupOverlapping,
  stateFromIconClass,
} from "./botClusters";
import { binsoonBasemapStyle, token } from "./basemapStyle";
import type { Point } from "../data/participation";
setWorkerUrl(workerUrl);

interface Props {
  operations?: OperationalState;
  binMarkerLabel?: string;
  locations: LocationRecord[];
  selected: LocationRecord | null;
  onSelect: (location: LocationRecord) => void;
  demoRoute?: [number, number][];
  roadRoute?: [number, number][];
  routeOrigin?: [number, number];
  routeLabel?: string;
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
  /** 固定示意起點標記（不可點、不影響視野）。 */
  origin?: { latitude: number; longitude: number; label: string };
  /** 有給時：只在選取對象改變時置中，並把選取點往上移這麼多像素（手機抽屜遮住下半部）。 */
  focusOffsetY?: number;
  /** 瀏覽模式：數字變了就把目前選取重新置中（例如抽屜從全開回到半開）。 */
  focusKey?: number;
}
export function LocationMap({
  locations,
  selected,
  onSelect,
  demoRoute,
  roadRoute,
  routeOrigin,
  routeLabel,
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
  origin,
  focusOffsetY,
  focusKey,
  fitKey,
}: Props) {
  const fittedKey = useRef<string | undefined>(undefined);
  const browse = focusOffsetY !== undefined;
  const offsetRef = useRef(focusOffsetY ?? 0);
  offsetRef.current = focusOffsetY ?? 0;
  const iconFor = (location: LocationRecord, active: boolean) =>
    markerIcon
      ? markerIcon(location, active)
      : locationMarkerIcon(location, active, removedIds, operations);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const markerRecords = useRef<
    { marker: L.Marker; location: LocationRecord; iconSignature: string }[]
  >([]);
  const markerPositions = useRef("");
  const clusters = useRef<L.LayerGroup | null>(null);
  const selectedId = useRef<string | undefined>(undefined);
  selectedId.current = selected?.id;
  // 垃圾桶機器人會疊在一起時合成一隻代表桶（右上角數字＝桶數），點它放大兩級。
  // 只處理一般的桶標記：選中的桶、撤除、地標、建議點都照常單獨顯示。
  // 資料更新後與每次縮放結束時重算；被合併的桶先從圖層移開，展開時再加回來。
  const declutter = useRef(() => {});
  declutter.current = () => {
    const instance = map.current;
    if (!instance || !markers.current || !clusters.current) return;
    const zoom = instance.getZoom();
    container.current?.classList.toggle(
      "bot-small",
      zoom <= BOT_SMALL_MAX_ZOOM,
    );
    clusters.current.clearLayers();
    const items = markerRecords.current.flatMap((record) => {
      const className = record.marker.options.icon?.options.className;
      const state = stateFromIconClass(className);
      if (
        !className?.includes("bot-marker") ||
        className.includes("removed") ||
        !state ||
        record.location.id === selectedId.current
      )
        return [];
      return [
        {
          record,
          state,
          point: instance.project(record.marker.getLatLng(), zoom),
        },
      ];
    });
    const show = (marker: L.Marker) => {
      if (markers.current!.hasLayer(marker)) return;
      markers.current!.addLayer(marker);
      const element = marker.getElement();
      if (marker.options.title)
        element?.setAttribute("aria-label", marker.options.title);
    };
    for (const record of markerRecords.current)
      if (!items.some((item) => item.record === record)) show(record.marker);
    for (const group of groupOverlapping(items, zoom)) {
      if (group.items.length === 1) {
        show(group.items[0].record.marker);
        continue;
      }
      for (const item of group.items)
        markers.current.removeLayer(item.record.marker);
      const center = instance.unproject([group.x, group.y], zoom);
      const label = `${group.items.length} 個桶，放大查看`;
      const zoomIn = () =>
        instance.setView(center, Math.min(zoom + 2, instance.getMaxZoom()));
      L.marker(center, {
        icon: clusterIcon(
          bestState(group.items.map((item) => item.state)),
          group.items.length,
        ),
        title: label,
        alt: label,
        riseOnHover: true,
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
  };
  const [basemapFailed, setBasemapFailed] = useState(false);
  useEffect(() => {
    const instance = L.map(container.current!, {
      zoomControl: false,
      minZoom: 8,
      maxZoom: 19,
    }).setView(initialCenter || [25.04, 121.54], initialCenter ? 15 : 13);
    map.current = instance;
    L.control.zoom({ position: "bottomright" }).addTo(instance);
    L.control
      .scale({ imperial: false, position: "bottomleft" })
      .addTo(instance);
    instance.attributionControl.addAttribution(
      '<a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>',
    );
    let basemap: L.MaplibreGL | undefined;
    const failure = () => setBasemapFailed(true);
    const timeout = window.setTimeout(failure, 15000);
    try {
      basemap = maplibreGL({
        // 自訂灰綠底圖：OpenFreeMap openmaptiles 圖磚＋色票 token。
        style: binsoonBasemapStyle(),
        attributionControl: false,
      }).addTo(instance);
      const gl = basemap.getMaplibreMap();
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
    } catch {
      failure();
    }
    markers.current = L.layerGroup().addTo(instance);
    clusters.current = L.layerGroup().addTo(instance);
    instance.on("zoomend", () => declutter.current());
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current!);
    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
      instance.remove();
      map.current = null;
      markerRecords.current = [];
      markerPositions.current = "";
    };
  }, []);
  // 標記依 kind/id 增量更新：背景輪詢不重建標記，位置、圖示、名稱沒變就不動，
  // 停在標記上的鍵盤焦點、選取高亮與使用者目前的平移縮放都不會因為輪詢而遺失。
  // 瀏覽模式（MapPage）與其他頁共用這一套，只有自動框選的時機不同。
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  useEffect(() => {
    const instance = map.current!;
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
        };
        created.marker
          .on("click", () => onSelectRef.current(created.location))
          .addTo(markers.current!);
        record = created;
      } else {
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
      }
      const element = record.marker.getElement();
      element?.setAttribute("aria-label", label);
      element?.setAttribute("title", label);
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
              paddingTopLeft: [50, 45],
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
  // 瀏覽模式在手機上再把選取點往上移，避開半開的抽屜。
  useEffect(() => {
    if (!selected || !map.current) return;
    const instance = map.current;
    instance.setView(
      [selected.latitude, selected.longitude],
      Math.max(instance.getZoom(), 16),
      { animate: false },
    );
    if (browse && offsetRef.current)
      instance.panBy([0, offsetRef.current], { animate: false });
  }, [browse, selected?.id, selected?.latitude, selected?.longitude, focusKey]);
  // 瀏覽模式第一次量到抽屜高度時，把初始中心移到抽屜上方的可見區（只做一次）。
  const initialOffsetDone = useRef(false);
  useEffect(() => {
    if (
      !browse ||
      initialOffsetDone.current ||
      !initialCenter ||
      !focusOffsetY ||
      !map.current
    )
      return;
    initialOffsetDone.current = true;
    if (selected) return;
    map.current.setView(initialCenter, map.current.getZoom(), {
      animate: false,
    });
    map.current.panBy([0, focusOffsetY], { animate: false });
  }, [browse, focusOffsetY]);
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
      title: "大安森林公園示意起點",
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
  }, [demoRoute, roadRoute, routeOrigin, locations]);
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
          底圖暫時無法完整載入，請確認網路後重新整理。位置標記與清單仍可查看。
        </p>
      )}
      {!browse && (
        <span className="map-note">
          {onPointChange
            ? "點擊地圖或拖曳＋選點 · 方塊為市民提案"
            : selected
              ? "已選取位置 · 可縮放地圖查看周邊"
              : roadRoute
                ? routeLabel || "沿道路規劃的路線"
                : demoRoute
                  ? "虛線為示意路線 · 未依實際道路規劃"
                  : routeOrigin
                    ? "選擇交通方式後，產生道路路線"
                    : "點選像素小夥伴，查看位置詳情"}
        </span>
      )}
    </div>
  );
}
