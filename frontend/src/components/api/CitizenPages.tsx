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
        </div>
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
    </main>
  );
}
export function CitizenReports() {
  const value = useDemoCitizenSnapshot();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const reports = value.reports;
  return (
    <main className="page api-narrow citizen-reports">
      <header className="compact-page-head">
        <a className="back-link" href="#member" aria-label="返回我的">
          <Icon name="back" />
        </a>
        <h1>回報紀錄</h1>
      </header>

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
                <span
                  className={`status-pill${report.status === "approved" && report.awarded_points > 0 ? " report-points" : ""}`}
                >
                  {report.status === "approved"
                    ? report.awarded_points
                      ? `+${report.awarded_points}點`
                      : "已查證"
                    : report.status === "rejected"
                      ? "不符合・無法給點"
                      : "審核中"}
                </span>
              </div>
              <p>
                {new Date(report.created_at).toLocaleString("zh-TW", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "Asia/Taipei",
                })}{" "}
                · {wasteName(report.waste_type)} · {problemLabels[report.type]}
              </p>
              <div className="citizen-report-actions">
                {canLike && (
                  <button
                    className="button secondary"
                    disabled={!!completion?.likedAt || !!busy}
                    aria-label={
                      completion?.likedAt ? `已感謝${staff}` : `幫${staff}按讚`
                    }
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
                    <span>
                      {completion?.likedAt
                        ? `已感謝${staff}`
                        : `幫${staff}按讚`}
                    </span>
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
          同一個事件只有第一位回報者得點；不實回報累積 3 次會暫停回報 7 天。
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
      <p className="tiny">認養不需要代替清潔隊清運。</p>
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
      <h2 className="citizen-bin-name">
        <Mascot />
        <span>{item.private_bin_name || "我的 BinU"}</span>
      </h2>
      <p>{demoBinById(item.bin_id)?.label || item.bin_id}</p>
      <LoadState {...bin} />
      {bin.data && (
        <StationCard
          label=""
          compartments={compartmentCards(bin.data.compartments)}
        />
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
          通報清潔隊
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

      {error && <p role="alert">{error}</p>}
    </article>
  );
}
