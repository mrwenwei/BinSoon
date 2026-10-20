import { useState } from "react";
import { query, request, type AdoptionMonth } from "../../data/api";
import { taipeiMonth } from "../../data/calendar";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
export function AdoptionMonthly({ id }: { id: string }) {
  const { session } = useSession();
  const [month, setMonth] = useState(taipeiMonth);
  const path = query(`/adoptions/${id}/monthly-summary`, { month });
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const summary = useApi(
    valid ? path : null,
    (signal) =>
      request<AdoptionMonth>(path, { signal, token: session?.access_token }),
    true,
  );
  return (
    <section className="card api-form">
      <h2>認養月報</h2>
      <label>
        認養月份
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <p>依台北曆月及本次認養有效期間統計。</p>
      <LoadState {...summary} />
      {!valid && <p role="status">請選擇有效月份。</p>}
      {summary.data && (
        <>
          <p>
            {summary.data.month} · {summary.data.timezone}
          </p>
          {summary.data.is_partial_month && (
            <p>部分月份：僅計本次有效認養期間</p>
          )}
          <p>送出回報 {summary.data.reports_submitted}</p>
          <p>查證通過 {summary.data.reports_approved}</p>
          <p>已發點數 {summary.data.points_awarded}</p>
          <p>資料來源：{summary.data.source_type}</p>
        </>
      )}
    </section>
  );
}
