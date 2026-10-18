import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { kindLabel, type LocationRecord } from "../data/locations";
import { markerIcon } from "./marker";
import { binDemo } from "../data/binDemo";
setWorkerUrl(workerUrl);

interface Props {
  locations: LocationRecord[];
  selected: LocationRecord | null;
  onSelect: (location: LocationRecord) => void;
  demoRoute?: [number, number][];
}
export function LocationMap({
  locations,
  selected,
  onSelect,
  demoRoute,
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
        style: "https://tiles.openfreemap.org/styles/liberty",
        attributionControl: false,
      }).addTo(instance);
      const gl = basemap.getMaplibreMap();
      gl.on("load", () => {
        window.clearTimeout(timeout);
        setBasemapFailed(false);
      });
      gl.on("error", failure);
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
        icon: markerIcon(
          location.kind,
          false,
          location.kind === "bin" ? binDemo(location).state : undefined,
          location.kind === "bin"
            ? binDemo(location).removed
              ? "removed"
              : binDemo(location).isNew
                ? "new"
                : undefined
            : undefined,
        ),
        title: `${kindLabel[location.kind]}：${location.label}`,
        alt: `${kindLabel[location.kind]}：${location.label}`,
        riseOnHover: true,
      })
        .on("click", () => onSelect(location))
        .addTo(markers.current!);
      markerRecords.current.push({ marker, location });
    }
    if (locations.length)
      instance.fitBounds(
        L.latLngBounds(locations.map((p) => [p.latitude, p.longitude])),
        { padding: [45, 50], maxZoom: 15, animate: false },
      );
  }, [locations, onSelect]);
  useEffect(() => {
    for (const { marker, location } of markerRecords.current) {
      marker.setIcon(
        markerIcon(
          location.kind,
          location.id === selected?.id,
          location.kind === "bin" ? binDemo(location).state : undefined,
          location.kind === "bin"
            ? binDemo(location).removed
              ? "removed"
              : binDemo(location).isNew
                ? "new"
                : undefined
            : undefined,
        ),
      );
      marker.setZIndexOffset(location.id === selected?.id ? 1000 : 0);
    }
    if (!selected) return;
    const point: L.LatLngExpression = [selected.latitude, selected.longitude];
    map.current!.setView(point, Math.max(map.current!.getZoom(), 16), {
      animate: false,
    });
  }, [selected, locations]);
  useEffect(() => {
    if (!demoRoute?.length || !map.current) return;
    const instance = map.current;
    const line = L.polyline(demoRoute, {
      color: "#305a48",
      weight: 6,
      dashArray: "10 9",
    }).addTo(instance);
    const origin = L.marker(demoRoute[0], {
      icon: L.divIcon({
        className: "demo-origin",
        html: "<span>起</span>",
        iconSize: [28, 28],
      }),
      title: "大安森林公園示意起點",
    }).addTo(instance);
    instance.fitBounds(line.getBounds(), {
      padding: [55, 65],
      maxZoom: 16,
      animate: false,
    });
    return () => {
      line.remove();
      origin.remove();
    };
  }, [demoRoute]);
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
        {selected
          ? "已選取位置 · 可縮放地圖查看周邊"
          : "點選像素小夥伴，查看位置詳情"}
      </span>
    </div>
  );
}
