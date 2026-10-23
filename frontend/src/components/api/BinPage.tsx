import { useDemoData } from "../../data/demoMode";
import { BinProposal } from "./BinProposal";
import type { ProposalTally } from "../../map/browseMarkers";
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
import {
  ClaimCta,
  ClaimLimitRow,
  ClaimStep,
  type ClaimControls,
} from "./ClaimStep";
import { CLAIM_LIMIT, useMyClaims } from "./useMyClaims";
import { NameTag } from "../Pixel";
import { demoBinById } from "../../data/demoCitizen";
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
// 只拿掉小地圖（地圖本身就在旁邊）；回清單靠點地圖空白處或 Esc（MapPage）。
// label：清單已知的桶名，讀取中先當標題，桶換桶時不會閃過「桶詳情」。
export function BinPanel({
  id,
  wasteType,
  label,
  onLocation,
  onTally,
  claim,
}: Pick<WasteControls, "wasteType"> & {
  id: string;
  label?: string;
  onLocation?: (location: ApiLocation) => void;
  /** 建議點投票面板投完票時回報最新票數（地圖標記跟著更新）。 */
  onTally?: (tally: ProposalTally) => void;
  /** 認領步驟的開關與名字草稿（MapPage 保管，取消、Esc、點地圖空白都退回桶詳情、草稿保留）。 */
  claim?: ClaimControls;
}) {
  const { session } = useSession();
  const view = useBinView(id, wasteType);
  const claims = useMyClaims();
  const demo = useDemoData(session?.access_token);
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
        <h1>{label || "桶詳情"}</h1>
        <LoadState {...view} />
      </div>
    );
  const { location: item, status, can_report } = view.data;
  const parts = apiCompartments(status, view.data.compartments);
  if (item.placement_status === "proposed")
    return <BinProposal key={item.id} location={item} onTally={onTally} />;
  // 展示模式的桶名會被換成私人桶名；名牌當標題時，下一行放原本的地址。
  const address = (demo && demoBinById(id)?.label) || item.label;
  const mine = claims.names.get(id);
  const canClaim =
    !view.error &&
    (view.data.can_apply_adoption ||
      (!session &&
        !view.data.adopter &&
        !view.data.my_adoption_id &&
        status.operational_status !== "removed"));
  // 展示模式每人最多 5 隻（正式後端沒有這個上限，照後端規則走）。
  const atLimit =
    demo &&
    !!session &&
    !view.error &&
    !view.data.my_adoption_id &&
    claims.count >= CLAIM_LIMIT &&
    status.operational_status === "normal";
  if (claim?.open && canClaim && session)
    return (
      <ClaimStep
        binId={id}
        address={address}
        state={apiBinState(status)}
        draft={claim.draft}
        onDraft={claim.setDraft}
        onCancel={claim.cancel}
        onDone={() => {
          view.reload();
          claim.done();
        }}
      />
    );
  return (
    <div className="api-bin-detail mx-bin">
      <div className="page-heading bin-heading">
        <div className="bin-title">
          <span className="bin-avatar" aria-hidden="true">
            <Mascot state={apiBinState(status)} />
          </span>
          {/* 行政區與「既有公布桶」對站在現場的市民沒有資訊量，拿掉；
              只有市民投票新放的桶標「新設」，跟清單列同一顆膠囊。
              自己認領的桶：標題本身就是名牌（愛心＋名字），下一行原地址。 */}
          <div className="bin-title-text">
            <div className="bin-title-row">
              <h1>{mine ? <NameTag name={mine} size="xl" /> : item.label}</h1>
              {(item.bin_status?.is_new ||
                item.placement_status === "installed") && (
                <span className="status-pill">新設</span>
              )}
            </div>
            {mine && <p className="bin-title-sub">{address}</p>}
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
        {!demo && (
          <p className="bin-adoption tiny">
            認養：{view.data.adopter?.display_name || "尚無認養者"} ·
            {view.data.adopter && "已核准的公開認養資訊"}
          </p>
        )}
        {view.data.adopter?.role && <p>認養身份：{view.data.adopter.role}</p>}
        {view.data.adopter?.intro && (
          <p>認養店家介紹：{view.data.adopter.intro}</p>
        )}
        {/* 認領列：點了抽屜原地換成取名步驟；沒登入先登入再回到這個桶。
            自己已認領：這裡不放東西（標題就是名牌，結束認領在「我的 BinU」）。 */}
        {canClaim && !atLimit && (
          <ClaimCta
            onStart={session ? claim?.start : undefined}
            loginHref={
              session
                ? undefined
                : `#login?next=${encodeURIComponent(wasteHref(`bin/${id}`, wasteType).slice(1))}`
            }
          />
        )}
        {atLimit && <ClaimLimitRow />}
        {/* 正式後端要審核：送出後到核准前，標題還不是名牌，這裡說明審核中。 */}
        {view.data.my_adoption_id && !mine && !demo && (
          <div className="claim-limit">
            <p>
              <strong>認領申請審核中</strong>
              <small>審核通過後，這隻就是你的 BinU</small>
            </p>
            <a
              className="text-button"
              href={`#adopt/${view.data.my_adoption_id}`}
            >
              查看
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
