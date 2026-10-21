import { useDemoData } from "../../data/demoMode";
import { taipeiMonth } from "../../data/calendar";
import { useState } from "react";
import {
  query,
  request,
  type StaffMonth,
  type PublicOutcomes,
} from "../../data/api";
import { districts } from "../../data/locations";
import type { WasteType } from "../../data/waste";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { StaffLogin } from "./StaffPages";

function duration(seconds: number | null) {
  return seconds === null
    ? "無資料"
    : `${Math.round((seconds / 60) * 10) / 10} 分鐘`;
}
export function Outcomes({ staff = false }: { staff?: boolean }) {
  const { session } = useSession();
  if (staff && !session?.user.roles.includes("staff"))
    return <StaffLogin next="staff/statistics" />;
  return <OutcomeView key={`${staff}/${session?.user.id}`} staff={staff} />;
}
function OutcomeView({ staff }: { staff: boolean }) {
  const { session } = useSession();
  const allowed = staff ? session!.user.districts : districts;
  const [district, setDistrict] = useState(
    allowed.includes("大安區") ? "大安區" : allowed[0] || "",
  );
  const [month, setMonth] = useState(taipeiMonth);
  const [waste, setWaste] = useState<WasteType | "">("");
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && !!district;
  const path = query(staff ? "/staff/statistics" : "/public/outcomes", {
    district,
    month,
    ...(waste ? { waste_type: waste } : {}),
  });
  const result = useApi(
    valid ? path : null,
    (signal) =>
      request<PublicOutcomes | StaffMonth>(path, {
        signal,
        ...(staff ? { token: session?.access_token } : {}),
      }),
    true,
  );
  const data = result.data;
  const privateData = data && "ranking" in data ? data : undefined;
  return (
    <main className="page api-narrow">
      <h1>{staff ? "我的月份成果與排名" : "清潔隊公開成果"}</h1>
      <p>
        {useDemoData(session?.access_token)
          ? "以下是台北曆月的本機展示成果，並非真實工作統計。"
          : "依台北曆月（Asia/Taipei）統計後端有效完成紀錄。讚與速度不改變同分名次。"}
      </p>
      <div className="card api-form">
        <label>
          月份
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label>
          行政區
          <select
            aria-label="行政區"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {allowed.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          垃圾種類
          <select
            value={waste}
            onChange={(e) => setWaste(e.target.value as WasteType | "")}
          >
            <option value="">全部種類</option>
            <option value="general">一般垃圾</option>
            <option value="recycling">資源回收</option>
          </select>
        </label>
      </div>
      {!valid && <p role="status">請選擇有效月份與責任區。</p>}
      <button
        className="button secondary"
        disabled={!valid || result.loading}
        onClick={result.reload}
      >
        更新成果
      </button>
      <LoadState {...result} />
      {data && (
        <section className="card">
          <h2>
            {data.month} · {data.district}
          </h2>
          <p>完成件數 {data.completed_count}</p>
          <p>收到感謝 {data.like_count}</p>
          {privateData && (
            <p>
              平均處理時間 {duration(privateData.average_processing_seconds)}
            </p>
          )}
          {data.completed_count === 0 && <p>本月尚無完成紀錄</p>}
        </section>
      )}
      {privateData && (
        <>
          <h2>隊員排名</h2>
          <p>加給僅為展示說明，沒有金額計算或發放。</p>
          <ol className="api-items" aria-label="隊員排名">
            {privateData.ranking.map((row) => (
              <li className="card" key={row.staff_id}>
                <h3>
                  第 {row.rank} 名 · {row.display_name}
                </h3>
                <p>
                  完成件數 {row.completed_count} · 收到感謝 {row.like_count}
                </p>
                <p>平均處理時間 {duration(row.average_processing_seconds)}</p>
              </li>
            ))}
          </ol>
          {privateData.ranking.length === 0 && <p>本月沒有排名資料</p>}
        </>
      )}
      <a className="back-link" href={staff ? "#staff/tasks" : "#map"}>
        {staff ? "返回清潔隊工作台" : "返回地圖"}
      </a>
    </main>
  );
}
