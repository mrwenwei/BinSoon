import { wasteHref, type WasteType } from "../../data/waste";
import { WasteInfo, Compartments } from "./Waste";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  errorMessage,
  request,
  time,
  workLabels,
  type Cleanup,
  type Result,
  type TaskReading,
  type WorkDetail,
  type WorkOrder,
} from "../../data/api";
import { validatePhoto } from "../../data/media";
import { createDemoPhoto } from "../../data/demoPhoto";
import { CommandFeedback, useCommand, useWorkCommands } from "./Commands";
import { useSession } from "./SessionContext";
import { useApi, useCooldown } from "./useApi";
import { LoadState } from "./LoadState";
import { PrivatePhoto } from "./ReportPages";

const requirementLabels: Record<string, string> = {
  arrived: "到場",
  reports_reviewed: "全部回報查證",
  completion_photo: "完成照",
  work_submitted: "提交完成",
  fresh_clear_reading: "本次有效清空回傳",
};
export function WorkRequirements({ detail }: { detail: WorkDetail }) {
  if (detail.work_order.status === "dismissed")
    return (
      <section className="card">
        <h2>結案結果</h2>
        <p>本案已依現況證據確認無需處理，未產生可計件完成紀錄。</p>
      </section>
    );
  return (
    <section className="card">
      <h2>完成條件</h2>
      <p>
        {detail.completion_requirements.missing
          .map((r) => requirementLabels[r] || r)
          .join("、") || "全部條件已具備；結案依伺服器工單狀態確認。"}
      </p>
    </section>
  );
}
export function WorkPhoto({
  scope: workScope,
  purpose = "completion",
  disabled,
  saved,
  onEvidence,
}: {
  scope: string;
  purpose?: "completion" | "site";
  disabled: boolean;
  saved: boolean;
  onEvidence: (mediaId: string) => Promise<unknown>;
}) {
  const scope = `${workScope}/${purpose}`;
  const title = purpose === "site" ? "現況照片" : "完成照片";
  const photo = purpose === "site" ? "現況照" : "完成照";
  const { session, invalidate } = useSession();
  const store = useWorkCommands();
  const candidate = store.photos[scope];
  const draft = candidate?.actorId === session?.user.id ? candidate : undefined;
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [validating, setValidating] = useState(false);
  const cooldown = useCooldown();
  const alive = useRef(true),
    lock = useRef(false),
    selection = useRef(0);
  const latest = useRef({ session, store, onEvidence, disabled });
  latest.current = { session, store, onEvidence, disabled };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      selection.current++;
    };
  }, []);
  useEffect(() => {
    if (!draft?.file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(draft.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft?.file]);
  useEffect(() => {
    if (saved && draft) store.savePhoto(scope, null);
  }, [saved, draft, store, scope]);
  async function select(input?: File | Promise<File>, demo = false) {
    const actor = session,
      sequence = ++selection.current;
    setError("");
    if (!actor) return;
    store.savePhoto(scope, null);
    if (!input) {
      setValidating(false);
      return;
    }
    setValidating(true);
    try {
      const file = await input;
      await validatePhoto(file);
      if (
        alive.current &&
        latest.current.session?.access_token === actor.access_token &&
        sequence === selection.current
      )
        latest.current.store.savePhoto(scope, {
          actorId: actor.user.id,
          file,
          demo,
        });
    } catch (e) {
      if (alive.current && sequence === selection.current)
        setError(e instanceof Error ? e.message : "照片無法使用");
    } finally {
      if (alive.current && sequence === selection.current) setValidating(false);
    }
  }
  async function upload() {
    if (
      !session?.user.roles.includes("staff") ||
      disabled ||
      saved ||
      !draft?.file ||
      lock.current ||
      cooldown.waiting ||
      validating
    )
      return;
    const actor = session;
    const isCurrent = () =>
      alive.current &&
      latest.current.session?.access_token === actor.access_token;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let mediaId = draft.mediaId;
      if (!mediaId) {
        const form = new FormData();
        form.append("file", draft.file);
        form.append("purpose", purpose);
        const { data } = await request<{ id: string }>("/media", {
          method: "POST",
          body: form,
          token: actor.access_token,
        });
        if (!isCurrent()) return;
        mediaId = data.id;
        latest.current.store.savePhoto(scope, { ...draft, mediaId });
      }
      if (!latest.current.disabled) {
        const result = await latest.current.onEvidence(mediaId);
        if (isCurrent() && result) latest.current.store.savePhoto(scope, null);
      }
    } catch (e) {
      if (!isCurrent()) return;
      setError(errorMessage(e));
      cooldown.hold(e);
      if (e instanceof ApiError && e.status === 401)
        invalidate(actor.access_token);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (saved) return <p>{photo}已保存</p>;
  return (
    <section className="api-form api-completion-photo">
      <h3>{title}</h3>
      <p className="tiny">
        到場後再拍攝／上傳，一張 JPEG、PNG 或 WebP，最多 5 MiB／2000
        萬像素。上傳後須掛到本工單，再明確
        {purpose === "site" ? "確認無需處理" : "提交完成"}。
      </p>
      <section className="api-demo-tools" aria-label={`${photo}`}>
        <p className="tiny">
          此按鈕只填入照片；上傳並掛上照片才會寫入後端，不會自動完工。
        </p>
        <button
          type="button"
          className="button secondary"
          disabled={disabled || busy || validating}
          onClick={() => void select(createDemoPhoto(purpose), true)}
        >
          產生{photo}
        </button>
      </section>
      <label>
        {title}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={disabled || busy || validating}
          onChange={(e) => {
            void select(e.target.files?.[0]);
          }}
        />
      </label>
      {preview && (
        <img className="api-photo" src={preview} alt={`待送出的${title}`} />
      )}
      {error && <p role="alert">{error}</p>}
      {draft?.mediaId && <p>照片已上傳，尚待確認掛到本工單；不會重複上傳。</p>}
      <button
        className="button secondary"
        disabled={
          disabled || busy || validating || cooldown.waiting || !draft?.file
        }
        onClick={() => {
          void upload();
        }}
      >
        {busy
          ? `處理${photo}中…`
          : draft?.mediaId
            ? `掛上已上傳的${photo}`
            : `上傳並掛上${photo}`}
      </button>
    </section>
  );
}
export function WorkEvidence({ detail }: { detail: WorkDetail }) {
  return (
    <section className="card" aria-label="工單證據">
      <h2>工單證據</h2>
      <WasteInfo value={detail.work_order} />
      {detail.evidence.length ? (
        detail.evidence.map((e) => (
          <div key={e.id}>
            <p>{e.purpose === "completion" ? "完成照片" : "現況照片"}</p>
            <PrivatePhoto id={e.media_id} alt="工單證據照片" />
          </div>
        ))
      ) : (
        <p>尚未保存工作照片</p>
      )}
      {detail.latest_reading && (
        <div>
          <h3>本次清空證據</h3>
          <WasteInfo value={detail.latest_reading} />
          <p>
            桶內滿度 {detail.latest_reading.fill_level_pct}% ·{" "}
            {detail.latest_reading.source_type}
          </p>
          <p>
            觀測 {time(detail.latest_reading.observed_at)} · 接收{" "}
            {time(detail.latest_reading.received_at)}
          </p>
          <p className="tiny">依作業時間顯示紀錄。</p>
        </div>
      )}
    </section>
  );
}
export function DismissalRecord({ detail }: { detail: WorkDetail }) {
  const work = detail.work_order;
  if (work.status !== "dismissed") return null;
  return (
    <section className="card">
      <h2>已確認無需處理</h2>
      <WasteInfo value={work} />
      <p>結案時間：{time(work.completed_at)}</p>
      <p>原因：{work.reason || "未提供"}</p>
      <p>
        依現況照片與逐筆查證結案，不計完成件數，也不產生本次可讚成果。其他同桶工單仍依各自狀態處理。
      </p>
    </section>
  );
}
export function CompletionRecord({ detail }: { detail: WorkDetail }) {
  const { session } = useSession();
  const work = detail.work_order;
  if (work.status !== "completed") return null;
  if (!work.completion_id)
    return <p role="status">工單已完成，正在確認完成紀錄。</p>;
  return (
    <section className="card" aria-label="工單完成紀錄">
      <span className="demo-tag">有證據的工作成果</span>
      <h2>工作已完成</h2>
      <WasteInfo value={work} />
      <p>完成紀錄 {work.completion_id}</p>
      <p>完成時間：{time(work.completed_at)}</p>
      <p>查證與點數結算是獨立結果，不會再次發點。</p>
      <a
        className="button secondary"
        href={session?.user.roles.includes("admin") ? "#admin" : "#staff/tasks"}
      >
        返回工作入口
      </a>
    </section>
  );
}
export function AdminPage({ id }: { id?: string }) {
  const { session } = useSession();
  const [workId, setWorkId] = useState("");
  if (!session?.user.roles.includes("admin"))
    return (
      <main className="page api-narrow">
        <h1>管理員清空</h1>
        <p>此操作需要獨立管理員 session，市民與隊員不能執行。</p>
        <a
          className="button primary"
          href={`#admin/login?next=${encodeURIComponent(id ? `admin/work-orders/${id}` : "admin")}`}
        >
          管理員登入
        </a>
      </main>
    );
  if (id) return <AdminWork key={id} id={id} />;
  return (
    <main className="page api-narrow">
      <h1>管理員清空</h1>
      <p>輸入隊員提供的工單 ID；不使用共享維運 token。</p>
      <form
        className="card api-form"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.hash = `admin/work-orders/${workId.trim()}`;
        }}
      >
        <label>
          工單 ID
          <input
            value={workId}
            required
            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
            onChange={(e) => setWorkId(e.target.value)}
          />
        </label>
        <button className="button primary">讀取工單</button>
      </form>
    </main>
  );
}
function AdminWork({ id }: { id: string }) {
  const { session } = useSession();
  const authorized = Boolean(session?.user.roles.includes("admin"));
  const path = `/admin/work-orders/${encodeURIComponent(id)}`;
  const detail = useApi(
    authorized ? path : null,
    (signal) =>
      request<WorkDetail>(path, { signal, token: session?.access_token }),
    true,
  );
  const [confirmed, setConfirmed] = useState(false);
  const work = detail.data?.work_order;
  const canClear = Boolean(
    work?.type === "full" &&
    work.arrived_at &&
    ["arrived", "waiting_sensor"].includes(work.status) &&
    !work.clear_reading_id &&
    !work.blocked_by_removed_bin,
  );
  const action = useCommand<{ reading: TaskReading; work_order: WorkOrder }>({
    scope: path,
    authorized,
    ready: Boolean(detail.data) && !detail.loading && !detail.error,
    etag: detail.etag || (work ? `"v${work.version}"` : null),
    refresh: detail.reload,
    canRun: () => confirmed && canClear,
  });
  return (
    <main className="page api-narrow">
      <a className="back-link" href="#admin">
        返回管理員入口
      </a>
      <h1>管理員清空</h1>
      <LoadState {...detail} />
      {detail.data && (
        <>
          <section className="card">
            <h2>{detail.data.location.label}</h2>
            <p>工單狀態：{workLabels[work!.status]}</p>
            <p>工單版本 v{work!.version}</p>
            <WasteInfo value={work!} />
            <Compartments items={detail.data.location.compartments} />
            <p>工單 ID：{id}</p>
            <p>
              桶內滿度：
              {detail.data.location.bin_status?.fill_level_pct ?? "未知"}
              {detail.data.location.bin_status?.fill_level_pct == null
                ? ""
                : "%"}
            </p>
            <p>
              清空只更新容量及本次工作證據，不能代替完成照、全部查證與提交完成。
            </p>
            {canClear ? (
              <>
                <label className="api-check">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={action.blocked}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  確認送出清空回傳
                </label>
                <button
                  className="button primary"
                  disabled={action.blocked || !confirmed}
                  onClick={() => {
                    void action.run({
                      path: `${path}/demo-clear`,
                      body: { reading_id: crypto.randomUUID() },
                      label: "清空回傳",
                    });
                  }}
                >
                  送出清空
                </button>
              </>
            ) : (
              <p>
                {work!.clear_reading_id
                  ? "本工單已有清空回傳，不重複建立。"
                  : "此工單目前不符合清空條件。"}
              </p>
            )}
          </section>
          <CommandFeedback action={action} retryLabel="重試原清空操作" />
          <CompletionRecord detail={detail.data} />
          <WorkEvidence detail={detail.data} />
          <WorkRequirements detail={detail.data} />
        </>
      )}
    </main>
  );
}
export function CompletionThanks({
  cleanup,
  binId,
  wasteType,
  ready,
  refresh,
}: {
  cleanup: Cleanup | null;
  binId: string;
  wasteType: WasteType;
  ready: boolean;
  refresh: () => void;
}) {
  const { session } = useSession();
  const citizen = Boolean(session?.user.roles.includes("citizen"));
  const action = useCommand<Cleanup>({
    scope: `/bins/${binId}/thanks/${wasteType}`,
    authorized: citizen,
    ready,
    refresh,
    reconfirm: false,
    canRun: (intent) =>
      Boolean(
        cleanup?.can_like && intent.path === `/completions/${cleanup.id}/like`,
      ),
  });
  return (
    <section className="api-thanks" aria-label="感謝清潔隊">
      {cleanup ? (
        <>
          <h3>最近一次清運／清潔完成</h3>
          <WasteInfo value={cleanup} />
          <p>
            {time(cleanup.completed_at)} · {cleanup.like_count} 個感謝
          </p>
          <p className="tiny">
            感謝只歸屬這次完成，不增加市民點數或改變隊員排名。
          </p>
          <button
            className="button secondary"
            disabled={
              action.blocked ||
              !citizen ||
              !cleanup.can_like ||
              cleanup.liked_by_me
            }
            onClick={() => {
              void action.run({
                path: `/completions/${cleanup.id}/like`,
                body: {},
                label: "感謝這次清運／清潔",
              });
            }}
          >
            {cleanup.liked_by_me ? "已感謝" : "謝謝清潔隊"}
          </button>
          {!citizen && (
            <a
              href={`#login?next=${encodeURIComponent(wasteHref(`bin/${binId}`, wasteType).slice(1))}`}
            >
              市民登入後感謝
            </a>
          )}
        </>
      ) : (
        <p>尚無可驗證清運完成紀錄</p>
      )}
      <CommandFeedback action={action} retryLabel="重試原按讚" />
    </section>
  );
}
