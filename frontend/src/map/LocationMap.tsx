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
import { binsoonBasemapStyle, token } from "./basemapStyle";
import type { Point } from "../data/participation";
setWorkerUrl(workerUrl);

interface Props {
  operations?: OperationalState;
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
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const markerRecords = useRef<
    { marker: L.Marker; location: LocationRecord }[]
  >([]);
  const [basemapFailed, setBasemapFailed] = useState(false);
  useEffect(() => {
    const instance = L.map(container.current!, {
      zoomControl: false,
      minZoom: 8,
      maxZoom: 19,
    }).setView([25.04, 121.54], 13);
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
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current!);
    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const instance = map.current!;
    markers.current!.clearLayers();
    markerRecords.current = [];
    for (const location of locations) {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: locationMarkerIcon(location, false, removedIds, operations),
        title: `${kindLabel[location.kind]}：${location.label}`,
        alt: `${kindLabel[location.kind]}：${location.label}`,
        riseOnHover: true,
      })
        .on("click", () => onSelect(location))
        .addTo(markers.current!);
      marker
        .getElement()
        ?.setAttribute(
          "aria-label",
          `${kindLabel[location.kind]}：${location.label}`,
        );
      markerRecords.current.push({ marker, location });
    }
    if (locations.length && !selectionBounds)
      instance.fitBounds(
        L.latLngBounds(locations.map((p) => [p.latitude, p.longitude])),
        { padding: [45, 50], maxZoom: 15, animate: false },
      );
  }, [locations, onSelect, removedIds, selectionBounds]);
  useEffect(() => {
    for (const { marker, location } of markerRecords.current) {
      marker.setIcon(
        locationMarkerIcon(
          location,
          location.id === selected?.id,
          removedIds,
          operations,
        ),
      );
      marker.setZIndexOffset(location.id === selected?.id ? 1000 : 0);
    }
    if (!selected) return;
    const point: L.LatLngExpression = [selected.latitude, selected.longitude];
    map.current!.setView(point, Math.max(map.current!.getZoom(), 16), {
      animate: false,
    });
  }, [selected, locations, removedIds, operations]);
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
    </div>
  );
}
