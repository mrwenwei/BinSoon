import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  command,
  errorMessage,
  problemLabels,
  query,
  request,
  sendCommand,
  time,
  workLabels,
  type Command,
  type PageData,
  type Report,
  type WorkDetail,
  type WorkOrder,
} from "../../data/api";
import { useSession } from "./SessionContext";
import { LoadState } from "./MapPages";
import { ReportSummary } from "./ReportPages";
import { useApi, useCooldown } from "./useApi";

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
const requirementLabels: Record<string, string> = {
  arrived: "到場",
  reports_reviewed: "全部回報查證",
  completion_photo: "完成照",
  work_submitted: "提交完成",
  fresh_clear_reading: "本次有效清空回傳",
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
          <li className="card" key={w.id}>
            <span className={`staff-status ${w.status}`}>
              {workLabels[w.status]}
            </span>
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

type Intent = { suffix: string; body: unknown };
type Pending = { operation: Command; intent: Intent };
const WorkCommands = createContext<{
  pending: Record<string, Pending>;
  save: (id: string, value: Pending | null) => void;
  clear: () => void;
} | null>(null);
export function WorkCommandProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Record<string, Pending>>({});
  return (
    <WorkCommands.Provider
      value={{
        pending,
        save: (id, value) =>
          setPending((old) => {
            const next = { ...old };
            if (value) next[id] = value;
            else delete next[id];
            return next;
          }),
        clear: () => setPending({}),
      }}
    >
      {children}
    </WorkCommands.Provider>
  );
}
export function useWorkCommands() {
  return useContext(WorkCommands)!;
}
function WorkPage({ id }: { id: string }) {
  const { session, invalidate } = useSession();
  const cooldown = useCooldown();
  const staff = Boolean(session?.user.roles.includes("staff"));
  const path = `/staff/work-orders/${encodeURIComponent(id)}`;
  const result = useApi(
    staff ? path : null,
    (signal) =>
      request<WorkDetail>(path, { signal, token: session?.access_token }),
    true,
  );
  const commands = useWorkCommands();
  const pending = commands.pending[id];
  const operation =
    pending?.operation.actorId === session?.user.id ? pending.operation : null;
  const [intent, setIntent] = useState<Intent | null>(pending?.intent || null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const actor = useRef(session);
  actor.current = session;
  const alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const work = result.data?.work_order;
  const etag = result.etag || (work ? `"v${work.version}"` : null);
  async function execute(next: Intent, retry = false) {
    if (
      !session ||
      !staff ||
      !etag ||
      result.loading ||
      lock.current ||
      cooldown.waiting
    )
      return;
    const current = session;
    const op =
      retry && operation
        ? operation
        : command(`${path}/${next.suffix}`, next.body, current.user.id, etag);
    const isCurrent = () =>
      alive.current && actor.current?.access_token === current.access_token;
    lock.current = true;
    setBusy(true);
    setError("");
    setConflict(false);
    commands.save(id, { operation: op, intent: next });
    setIntent(next);
    try {
      await sendCommand<WorkOrder | { report: Report; work_order: WorkOrder }>(
        op,
        current,
      );
      if (!isCurrent()) return;
      commands.save(id, null);
      setIntent(null);
      result.reload();
    } catch (e) {
      if (!isCurrent()) return;
      setError(errorMessage(e));
      cooldown.hold(e);
      if (e instanceof ApiError && e.status === 401)
        invalidate(current.access_token);
      else if (e instanceof ApiError && [409, 412, 428].includes(e.status)) {
        commands.save(id, null);
        setConflict(true);
        result.reload();
      } else if (e instanceof ApiError && e.status < 500 && e.status !== 429) {
        commands.save(id, null);
        setIntent(null);
        result.reload();
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!staff) return <StaffLogin id={id} />;
  const owned = work?.assigned_staff_id === session?.user.id;
  const blocked =
    cooldown.waiting ||
    busy ||
    result.loading ||
    Boolean(operation) ||
    conflict ||
    Boolean(work?.blocked_by_removed_bin);
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
            <p>完工、清空及修繕操作將於後續票單開放。</p>
          </section>
          {error && (
            <p role="alert">
              {error}
              {conflict && "，資料已重新讀取，請確認目前內容後再操作。"}
            </p>
          )}
          {operation && (
            <button
              className="button secondary"
              disabled={cooldown.waiting || busy || result.loading}
              onClick={() => {
                if (intent) void execute(intent, true);
              }}
            >
              重試原工單操作
            </button>
          )}
          {conflict && intent && (
            <button
              className="button primary"
              disabled={
                cooldown.waiting || busy || result.loading || !result.data
              }
              onClick={() => {
                void execute(intent);
              }}
            >
              確認目前版本並重試
            </button>
          )}
          {conflict && (
            <button
              onClick={() => {
                setConflict(false);
                setIntent(null);
                setError("");
              }}
            >
              取消這次操作
            </button>
          )}
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
                    });
                  }}
                />
              )}
            </div>
          ))}
          <section className="card">
            <h2>完成條件</h2>
            <p>
              {result.data?.completion_requirements.missing
                .map((r) => requirementLabels[r] || r)
                .join("、") || "依伺服器狀態確認"}
            </p>
          </section>
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
