import { wasteName, wasteHref, type WasteControls } from "../../data/waste";
import { WasteSelect } from "./Waste";
import { useCallback, useMemo, useState } from "react";
import {
  allPages,
  apiBinState,
  apiCompartments,
  apiStationState,
  query,
  request,
  type ApiLocation,
} from "../../data/api";
import { stateLabels, usableCount } from "../../data/binState";
import { stateVisual } from "../binVisual";
import {
  districts,
  kindLabel,
  type LocationRecord,
} from "../../data/locations";
import { LocationMap } from "../../map/LocationMap";
import { LocationDetails } from "../LocationDetails";
import { Mascot } from "../Mascot";
import { LoadState } from "./LoadState";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { ORIGIN, Status } from "./mapShared";
export function MapPage({ wasteType, onWasteChange }: WasteControls) {
  const { session } = useSession();
  const [district, setDistrict] = useState("大安區"),
    [kind, setKind] = useState("bin"),
    [filter, setFilter] = useState("all"),
    [q, setQ] = useState("");
  const [proposed, setProposed] = useState(false);
  const [selected, setSelected] = useState<LocationRecord | null>(null);
  // 「餓了的桶」＝至少一桶還能丟（兩桶規則），在前端依 compartments 篩選；
  // 新設的桶仍交給後端篩選。
  const path = query("/map/locations", {
    waste_type: wasteType,
    district,
    kind,
    filter: filter === "new" ? "new" : "all",
    q,
    include_proposed: proposed,
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
  const shown = useMemo(
    () =>
      filter === "hungry"
        ? list.data?.filter(
            (item) =>
              item.kind === "bin" &&
              apiStationState(item.bin_status, item.compartments) === "hungry",
          )
        : list.data,
    [list.data, filter],
  );
  const nearPath = query("/map/nearest-usable", {
    waste_type: wasteType,
    district,
    q,
    limit: 3,
    ...ORIGIN,
  });
  const nearest = useApi(
    nearPath,
    (signal) => request<{ items: ApiLocation[] }>(nearPath, { signal }),
    true,
  );
  const select = useCallback(
    (item: LocationRecord) => {
      if (item.kind === "bin")
        window.location.hash = wasteHref(`bin/${item.id}`, wasteType).slice(1);
      else setSelected(item);
    },
    [wasteType],
  );
  return (
    <main className="explore-layout">
      <aside className="explorer" aria-label="位置探索">
        <div className="intro">
          <span className="eyebrow">A LITTLE HELP FOR YOUR EVERYDAY</span>
          <h1>
            附近哪裡
            <br />
            可以丟<span className="dot">？</span>
          </h1>
          <p>找到城市小夥伴，讓垃圾有個家。</p>
          <span className="demo-tag">API 桶況 · simulated 模擬讀值</span>
        </div>
        <div className="filters">
          <WasteSelect
            value={wasteType}
            onChange={(value) => {
              if (value) onWasteChange(value);
            }}
          />
          <label className="search-field">
            <span className="visually-hidden">搜尋地點</span>
            <input
              type="search"
              aria-label="搜尋地點"
              placeholder="搜尋路名、地點⋯"
              maxLength={200}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSelected(null);
              }}
            />
          </label>
          <div className="district-field">
            <label htmlFor="district">探索範圍</label>
            <select
              id="district"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setSelected(null);
              }}
            >
              <option value="all">全台北市</option>
              {districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="tabs" role="group" aria-label="位置類型">
            {["all", "bin", "place"].map((k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  setSelected(null);
                }}
              >
                {k === "all" ? "全部" : kindLabel[k as "bin" | "place"]}
              </button>
            ))}
          </div>
          <div className="filter-chips" role="group" aria-label="桶況篩選">
            {[
              ["all", "全部桶況"],
              ["hungry", "餓了的桶"],
              ["new", "新設的桶"],
            ].map(([v, label]) => (
              <button
                key={v}
                aria-pressed={filter === v}
                onClick={() => {
                  setFilter(v);
                  setSelected(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={proposed}
              onChange={(e) => setProposed(e.target.checked)}
            />
            包含建議點／待現勘
          </label>
        </div>
        <section className="nearest-card">
          <div className="panel-heading">
            <h2>最近的可用小夥伴</h2>
            <span className="label">FROM 大安森林公園</span>
          </div>
          <p className="tiny">
            固定大安森林公園示意起點 · 非目前定位 · 依{wasteName(wasteType)}
            槽判斷
          </p>
          <LoadState {...nearest} />
          <ol aria-label="最近三個可用桶">
            {nearest.data?.items.map((item, index) => (
              <li key={item.id}>
                <span className="nearest-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="nearest-copy">
                  <a href={wasteHref(`bin/${item.id}`, wasteType)}>
                    {item.label}
                  </a>
                  <small>
                    {" · "}
                    {item.distance_m === null
                      ? "距離未知"
                      : `${Math.round(item.distance_m)} 公尺`}
                  </small>
                </span>
                {item.walking_estimate_seconds != null && (
                  <span className="nearest-minutes" aria-hidden="true">
                    {String(
                      Math.max(
                        1,
                        Math.round(item.walking_estimate_seconds / 60),
                      ),
                    ).padStart(2, "0")}
                    <small>MIN</small>
                  </span>
                )}
              </li>
            ))}
          </ol>
          {nearest.data?.items.length === 0 && <p>目前沒有可用桶</p>}
        </section>
        <LoadState {...list} />
        <div className="results-heading">
          <strong>位置清單</strong>
          <span>{shown?.length ?? "—"} 筆位置紀錄</span>
        </div>
        <div className="location-list" aria-label="位置清單">
          {shown?.length === 0 && <p>沒有符合的地點</p>}
          {shown?.map((item) => {
            const state = apiStationState(item.bin_status, item.compartments);
            const parts = apiCompartments(item.bin_status, item.compartments);
            return (
              <button
                className="location-row"
                key={item.id}
                onClick={() => select(item)}
              >
                <span
                  className={`row-buddy ${item.kind === "bin" ? stateVisual[state].className : "place"}`}
                >
                  <Mascot kind={item.kind} state={state} />
                </span>
                <span className="row-copy">
                  <strong>{item.label}</strong>
                  <small>
                    {item.district} ·{" "}
                    {item.distance_m == null
                      ? "距離未知"
                      : `${Math.round(item.distance_m)} 公尺`}
                  </small>
                  {item.kind === "bin" ? (
                    <>
                      {parts.length > 1 ? (
                        <span
                          className={`status-pill ${stateVisual[state].className}`}
                        >
                          {stateLabels[state]} ·{" "}
                          {usableCount(
                            parts.map((c) => ({ state: apiBinState(c) })),
                          )}
                          /{parts.length} 桶能丟
                        </span>
                      ) : (
                        <Status status={item.bin_status} />
                      )}
                      <small>目前顯示：{wasteName(wasteType)}</small>
                      {item.placement_status === "proposed" && (
                        <small>建議點／待現勘，尚未設置</small>
                      )}
                    </>
                  ) : (
                    <small>
                      場所代表點 · 周邊 {item.reported_count} 處（統計）
                    </small>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <section className="map-section">
        <span className="map-district" aria-hidden="true">
          {district === "all" ? "全台北市" : district}
        </span>
        <LocationMap
          locations={shown || []}
          selected={selected}
          onSelect={select}
        />
        {selected && shown?.some((p) => p.id === selected.id) && (
          <LocationDetails
            location={selected}
            onClose={() => setSelected(null)}
          />
        )}
        <MapLegend />
      </section>
    </main>
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
