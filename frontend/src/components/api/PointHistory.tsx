import { useEffect, useState } from "react";
import {
  query,
  request,
  time,
  type PageData,
  type PointEntry,
} from "../../data/api";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { Pagination } from "./Pagination";
import { MemberNavigation } from "./MemberNavigation";

export function PointHistory() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);
  const { session } = useSession();
  const [offset, setOffset] = useState(0);
  const path = query("/me/point-entries", { limit: 20, offset });
  const entries = useApi(
    path,
    (signal) =>
      request<PageData<PointEntry>>(path, {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  return (
    <main className="page api-narrow point-history-page">
      <a className="back-link" href="#member">
        返回會員中心
      </a>
      <h1>點數歷史紀錄</h1>
      <MemberNavigation current="point-history" />
      <p>查看每筆點數的取得與使用。兌換扣除可用點數，不影響累積點數與等級。</p>
      <LoadState {...entries} />
      <ul className="api-items" aria-label="點數歷史紀錄">
        {entries.data?.items.map((entry) => (
          <li className="card" key={entry.id}>
            <h2>
              {entry.type === "report_award"
                ? "回報獎勵"
                : entry.type === "redemption"
                  ? "獎品兌換"
                  : entry.type}
            </h2>
            <p>{time(entry.created_at)}</p>
            <p>
              {entry.amount > 0 ? "+" : ""}
              {entry.amount} 點 · 餘額 {entry.balance_after} 點
            </p>
            {entry.report_id && (
              <a href={"#review/" + entry.report_id}>查看回報</a>
            )}
            {entry.redemption_id && (
              <a href={"#redemptions/" + entry.redemption_id}>查看兌換券</a>
            )}
          </li>
        ))}
      </ul>
      {entries.data?.items.length === 0 && <p>尚無點數紀錄</p>}
      <Pagination page={entries.data?.page} onChange={setOffset} />
    </main>
  );
}
