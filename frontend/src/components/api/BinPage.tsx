import {
  classificationName,
  wasteName,
  wasteHref,
  type WasteControls,
} from "../../data/waste";
import { WasteInfo, compartmentCards, CompartmentSources } from "./Waste";
import { useEffect, useState } from "react";
import {
  apiBinState,
  apiCompartments,
  query,
  request,
  time,
  type ApiLocation,
  type BinView,
  type Reading,
} from "../../data/api";
import { StationCard } from "../StationCard";
import { LocationDetails } from "../LocationDetails";
import { Mascot } from "../Mascot";
import { LoadState } from "./LoadState";
import { CompletionThanks } from "./CompletionPages";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { reasonLabels, Status } from "./mapShared";
// 桶詳情的 view 讀取；地圖面板（BinPanel）與步行導航頁共用。
export function useBinView(id: string, wasteType: string) {
  const { session } = useSession();
  const viewPath = query(`/bins/${encodeURIComponent(id)}/view`, {
    waste_type: wasteType,
  });
  return useApi(
    viewPath,
    (signal) =>
      request<BinView>(viewPath, { signal, token: session?.access_token }),
    true,
    { stopOnNotFound: true },
  );
}
// 地圖瀏覽模式：選桶後在面板內原地顯示的桶資訊。內容先沿用原獨立桶頁，
// 只拿掉小地圖（地圖本身就在旁邊）；返回清單由面板標題列提供。
export function BinPanel({
  id,
  wasteType,
  onLocation,
}: Pick<WasteControls, "wasteType"> & {
  id: string;
  onLocation?: (location: ApiLocation) => void;
}) {
  const { session } = useSession();
  const [historyType, setHistoryType] = useState<string>(wasteType);
  const view = useBinView(id, wasteType);
  const loaded = view.data;
  useEffect(() => {
    if (loaded && onLocation)
      onLocation({
        ...loaded.location,
        bin_status: loaded.status,
        compartments: loaded.compartments?.length
          ? loaded.compartments
          : loaded.location.compartments,
      });
  }, [loaded, onLocation]);
  const history = useApi(
    query(`/bins/${id}/history`, { waste_type: historyType }),
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
    { stopOnNotFound: true },
  );
  if (!view.data)
    return (
      <div className="api-bin-detail mx-bin">
        <h1>桶詳情</h1>
        <LoadState {...view} />
      </div>
    );
  const { location: item, status, can_report } = view.data;
  const parts = apiCompartments(status, view.data.compartments);
  return (
    <div className="api-bin-detail mx-bin">
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
      {session?.user.roles.includes("admin") && (
        <a className="button secondary" href={`#admin/bins/${id}`}>
          管理桶生命週期
        </a>
      )}
      <section className="card bin-overview">
        <section aria-label="各類桶槽" className="bin-compartment-overview">
          {/* 面板同時顯示兩槽、由使用者自己判斷；不傳 onSelectWaste，槽只顯示不能點。
              種類由地圖篩選列的選單決定。 */}
          <StationCard compartments={compartmentCards(parts)} />
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
          {view.data.adopter && "已核准的公開認養資訊"}
        </p>
        {view.data.adopter?.role && <p>認養身份：{view.data.adopter.role}</p>}
        {view.data.adopter?.intro && (
          <p>認養店家介紹：{view.data.adopter.intro}</p>
        )}
        {view.data.can_apply_adoption && !view.error && (
          <a className="button secondary" href={`#adopt/apply/${id}`}>
            申請認養此桶
          </a>
        )}
        {view.data.my_adoption_id && (
          <a
            className="button secondary"
            href={`#adopt/${view.data.my_adoption_id}`}
          >
            管理我的認養
          </a>
        )}
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
      </div>
    </div>
  );
}
