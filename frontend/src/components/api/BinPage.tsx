import {
  classificationName,
  wasteName,
  wasteHref,
  type WasteControls,
} from "../../data/waste";
import {
  WasteSelect,
  WasteInfo,
  compartmentCards,
  CompartmentSources,
} from "./Waste";
import { useState } from "react";
import {
  apiBinState,
  apiCompartments,
  query,
  request,
  time,
  type BinView,
  type Reading,
} from "../../data/api";
import { StationCard } from "../StationCard";
import { LocationMap } from "../../map/LocationMap";
import { LocationDetails } from "../LocationDetails";
import { Mascot } from "../Mascot";
import { LoadState } from "./LoadState";
import { CompletionThanks } from "./CompletionPages";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { ignoreSelect, reasonLabels, Status } from "./mapShared";
import { Navigation } from "./NavigationPage";
export function BinPage({
  id,
  navigation = false,
  wasteType,
  onWasteChange,
}: WasteControls & {
  id: string;
  navigation?: boolean;
}) {
  const { session } = useSession();
  const viewPath = query(`/bins/${encodeURIComponent(id)}/view`, {
    waste_type: wasteType,
  });
  const [historyType, setHistoryType] = useState<string>(wasteType);
  const view = useApi(
    viewPath,
    (signal) =>
      request<BinView>(viewPath, { signal, token: session?.access_token }),
    true,
  );
  const history = useApi(
    navigation
      ? null
      : query(`/bins/${id}/history`, { waste_type: historyType }),
    async (signal) => {
      const items: Reading[] = [];
      let offset = 0;
      while (true) {
        const { data } = await request<Reading[]>(
          query(`/bins/${encodeURIComponent(id)}/history`, {
            offset,
            limit: 100,
            waste_type: historyType,
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
        <a href={wasteHref("map", wasteType)}>返回地圖</a>
      </main>
    );
  if (navigation)
    return view.error ? (
      <main className="page">
        <h1>步行導航</h1>
        <WasteSelect
          value={wasteType}
          onChange={(value) => {
            if (value) onWasteChange(value);
          }}
        />
        <LoadState {...view} />
        <p>桶況尚未更新，請先重新載入確認可用性。</p>
      </main>
    ) : (
      <Navigation
        view={view.data}
        wasteType={wasteType}
        onWasteChange={onWasteChange}
      />
    );
  const { location: item, status, can_report } = view.data;
  const parts = apiCompartments(status, view.data.compartments);
  return (
    <main className="page detail-page api-bin-detail">
      <a className="back-link" href={wasteHref("map", wasteType)}>
        ← 返回地圖
      </a>
      <div className="page-heading bin-heading">
        <div className="bin-title">
          <span className="bin-avatar" aria-hidden="true">
            <Mascot state={apiBinState(status)} />
          </span>
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
        </div>
        <span className="demo-tag">
          {status.reading_source_type || "來源未知"} · 非實測 IoT
        </span>
      </div>
      <LoadState {...view} />
      <section className="card bin-overview">
        <div className="bin-overview-heading">
          <div>
            <h2>一個定點，兩種桶況</h2>
            <p className="tiny">選擇這次要使用的種類，查看可用性與操作。</p>
          </div>
          <WasteSelect
            value={wasteType}
            onChange={(value) => {
              if (value) onWasteChange(value);
            }}
          />
        </div>
        <section aria-label="各類桶槽" className="bin-compartment-overview">
          <StationCard
            compartments={compartmentCards(parts)}
            selectedWaste={wasteType}
            onSelectWaste={onWasteChange}
          />
          <CompartmentSources items={parts} />
        </section>
        <div className="bin-action-panel">
          <div>
            <Status status={status} />
            <WasteInfo value={status} />
            <p>
              {item.placement_status === "proposed"
                ? "建議點／待現勘，尚未設置"
                : status.is_usable
                  ? "只收隨手小垃圾，請依現場狀況使用。"
                  : `目前不可用：${status.unavailable_reasons.map((r) => reasonLabels[r] || r).join("、")}`}
            </p>
          </div>
          <div className="bin-actions">
            {!view.error &&
              (status.is_usable ? (
                <a
                  className="button primary"
                  href={wasteHref(`nav/${id}`, wasteType)}
                >
                  導航過去
                </a>
              ) : (
                <a
                  className="button primary"
                  href={wasteHref(`nav/${id}`, wasteType)}
                >
                  尋找可用桶並導航
                </a>
              ))}
            {!view.error &&
              !status.is_usable &&
              parts.find((part) => part.waste_type === "recycling")
                ?.is_usable &&
              wasteType !== "recycling" && (
                <a
                  className="button primary"
                  href={wasteHref(`nav/${id}`, "recycling")}
                >
                  導航過去丟回收
                </a>
              )}
            {can_report && !view.error ? (
              <a
                className="button secondary"
                href={wasteHref(`report/${id}`, wasteType)}
              >
                回報問題
              </a>
            ) : (
              <p>
                {view.error ? (
                  "桶況更新失敗，請重新載入後操作。"
                ) : view.data.report_block_reason === "login_required" ? (
                  <a
                    href={`#login?next=${encodeURIComponent(wasteHref(`bin/${id}`, wasteType).slice(1))}`}
                  >
                    登入後回報
                  </a>
                ) : (
                  `暫不能回報：${reasonLabels[view.data.report_block_reason || ""] || view.data.report_block_reason}`
                )}
              </p>
            )}
          </div>
        </div>
        <p className="bin-adoption tiny">
          認養：{view.data.adopter?.display_name || "尚無認養者"} ·
          認養操作尚未開放。
        </p>
      </section>
      <div className="bin-support-grid">
        <section className="card">
          <h2>滿度與清運歷史</h2>
          <p>
            {status.fill_level_pct === null
              ? "尚無有效讀值"
              : `${status.fill_level_pct}%（模擬）`}
          </p>
          <p>觀測：{time(status.observed_at)}</p>
          <label className="api-waste-select">
            歷史種類
            <select
              aria-label="歷史種類"
              value={historyType}
              onChange={(e) => setHistoryType(e.target.value)}
            >
              <option value="general">一般垃圾</option>
              <option value="recycling">資源回收</option>
              <option value="legacy_unknown">舊未分類</option>
            </select>
          </label>
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
                <small>
                  {wasteName(r.waste_type)} ·{" "}
                  {classificationName(r.classification_source)}
                </small>
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
        <section className="card bin-community">
          <CompletionThanks
            cleanup={view.data.latest_cleanup}
            binId={id}
            wasteType={wasteType}
            ready={!view.loading && !view.error}
            refresh={view.reload}
          />
        </section>
      </div>
      <div className="bin-location-grid">
        <LocationDetails
          location={item}
          onClose={() => {
            window.location.hash = wasteHref("map", wasteType).slice(1);
          }}
        />
        <div className="api-detail-map">
          <LocationMap
            locations={[{ ...item, bin_status: status }]}
            selected={item}
            onSelect={ignoreSelect}
          />
        </div>
      </div>
    </main>
  );
}
