import { useCallback, useEffect, useMemo, useState } from "react";
import {
  allPages,
  apiBinState,
  apiCompartments,
  apiStationState,
  query,
  request,
  time,
  type ApiLocation,
  type BinStatus,
  type BinView,
  type Reading,
  type WasteType,
} from "../../data/api";
import { stateLabels, usableCount, wasteLabels } from "../../data/binState";
import { stateVisual } from "../binVisual";
import { StationCard, type CardCompartment } from "../StationCard";
import {
  districts,
  kindLabel,
  type LocationRecord,
} from "../../data/locations";
import { LocationMap } from "../../map/LocationMap";
import { LocationDetails } from "../LocationDetails";
import { Mascot } from "../Mascot";
import { useQrCode } from "../useQrCode";
import { LoadState } from "./LoadState";
import { CompletionThanks } from "./CompletionPages";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
const ORIGIN = { latitude: 25.033, longitude: 121.5358 };
const ignoreSelect = () => {};
const reasonLabels: Record<string, string> = {
  not_installed: "尚未設置",
  removed: "已撤除",
  repair: "維修中",
  full: "桶已滿",
  unknown: "桶況未知",
  login_required: "需登入",
  suspended: "回報資格暫停",
};
// 列上的狀態文字：三態標籤（API 四態在 apiBinState 轉成三態）＋滿度。
export function statusText(status: BinStatus | null) {
  return status?.operational_status === "removed"
    ? "已撤除"
    : status?.operational_status === "repair"
      ? "維修中"
      : status?.fill_level_pct == null
        ? stateLabels.offline
        : `${stateLabels[apiBinState(status)]} · ${status.fill_level_pct}%`;
}
export function Status({ status }: { status: BinStatus | null }) {
  return (
    <span
      className={`status-pill ${stateVisual[apiBinState(status)].className}`}
    >
      {statusText(status)}
    </span>
  );
}
function toCard(list: ReturnType<typeof apiCompartments>): CardCompartment[] {
  return list.map((c) => ({
    wasteType: c.waste_type,
    state: apiBinState(c),
    pct: c.operational_status === "removed" ? null : c.fill_level_pct,
    statusText: statusText(c),
  }));
}
export function MapPage() {
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
  const select = useCallback((item: LocationRecord) => {
    if (item.kind === "bin") window.location.hash = `bin/${item.id}`;
    else setSelected(item);
  }, []);
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
            固定大安森林公園示意起點 · 非目前定位 · 依一般垃圾槽判斷
          </p>
          <LoadState {...nearest} />
          <ol aria-label="最近三個可用桶">
            {nearest.data?.items.map((item, index) => (
              <li key={item.id}>
                <span className="nearest-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="nearest-copy">
                  <a href={`#bin/${item.id}`}>{item.label}</a>
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
export function BinPage({
  id,
  navigation = false,
  wasteType,
}: {
  id: string;
  navigation?: boolean;
  wasteType?: WasteType;
}) {
  const { session } = useSession();
  // 導航時可指定要丟的種類（只有回收槽能丟時）；預設沿用後端一般垃圾語意。
  const viewPath = `/bins/${encodeURIComponent(id)}/view${wasteType === "recycling" ? "?waste_type=recycling" : ""}`;
  const view = useApi(
    viewPath,
    (signal) =>
      request<BinView>(viewPath, { signal, token: session?.access_token }),
    true,
  );
  const history = useApi(
    navigation ? null : `/bins/${id}/history`,
    async (signal) => {
      const items: Reading[] = [];
      let offset = 0;
      while (true) {
        const { data } = await request<Reading[]>(
          query(`/bins/${encodeURIComponent(id)}/history`, {
            offset,
            limit: 100,
          }),
          { signal },
        );
        items.push(...data);
        if (data.length < 100) break;
        offset += data.length;
      }
      return {
        data: items.sort(
          (a, b) =>
            a.recorded_at.localeCompare(b.recorded_at) ||
            a.id.localeCompare(b.id),
        ),
        etag: null,
        replayed: false,
      };
    },
    true,
  );
  if (!view.data)
    return (
      <main className="page">
        <h1>桶詳情</h1>
        <LoadState {...view} />
        <a href="#map">返回地圖</a>
      </main>
    );
  if (navigation)
    return view.error ? (
      <main className="page">
        <h1>步行導航</h1>
        <LoadState {...view} />
        <p>桶況尚未更新，請先重新載入確認可用性。</p>
      </main>
    ) : (
      <Navigation view={view.data} wasteType={wasteType} />
    );
  const { location: item, status, can_report } = view.data;
  const parts = apiCompartments(status, view.data.compartments);
  const usable = parts.filter((c) => c.is_usable);
  const twoBins = parts.length > 1;
  // 主按鈕永遠是青綠：兩桶能丟或一般能丟→導航過去；只有回收能丟→導航過去丟回收。
  const recyclingOnly =
    twoBins && usable.length === 1 && usable[0].waste_type === "recycling";
  const canGo = twoBins ? usable.length > 0 : status.is_usable;
  const reasons = (list: BinStatus[]) =>
    [...new Set(list.flatMap((c) => c.unavailable_reasons))]
      .map((r) => reasonLabels[r] || r)
      .join("、");
  const note =
    item.placement_status === "proposed"
      ? "建議點／待現勘，尚未設置"
      : !twoBins
        ? status.is_usable
          ? "只收隨手小垃圾，請依現場狀況使用。"
          : `目前不可用：${reasons([status])}`
        : usable.length === parts.length
          ? "兩桶都還能丟，只收隨手小垃圾，請依現場狀況使用。"
          : usable.length === 1
            ? `${wasteLabels[usable[0].waste_type]}還能丟；${parts
                .filter((c) => !c.is_usable)
                .map(
                  (c) =>
                    `${wasteLabels[c.waste_type]}目前不可用：${reasons([c])}`,
                )
                .join("；")}。`
            : `目前不可用：${reasons(parts)}`;
  return (
    <main className="page detail-page">
      <a className="back-link" href="#map">
        ← 返回地圖
      </a>
      <div className="page-heading">
        <div>
          <h1>{item.label}</h1>
          <p>
            {item.district} · {twoBins ? "一般垃圾＋資源回收（示意） · " : ""}
            {item.placement_status === "proposed"
              ? "建議點／待現勘"
              : item.placement_status === "installed"
                ? "示範設置"
                : "既有公布桶"}
          </p>
        </div>
        <span className="demo-tag">
          {status.reading_source_type || "來源未知"} · 非實測 IoT
        </span>
      </div>
      <LoadState {...view} />
      <div className="detail-grid">
        <div className="detail-main">
          <StationCard
            compartments={toCard(parts)}
            note={
              <>
                <p>{note}</p>
                <p className="tiny">
                  {twoBins
                    ? "兩槽為後端示範假設（demo_assumption），不是現場盤點。"
                    : "後端未提供分槽資料，暫以一般垃圾槽顯示。"}
                </p>
              </>
            }
          >
            {!view.error && (
              <a
                className="button primary"
                href={`#nav/${id}${recyclingOnly ? "?waste_type=recycling" : ""}`}
              >
                {canGo
                  ? recyclingOnly
                    ? "導航過去丟回收"
                    : "導航過去"
                  : "尋找可用桶並導航"}
                <span aria-hidden="true">→</span>
              </a>
            )}
            {can_report && !view.error && (
              <a className="button secondary" href={`#report/${id}`}>
                回報問題
              </a>
            )}
          </StationCard>
          {!(can_report && !view.error) && (
            <p className="card-note">
              {view.error ? (
                "桶況更新失敗，請重新載入後操作。"
              ) : view.data.report_block_reason === "login_required" ? (
                <a href={`#login?next=${encodeURIComponent(`bin/${id}`)}`}>
                  登入後回報
                </a>
              ) : (
                `暫不能回報：${reasonLabels[view.data.report_block_reason || ""] || view.data.report_block_reason}`
              )}
            </p>
          )}
          <CompletionThanks
            cleanup={view.data.latest_cleanup}
            binId={id}
            ready={!view.loading && !view.error}
            refresh={view.reload}
          />
          <section className="card adopt-card">
            <h2>認養</h2>
            <p>認養：{view.data.adopter?.display_name || "尚無認養者"}</p>
            <p className="tiny">
              認養以點位為單位，涵蓋兩槽。認養操作尚未開放。
            </p>
          </section>
        </div>
        <section className="card">
          <h2>今天的飽足度</h2>
          <p>
            {status.fill_level_pct === null
              ? "尚無有效讀值"
              : `${status.fill_level_pct}%（模擬）`}
          </p>
          <p>觀測：{time(status.observed_at)}</p>
          <h2>滿度與清運歷史</h2>
          <p className="tiny">以下為模擬時鐘，含各輪紀錄，並非實際作業時間。</p>
          <LoadState {...history} />
          {history.data?.length === 0 && <p>尚無歷史讀值</p>}
          <ol className="api-history">
            {history.data?.map((r) => (
              <li key={r.id}>
                <time>{time(r.recorded_at)}</time>
                <span>
                  {r.fill_level_pct}% · {r.event_type} · {r.source_type}
                </span>
                <meter
                  min="0"
                  max="100"
                  value={r.fill_level_pct}
                  aria-label={`${time(r.recorded_at)} 滿度`}
                />
                第 {r.generation ?? "未知"} 輪
              </li>
            ))}
          </ol>
        </section>
      </div>
      <LocationDetails
        location={item}
        onClose={() => {
          window.location.hash = "map";
        }}
      />
      <div className="api-detail-map">
        <LocationMap
          locations={[
            {
              ...item,
              bin_status: status,
              compartments: view.data.compartments,
            },
          ]}
          selected={item}
          onSelect={ignoreSelect}
        />
      </div>
    </main>
  );
}
function Navigation({
  view,
  wasteType,
}: {
  view: BinView;
  wasteType?: WasteType;
}) {
  const available = view.status.is_usable;
  const nextPath = query("/map/nearest-usable", {
    district: "all",
    ...ORIGIN,
    limit: 3,
    ...(wasteType === "recycling" ? { waste_type: "recycling" } : {}),
  });
  const alternatives = useApi(
    available ? null : nextPath,
    (signal) => request<{ items: ApiLocation[] }>(nextPath, { signal }),
    true,
  );
  const destination = available
    ? view.location
    : alternatives.data?.items.find(
        (p) => p.id !== view.location.id && p.bin_status?.is_usable,
      );
  const mapItems = useMemo(
    () =>
      destination
        ? [
            {
              ...destination,
              bin_status: available ? view.status : destination.bin_status,
            },
          ]
        : [],
    [destination, available, view.status],
  );
  const path = useMemo<[number, number][]>(
    () =>
      destination
        ? [
            [ORIGIN.latitude, ORIGIN.longitude],
            [ORIGIN.latitude, destination.longitude],
            [destination.latitude, destination.longitude],
          ]
        : [],
    [destination],
  );
  const url = `${window.location.origin}${window.location.pathname}#nav/${destination?.id || view.location.id}`;
  const qr = useQrCode(url, 180);
  return (
    <main className="page navigation-page">
      <a className="back-link" href={`#bin/${view.location.id}`}>
        返回桶詳情
      </a>
      <h1>步行導航</h1>
      <p>大安森林公園固定示意起點 · 非即時 GPS，非實際道路指引。</p>
      {wasteType === "recycling" && (
        <p className="tiny">本次要丟：資源回收。</p>
      )}
      {!available && (
        <p role="status">原目的桶目前不可用，依後端結果尋找替代桶。</p>
      )}
      <LoadState {...alternatives} />
      {destination ? (
        <>
          <h2 className="navigation-destination">{destination.label}</h2>
          <p>路線與時間只作示意，請依現場道路通行。</p>
          <div className="api-detail-map">
            <LocationMap
              locations={mapItems}
              selected={null}
              onSelect={ignoreSelect}
              demoRoute={path}
            />
          </div>
          <a
            className="button primary"
            href={`#report/${destination.id}${wasteType === "recycling" ? "?waste_type=recycling" : ""}`}
          >
            抵達後回報
          </a>
          {qr && (
            <img src={qr} alt="手機接續導航 QR Code" width="180" height="180" />
          )}
          <p className="tiny">
            QR 只分享桶連結，不含帳號憑證；本機網址需可連線才可使用。
          </p>
        </>
      ) : (
        !alternatives.loading && <p>目前沒有其他可用桶</p>
      )}
      <a className="back-link" href="#map">
        結束導航
      </a>
    </main>
  );
}
