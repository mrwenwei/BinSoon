import { Icon } from "../Icon";
import { useDemoData } from "../../data/demoMode";
import { BinProposal } from "./BinProposal";
import { wasteHref, type WasteControls } from "../../data/waste";
import { compartmentCards } from "./Waste";
import { useEffect } from "react";
import {
  apiBinState,
  apiCompartments,
  query,
  request,
  type ApiLocation,
  type BinView,
} from "../../data/api";
import { StationCard } from "../StationCard";
import { Mascot } from "../Mascot";
import { LoadState } from "./LoadState";
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
    async (signal) => {
      const result = await request<BinView>(viewPath, {
        signal,
        token: session?.access_token,
      });
      // 詳情與導航共用所選槽，避免頂層 status 與雙槽資料不同步時讀到另一種類。
      const parts = result.data.compartments?.length
        ? result.data.compartments
        : result.data.location.compartments;
      const selected = parts?.find((part) => part.waste_type === wasteType);
      if (!selected) return result;
      return {
        ...result,
        data: {
          ...result.data,
          status: selected,
          location: { ...result.data.location, bin_status: selected },
        },
      };
    },
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
  if (!view.data)
    return (
      <div className="api-bin-detail mx-bin">
        <h1>桶詳情</h1>
        <LoadState {...view} />
      </div>
    );
  const { location: item, status, can_report } = view.data;
  const parts = apiCompartments(status, view.data.compartments);
  if (item.placement_status === "proposed")
    return <BinProposal key={item.id} location={item} />;
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
              {item.placement_status === "installed" ? "設置" : "既有公布桶"}
            </p>
          </div>
        </div>
      </div>
      <LoadState {...view} />
      {session?.user.roles.includes("admin") && (
        <a className="button secondary" href={`#admin/bins/${id}`}>
          管理桶生命週期
        </a>
      )}
      <section className="card bin-overview">
        <section aria-label="各類桶槽" className="bin-compartment-overview">
          <div className="bin-detail-buddy">
            <Mascot state={apiBinState(status)} />
          </div>
          {/* 面板同時顯示兩槽、由使用者自己判斷；不傳 onSelectWaste，槽只顯示不能點。
              種類由地圖篩選列的選單決定。 */}
          <StationCard compartments={compartmentCards(parts)} label="" />
        </section>
        <div className="bin-action-panel">
          <div>
            <Status status={status} />
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
        {!useDemoData(session?.access_token) && (
          <p className="bin-adoption tiny">
            認養：{view.data.adopter?.display_name || "尚無認養者"} ·
            {view.data.adopter && "已核准的公開認養資訊"}
          </p>
        )}
        {view.data.adopter?.role && <p>認養身份：{view.data.adopter.role}</p>}
        {view.data.adopter?.intro && (
          <p>認養店家介紹：{view.data.adopter.intro}</p>
        )}
        {!view.error &&
          (view.data.can_apply_adoption ||
            (!session &&
              !view.data.adopter &&
              !view.data.my_adoption_id &&
              status.operational_status !== "removed")) && (
            <a
              className="button secondary bin-adopt-cta"
              href={`#adopt/apply/${id}`}
              aria-label="申請認養此桶"
            >
              {useDemoData(session?.access_token) ? (
                <>
                  <Icon name="heart" />
                  <span>認領這位 BinU</span>
                  <small>屬實首報 ×2</small>
                  <Icon name="arrow" />
                </>
              ) : (
                "待認養 · 申請認養此桶"
              )}
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
    </div>
  );
}
