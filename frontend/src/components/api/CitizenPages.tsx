import { useEffect, useState } from "react";
import {
  demoBinById,
  demoCitizenSnapshot,
  demoReportCompletion,
  demoStaffNames,
  likeDemoReport,
} from "../../data/demoCitizen";
import { DEMO_STORE_KEY, DEMO_UPDATED } from "../../data/demoMode";
import {
  problemLabels,
  reportLabels,
  workLabels,
  request,
  time,
  type Adoption,
  type BinView,
} from "../../data/api";
import { wasteHref, wasteName, type WasteType } from "../../data/waste";
import { Mascot } from "../Mascot";
import { Icon } from "../Icon";
import { StationCard } from "../StationCard";
import { compartmentCards } from "./Waste";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";

export function useDemoCitizenSnapshot() {
  const [value, setValue] = useState(demoCitizenSnapshot);
  useEffect(() => {
    const update = () => setValue(demoCitizenSnapshot());
    const storage = (event: StorageEvent) => {
      if (event.key === DEMO_STORE_KEY || event.key === null) update();
    };
    window.addEventListener(DEMO_UPDATED, update);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(DEMO_UPDATED, update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return value;
}
export function CitizenHome() {
  const { session } = useSession();
  const value = useDemoCitizenSnapshot();
  const member = useApi(
    "/me/membership",
    (signal) =>
      request<import("../../data/api").Membership>("/me/membership", {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  const claims = value.adoptions.filter((a) => a.status === "active").length;
  const votes = value.proposals.filter((p) => p.my_vote).length;
  const installed = value.proposals.filter(
    (p) => p.my_vote === "support" && p.status === "installed",
  ).length;
  return (
    <main className="page api-narrow citizen-home">
      <header className="page-heading">
        <div>
          <h1>我的</h1>
          <p>市民小安 · 本機免密碼登入</p>
        </div>
        <Mascot />
      </header>
      <LoadState {...member} />
      {member.data && (
        <section className="member-hero" aria-label="我的點數">
          <span>可用點數</span>
          <strong className="numeral-xl">{member.data.available_points}</strong>
          <p>另有 {member.data.pending_points} 點審核中</p>
          <a className="button primary" href="#rewards">
            兌換獎勵 <Icon name="arrow" />
          </a>
          <p className="tiny">
            累積 {member.data.cumulative_points} 點 ·{" "}
            {member.data.current_tier.name} ·{" "}
            <a href="#levels">查看等級與徽章</a>
          </p>
        </section>
      )}
      <nav className="citizen-shortcuts" aria-label="我的功能">
        <a className="card" href="#adopt">
          <Icon name="heart" />
          <span>
            <strong>我的 BinU</strong>
            <small>認養 {claims} 個 · 屬實首報點數 ×2</small>
          </span>
          <Icon name="arrow" />
        </a>
        <a className="card" href="#reports">
          <Icon name="report" />
          <span>
            <strong>回報紀錄</strong>
            <small>
              共 {value.reports.length} 筆 ·{" "}
              {
                value.reports.filter((r) =>
                  ["pending", "processing"].includes(r.status),
                ).length
              }{" "}
              件審核中
            </small>
          </span>
          <Icon name="arrow" />
        </a>
        <a className="card" href="#vote/votes">
          <Icon name="pin" />
          <span>
            <strong>投票紀錄</strong>
            <small>
              投過 {votes} 個點 · 支持的點已設置 {installed} 個
            </small>
          </span>
          <Icon name="arrow" />
        </a>
      </nav>
      <aside className="member-how">
        <h2>怎麼拿點數</h2>
        <p>
          清潔員查證屬實，一般首報 +1 點；認養的 BinU首報 +2
          點。同一事件只有第一位回報者得點。
        </p>
      </aside>
      <nav className="api-pagination" aria-label="更多會員功能">
        <a href="#point-history">點數歷史紀錄</a>
        <a href="#redemptions">我的兌換</a>
        <a href="#notifications">通知與進度</a>
      </nav>
    </main>
  );
}
export function CitizenReports() {
  const value = useDemoCitizenSnapshot();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [waste, setWaste] = useState<WasteType | "">("");
  const reports = value.reports.filter((r) => !waste || r.waste_type === waste);
  return (
    <main className="page api-narrow citizen-reports">
      <a className="back-link" href="#member" aria-label="返回我的">
        ← 返回我的
      </a>
      <h1>回報紀錄</h1>

      <label>
        垃圾種類
        <select
          aria-label="垃圾種類"
          value={waste}
          onChange={(e) => setWaste(e.target.value as WasteType | "")}
        >
          <option value="">全部種類</option>
          <option value="general">一般垃圾</option>
          <option value="recycling">資源回收</option>
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <ul className="api-items" aria-label="回報紀錄">
        {reports.map((report) => {
          const completion = demoReportCompletion(report);
          const staff = completion && demoStaffNames[completion.staffId];
          const canLike =
            report.status === "approved" &&
            report.work_status === "completed" &&
            !!staff;
          const owned = value.adoptions.find(
            (a) => a.bin_id === report.bin_id && a.status === "active",
          );
          const label =
            owned?.private_bin_name ||
            demoBinById(report.bin_id)?.label ||
            "桶位";
          return (
            <li className="card citizen-report-row" key={report.id}>
              <div className="crew-between">
                <h2>{label}</h2>
                <span className="status-pill">
                  {reportLabels[report.status]}
                </span>
              </div>
              <p>
                {time(report.created_at)} · {wasteName(report.waste_type)} ·{" "}
                {problemLabels[report.type]}
              </p>
              <p>
                {report.work_status
                  ? workLabels[report.work_status]
                  : "待清潔員處理"}{" "}
                ·{" "}
                {report.awarded_points
                  ? `已入帳 +${report.awarded_points} 點`
                  : report.pending_points
                    ? `+${report.pending_points} 點審核中`
                    : "本筆未發點"}
              </p>
              <div className="citizen-report-actions">
                <a href={`#review/${report.id}`}>查看回報詳情</a>
                {canLike && (
                  <button
                    className="button secondary"
                    disabled={!!completion?.likedAt || !!busy}
                    aria-pressed={!!completion?.likedAt}
                    onClick={async () => {
                      setBusy(report.id);
                      setError("");
                      try {
                        await likeDemoReport(report.id);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    <Icon name="heart" />
                    {completion?.likedAt ? `已感謝${staff}` : `幫${staff}按讚`}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!reports.length && <p>尚無符合的回報紀錄。</p>}
      <aside className="member-how">
        <p>
          查證屬實且已完成的回報，可感謝處理該事件的清潔員。同一次完成只能按讚一次；讚會顯示在該清潔員的榮譽榜，不改變依完成件數計算的排名。近期不實回報達三次會暫停回報七天。
        </p>
      </aside>
    </main>
  );
}
export function CitizenBins({ wasteType }: { wasteType: WasteType }) {
  const value = useDemoCitizenSnapshot();
  const active = value.adoptions.filter((a) => a.status === "active");
  return (
    <main className="page api-narrow citizen-bins">
      <a className="back-link" href="#member" aria-label="返回我的">
        ← 返回我的
      </a>
      <h1>我的 BinU</h1>
      <p>認養 {active.length} 個／最多 5 個 · 屬實首報 ×2</p>
      <p className="tiny">私人桶名只有自己看得到，認養不需要代替清潔隊清運。</p>
      <div className="citizen-bin-list">
        {active.map((item) => (
          <CitizenBin key={item.id} item={item} wasteType={wasteType} />
        ))}
      </div>
      {!active.length && (
        <section className="card">
          <p>還沒有自己的 BinU。</p>
          <a className="button primary" href="#map">
            去地圖認養
          </a>
        </section>
      )}
      <a className="back-link" href="#adopt?manage=1">
        查看認養管理與歷史
      </a>
    </main>
  );
}
function CitizenBin({
  item,
  wasteType,
}: {
  item: Adoption;
  wasteType: WasteType;
}) {
  const { session } = useSession();
  const value = useDemoCitizenSnapshot();
  const [notice, setNotice] = useState("");
  const [full, setFull] = useState(item.preferences.full);
  useEffect(() => setFull(item.preferences.full), [item.preferences.full]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const path = `/bins/${encodeURIComponent(item.bin_id)}/view?waste_type=${wasteType}`;
  const bin = useApi(
    path,
    (signal) =>
      request<BinView>(path, { signal, token: session?.access_token }),
    true,
  );
  const reports = value.reports.filter(
    (r) =>
      r.bin_id === item.bin_id &&
      new Date(r.created_at)
        .toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })
        .slice(0, 7) ===
        new Date()
          .toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })
          .slice(0, 7),
  );
  const completed = new Set(
    reports.filter((r) => r.work_status === "completed").map((r) => r.event_id),
  ).size;
  return (
    <article className="card citizen-bin-card">
      <h2>{item.private_bin_name || "我的 BinU"}</h2>
      <p>{demoBinById(item.bin_id)?.label || item.bin_id} · 名字只有你看得到</p>
      <LoadState {...bin} />
      {bin.data && (
        <StationCard compartments={compartmentCards(bin.data.compartments)} />
      )}
      <p>
        本月回報 {reports.length} 次 · 完成處理 {completed} 次 · 桶旁堆放回報{" "}
        {reports.filter((r) => r.type === "dumping").length} 次
      </p>
      {bin.data?.can_report ? (
        <a
          className="button primary"
          href={wasteHref(`report/${item.bin_id}`, wasteType)}
        >
          這隻有狀況？回報桶況／問題
        </a>
      ) : (
        <p>此桶目前無法回報，請查看桶詳情。</p>
      )}
      <div className="api-pagination">
        <a href={`#adopt/${item.id}`}>管理／修改私人桶名</a>
        <a href={wasteHref(`bin/${item.bin_id}`, wasteType)}>查看桶詳情</a>
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={full}
          disabled={busy}
          onChange={async (e) => {
            const nextFull = e.target.checked;
            setFull(nextFull);
            setBusy(true);
            setNotice("");
            setError("");
            try {
              await request(`/adoptions/${item.id}/preferences`, {
                method: "PATCH",
                token: session?.access_token,
                etag: `"v${item.version}"`,
                key: crypto.randomUUID(),
                body: { full: nextFull, dumping: false, dirty: false },
              });
              setNotice("通知偏好已儲存");
            } catch (e) {
              setFull(
                demoCitizenSnapshot().adoptions.find((a) => a.id === item.id)
                  ?.preferences.full ?? item.preferences.full,
              );
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        吃飽了（80% 以上）通知我
      </label>
      {(busy || notice) && (
        <p role="status">{busy ? "正在儲存通知偏好…" : notice}</p>
      )}
      <p className="tiny">此為本機通知偏好，未串接外部推播。</p>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
