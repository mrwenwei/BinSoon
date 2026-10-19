import { useState } from "react";
import {
  problemLabels,
  query,
  request,
  time,
  workLabels,
  type PageData,
  type Report,
  type WorkDetail,
  type WorkOrder,
} from "../../data/api";
import { useSession } from "./SessionContext";
import { WasteTag } from "../WasteType";
import { LoadState } from "./LoadState";
import { ReportSummary } from "./ReportPages";
import { useApi } from "./useApi";
import { useCommand, CommandFeedback, type Intent } from "./Commands";
import {
  CompletionPhoto,
  CompletionRecord,
  WorkEvidence,
  WorkRequirements,
} from "./CompletionPages";

const priorityLabels = {
  immediate: "即刻處理",
  high: "優先",
  normal: "一般",
  inspection: "稽查情境",
};
const sourceLabels: Record<string, string> = {
  citizen: "市民回報",
  sensor: "感測情境",
  inspection: "稽查情境",
};
export function StaffPage({ id }: { id?: string }) {
  const { session } = useSession();
  if (id && id !== "tasks") return <WorkPage id={id} />;
  return session?.user.roles.includes("staff") ? <WorkList /> : <StaffLogin />;
}
function StaffLogin({ id }: { id?: string }) {
  return (
    <main className="page api-narrow">
      <h1>清潔隊工作台</h1>
      <p>請以責任區隊員身份登入。</p>
      <a
        className="button primary"
        href={`#staff/login?next=${encodeURIComponent(id ? `staff/tasks/${id}` : "staff/tasks")}`}
      >
        隊員登入
      </a>
    </main>
  );
}
function WorkList() {
  const { session } = useSession();
  const [bucket, setBucket] = useState("pending"),
    [offset, setOffset] = useState(0);
  const [type, setType] = useState(""),
    [source, setSource] = useState("");
  const [district, setDistrict] = useState(session?.user.districts[0] || "");
  const path = query("/staff/work-orders", {
    bucket,
    offset,
    limit: 20,
    ...(district ? { district } : {}),
    ...(type ? { type } : {}),
    ...(source ? { source } : {}),
  });
  const result = useApi(
    path,
    (signal) =>
      request<PageData<WorkOrder>>(path, {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CLEAN CITY, TOGETHER</span>
          <h1>清潔隊工作台</h1>
          <p>責任區：{session?.user.districts.join("、")}</p>
        </div>
        <a href="#staff/route">道路指引（尚未開放）</a>
      </div>
      <div className="api-work-filters">
        <label>
          工單分類
          <select
            value={bucket}
            onChange={(e) => {
              setBucket(e.target.value);
              setOffset(0);
            }}
          >
            {[
              ["pending", "待處理"],
              ["processing", "處理中"],
              ["completed", "已結案"],
              ["all", "全部"],
            ].map(([v, label]) => (
              <option value={v} key={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          責任區
          <select
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setOffset(0);
            }}
          >
            {session?.user.districts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          問題類型
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">全部問題</option>
            {Object.entries(problemLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          來源
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">全部來源</option>
            <option value="citizen">市民</option>
            <option value="sensor">感測情境</option>
            <option value="inspection">稽查情境</option>
          </select>
        </label>
      </div>
      <LoadState {...result} />
      {result.data?.items.length === 0 && <p>目前沒有符合的工單</p>}
      <ul className="api-items">
        {result.data?.items.map((w) => (
          <li
            className={`card work-card ${w.priority === "high" || w.is_overdue ? "urgent" : ""}`}
            key={w.id}
          >
            <span className={`staff-status ${w.status}`}>
              {workLabels[w.status]}
            </span>
            <WasteTag type={w.waste_type || "general"} />
            <h2>
              {problemLabels[w.type]} · {w.district}
            </h2>
            <p>
              優先度：{priorityLabels[w.priority]} · 來源：
              {sourceLabels[w.source] || w.source}
            </p>
            <p>
              建立：{time(w.created_at)} · 目標：{time(w.target_at)}
            </p>
            {w.is_overdue && <p>已超過示範目標時間，不代表真實到場承諾。</p>}
            <a className="button secondary" href={`#staff/tasks/${w.id}`}>
              查看工單 {w.id.slice(0, 8)}
            </a>
          </li>
        ))}
      </ul>
      <button
        disabled={!offset}
        onClick={() => setOffset((o) => Math.max(0, o - 20))}
      >
        上一頁
      </button>
      <button
        disabled={
          !result.data ||
          offset + result.data.items.length >= result.data.page.total
        }
        onClick={() => setOffset((o) => o + 20)}
      >
        下一頁
      </button>
    </main>
  );
}

function WorkPage({ id }: { id: string }) {
  const { session } = useSession();
  const staff = Boolean(session?.user.roles.includes("staff"));
  const path = `/staff/work-orders/${encodeURIComponent(id)}`;
  const result = useApi(
    staff ? path : null,
    (signal) =>
      request<WorkDetail>(path, { signal, token: session?.access_token }),
    true,
  );
  const work = result.data?.work_order;
  const owned = work?.assigned_staff_id === session?.user.id;
  const open =
    Boolean(work?.arrived_at) &&
    !["completed", "dismissed"].includes(work?.status || "");
  const evidence = result.data?.evidence.find(
    (e) => e.purpose === "completion",
  );
  const canFinish = Boolean(
    work?.type === "full" &&
    owned &&
    open &&
    evidence &&
    !work.submitted_at &&
    !result.data?.completion_requirements.missing.includes("reports_reviewed"),
  );
  function canRun(intent: Intent) {
    if (work?.blocked_by_removed_bin) return false;
    if (intent.path.endsWith("/accept")) return work?.status === "pending";
    if (intent.path.endsWith("/arrive"))
      return work?.status === "processing" && owned;
    if (intent.path.endsWith("/evidence"))
      return work?.type === "full" && owned && open && !evidence;
    if (intent.path.endsWith("/finish")) return canFinish;
    return owned && open;
  }
  const action = useCommand<
    WorkOrder | WorkDetail | { report: Report; work_order: WorkOrder }
  >({
    scope: path,
    authorized: staff,
    ready: Boolean(result.data) && !result.loading && !result.error,
    etag: result.etag || (work ? `"v${work.version}"` : null),
    refresh: result.reload,
    canRun,
  });
  function execute(next: { suffix: string; body: unknown; label?: string }) {
    return action.run({
      path: `${path}/${next.suffix}`,
      body: next.body,
      label:
        next.label ||
        (next.suffix === "accept"
          ? "接單"
          : next.suffix === "arrive"
            ? "確認到場"
            : next.suffix),
    });
  }
  const blocked = action.blocked || Boolean(work?.blocked_by_removed_bin);
  if (!staff) return <StaffLogin id={id} />;
  return (
    <main className="page api-narrow">
      <a className="back-link" href="#staff/tasks">
        ← 返回派工清單
      </a>
      <h1>{result.data?.location.label || "工單詳情"}</h1>
      <LoadState {...result} />
      {work && (
        <>
          <section className="card">
            <h2>{problemLabels[work.type]}</h2>
            <WasteTag type={work.waste_type || "general"} />
            <p>工單狀態：{workLabels[work.status]}</p>
            <p>工單版本 v{work.version}</p>
            <p>
              優先度：{priorityLabels[work.priority]} · 來源：
              {sourceLabels[work.source] || work.source}
            </p>
            <p>
              建立 {time(work.created_at)} · 目標 {time(work.target_at)}
            </p>
            <p>
              接單 {time(work.accepted_at)} · 到場 {time(work.arrived_at)}
            </p>
            {work.is_overdue && <p>超過示範目標，非真實到場承諾。</p>}
            {work.blocked_by_removed_bin && (
              <p role="alert">桶已撤除，工單操作受阻擋；未自動結案。</p>
            )}
            {work.status === "pending" && (
              <button
                className="button primary"
                disabled={blocked}
                onClick={() => {
                  void execute({ suffix: "accept", body: {} });
                }}
              >
                接單
              </button>
            )}
            {work.status === "processing" && owned && (
              <button
                className="button primary"
                disabled={blocked}
                onClick={() => {
                  void execute({ suffix: "arrive", body: {} });
                }}
              >
                確認到場
              </button>
            )}
            {!owned && work.status !== "pending" && (
              <p>此工單不是由你接單，只能查看。</p>
            )}
            {work.type === "full" && owned && open && (
              <>
                <CompletionPhoto
                  scope={path}
                  disabled={blocked || Boolean(evidence)}
                  saved={Boolean(evidence)}
                  onEvidence={(mediaId) =>
                    execute({
                      suffix: "evidence",
                      body: { media_id: mediaId, purpose: "completion" },
                      label: "掛上完成照",
                    })
                  }
                />
                <button
                  className="button primary"
                  disabled={blocked || !canFinish}
                  onClick={() => {
                    void execute({
                      suffix: "finish",
                      body: {},
                      label: "提交完成",
                    });
                  }}
                >
                  提交完成
                </button>
                {work.submitted_at && (
                  <p>已提交完成，等待伺服器確認其餘條件；不重複提交。</p>
                )}
              </>
            )}
            <a
              className="back-link"
              href={`#admin/work-orders/${id}`}
              target="_blank"
              rel="noreferrer"
            >
              管理員示範清空入口（另開分頁，需獨立登入）
            </a>
            <p>
              示範清空僅由管理員操作；非滿桶完工與修繕流程將於後續票單開放。
            </p>
          </section>
          <CommandFeedback action={action} retryLabel="重試原工單操作" />
          <CompletionRecord detail={result.data!} />
          <WorkEvidence detail={result.data!} />
          <h2>逐筆查證</h2>
          {result.data?.reports.length === 0 && (
            <p>此工單沒有市民回報，無須發點。</p>
          )}
          {result.data?.reports.map((report) => (
            <div className="api-review" key={report.id}>
              <ReportSummary report={report} />
              {!["approved", "rejected"].includes(report.status) && (
                <Verification
                  key={`${report.id}/${work.version}`}
                  disabled={
                    blocked ||
                    !owned ||
                    !work.arrived_at ||
                    ["completed", "dismissed"].includes(work.status)
                  }
                  onConfirm={(decision, reason) => {
                    void execute({
                      suffix: `reports/${report.id}/review`,
                      body: { decision, reason: reason || null },
                      label:
                        decision === "approved"
                          ? "查證屬實"
                          : `查證不實：${reason}`,
                    });
                  }}
                />
              )}
            </div>
          ))}
          <WorkRequirements detail={result.data!} />
        </>
      )}
    </main>
  );
}
function Verification({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm: (decision: string, reason: string) => void;
}) {
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="card api-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && decision && (decision !== "rejected" || reason.trim()))
          onConfirm(decision, reason);
      }}
    >
      <label>
        查證結果
        <select
          value={decision}
          disabled={disabled}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="">請選擇，不預設結果</option>
          <option value="approved">屬實</option>
          <option value="rejected">不實</option>
        </select>
      </label>
      <label>
        不實原因
        <textarea
          value={reason}
          maxLength={500}
          disabled={disabled}
          onChange={(e) => setReason(e.target.value)}
          required={decision === "rejected"}
        />
      </label>
      <button
        className="button primary"
        disabled={
          disabled || !decision || (decision === "rejected" && !reason.trim())
        }
      >
        確認查證
      </button>
    </form>
  );
}
