import { useEffect, useMemo } from "react";
import { allPages, type Adoption } from "../../data/api";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";

// 我認領的 BinU（/me/adoptions）：地圖標記與清單的名牌、桶詳情標題、上限判斷共用。
// 認領或結束認領之後發 CLAIMS_CHANGED，各處一起重讀（展示模式另外會收到 DEMO_UPDATED）。
export const CLAIMS_CHANGED = "binsoon-claims-changed";
export const notifyClaimsChanged = () =>
  window.dispatchEvent(new Event(CLAIMS_CHANGED));
// 名牌上的名字：展示模式是只有自己看得到的私人桶名；正式後端只有公開名稱。
export const claimName = (item: Adoption) =>
  item.private_bin_name || item.display_name;
export const CLAIM_LIMIT = 5;

export function useMyClaims() {
  const { session } = useSession();
  const citizen = !!session?.user.roles.includes("citizen");
  const list = useApi(
    citizen ? "/me/adoptions?claims" : null,
    async (signal) => ({
      data: await allPages<Adoption>("/me/adoptions", {
        signal,
        token: session?.access_token,
      }),
      etag: null,
      replayed: false,
    }),
  );
  const { reload } = list;
  useEffect(() => {
    window.addEventListener(CLAIMS_CHANGED, reload);
    return () => window.removeEventListener(CLAIMS_CHANGED, reload);
  }, [reload]);
  const items = list.data;
  return useMemo(() => {
    const active = (items ?? []).filter((item) => item.status === "active");
    return {
      loaded: !!items,
      error: list.error,
      active,
      // 待審也佔名額（展示模式的上限 5 隻照現有規則：pending＋active）。
      count: (items ?? []).filter((item) =>
        ["pending", "active"].includes(item.status),
      ).length,
      names: new Map(active.map((item) => [item.bin_id, claimName(item)])),
      reload,
    };
  }, [items, list.error, reload]);
}
