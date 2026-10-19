import { useCallback, useEffect, useMemo, useState } from "react";
import {
  allPages,
  query,
  request,
  time,
  type ApiLocation,
  type BinStatus,
  type BinView,
  type Reading,
} from "../../data/api";
import {
  districts,
  kindLabel,
  type LocationRecord,
} from "../../data/locations";
import { LocationMap } from "../../map/LocationMap";
import { LocationDetails } from "../LocationDetails";
import { Mascot } from "../Mascot";
import { useQrCode } from "../useQrCode";
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
const fillLabels = {
  hungry: "餓了",
  half: "半飽",
  full: "吃飽了",
  unknown: "未知",
};
export function Status({ status }: { status: BinStatus | null }) {
  return (
    <span className={`status-pill ${status?.fill_status || "unknown"}`}>
      {status?.operational_status === "removed"
        ? "已撤除"
        : status?.operational_status === "repair"
          ? "維修中"
          : status?.fill_level_pct == null
            ? "滿度未知"
            : `${fillLabels[status.fill_status]} · ${status.fill_level_pct}%`}
    </span>
  );
}
export function LoadState({
  loading,
  error,
  reload,
  retryAt = 0,
}: {
  loading: boolean;
  error?: string;
  reload: () => void;
  retryAt?: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [retryAt]);
  return (
    <>
      {loading && <p role="status">載入中…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={reload}
            disabled={now < retryAt}
          >
            {now < retryAt ? "稍候再載入" : "重新載入"}
          </button>
        </div>
      )}
    </>
  );
}
export function MapPage() {
  const { session } = useSession();
  const [district, setDistrict] = useState("大安區"),
    [kind, setKind] = useState("bin"),
    [filter, setFilter] = useState("all"),
    [q, setQ] = useState("");
  const [proposed, setProposed] = useState(false);
  const [selected, setSelected] = useState<LocationRecord | null>(null);
  const path = query("/map/locations", {
    district,
    kind,
    filter,
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
            搜尋地點
            <input
              type="search"
              aria-label="搜尋地點"
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
              ["can_fit", "還能裝的桶"],
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
          <label>
            <input
              type="checkbox"
              checked={proposed}
              onChange={(e) => setProposed(e.target.checked)}
            />
            包含建議點／待現勘
          </label>
        </div>
        <section className="nearest-card">
          <h2>最近的可用小夥伴</h2>
          <p className="tiny">固定大安森林公園示意起點 · 非目前定位</p>
          <LoadState {...nearest} />
          <ol aria-label="最近三個可用桶">
            {nearest.data?.items.map((item) => (
              <li key={item.id}>
                <a href={`#bin/${item.id}`}>{item.label}</a> ·{" "}
                {item.distance_m === null
                  ? "距離未知"
                  : `${Math.round(item.distance_m)} 公尺`}
              </li>
            ))}
          </ol>
          {nearest.data?.items.length === 0 && <p>目前沒有可用桶</p>}
        </section>
        <LoadState {...list} />
        <div className="results-heading">
          <strong>位置清單</strong>
          <span>{list.data?.length ?? "—"} 筆位置紀錄</span>
        </div>
        <div className="location-list" aria-label="位置清單">
          {list.data?.length === 0 && <p>沒有符合的地點</p>}
          {list.data?.map((item) => (
            <button
              className="location-row"
              key={item.id}
              onClick={() => select(item)}
            >
              <span
                className={`row-buddy ${item.bin_status?.fill_status || "place"}`}
              >
                <Mascot kind={item.kind} />
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
                    <Status status={item.bin_status} />
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
          ))}
        </div>
      </aside>
      <section className="map-section">
        <LocationMap
          locations={list.data || []}
          selected={selected}
          onSelect={select}
        />
        {selected && list.data?.some((p) => p.id === selected.id) && (
          <LocationDetails
            location={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </section>
    </main>
  );
}
export function BinPage({
  id,
  navigation = false,
}: {
  id: string;
  navigation?: boolean;
}) {
  const { session } = useSession();
  const viewPath = `/bins/${encodeURIComponent(id)}/view`;
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
  if (navigation) return <Navigation view={view.data} />;
  const { location: item, status, can_report } = view.data;
  return (
    <main className="page detail-page">
      <a className="back-link" href="#map">
        ← 返回地圖
      </a>
      <div className="page-heading">
        <div>
          <h1>{item.label}</h1>
          <p>
            {item.district} ·{" "}
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
        <section className="buddy-card">
          <div className="buddy-portrait">
            <Mascot />
          </div>
          <Status status={status} />
          <p>
            {item.placement_status === "proposed"
              ? "建議點／待現勘，尚未設置"
              : status.is_usable
                ? "只收隨手小垃圾，請依現場狀況使用。"
                : `目前不可用：${status.unavailable_reasons.map((r) => reasonLabels[r] || r).join("、")}`}
          </p>
          <p>認養：{view.data.adopter?.display_name || "尚無認養者"}</p>
          {status.is_usable ? (
            <a className="button primary" href={`#nav/${id}`}>
              導航過去
            </a>
          ) : (
            <a className="button secondary" href={`#nav/${id}`}>
              尋找可用桶並導航
            </a>
          )}
          {can_report ? (
            <a className="button secondary" href={`#report/${id}`}>
              回報問題
            </a>
          ) : (
            <p>
              {view.data.report_block_reason === "login_required" ? (
                <a href={`#login?next=${encodeURIComponent(`bin/${id}`)}`}>
                  登入後回報
                </a>
              ) : (
                `暫不能回報：${reasonLabels[view.data.report_block_reason || ""] || view.data.report_block_reason}`
              )}
            </p>
          )}
          <p>按讚及認養操作尚未開放。</p>
        </section>
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
          locations={[{ ...item, bin_status: status }]}
          selected={item}
          onSelect={ignoreSelect}
        />
      </div>
    </main>
  );
}
function Navigation({ view }: { view: BinView }) {
  const available = view.status.is_usable;
  const nextPath = query("/map/nearest-usable", {
    district: "all",
    ...ORIGIN,
    limit: 3,
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
          <a className="button primary" href={`#report/${destination.id}`}>
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
