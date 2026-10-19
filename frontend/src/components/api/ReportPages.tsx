import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  allPages,
  ApiError,
  command,
  errorMessage,
  problemLabels,
  query,
  reportLabels,
  request,
  sendCommand,
  time,
  workLabels,
  type BinView,
  type Command,
  type Membership,
  type PointEntry,
  type Problem,
  type Report,
} from "../../data/api";
import { useSession } from "./SessionContext";
import { LoadState } from "./MapPages";
import { useApi, useCooldown } from "./useApi";

type Draft = {
  type: Problem;
  description: string;
  latitude: string;
  longitude: string;
  confirmed: boolean;
  file?: File;
  mediaId?: string;
  operation?: Command;
  ownerId?: string;
};
type DraftState = Record<string, Draft>;
const emptyDraft = (): Draft => ({
  type: "full",
  description: "",
  latitude: "",
  longitude: "",
  confirmed: false,
});
const DraftContext = createContext<{
  drafts: DraftState;
  update: (id: string, patch: Partial<Draft>) => void;
  clear: () => void;
  remove: (id: string) => void;
} | null>(null);
export function ReportDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<DraftState>({});
  const { session } = useSession();
  const lastActor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!session) return;
    if (lastActor.current && lastActor.current !== session.user.id)
      setDrafts({});
    lastActor.current = session.user.id;
  }, [session?.user.id]);
  return (
    <DraftContext.Provider
      value={{
        drafts,
        update: (id, patch) =>
          setDrafts((old) => ({
            ...old,
            [id]: { ...(old[id] || emptyDraft()), ...patch },
          })),
        clear: () => setDrafts({}),
        remove: (id) =>
          setDrafts((old) => {
            const copy = { ...old };
            delete copy[id];
            return copy;
          }),
      }}
    >
      {children}
    </DraftContext.Provider>
  );
}
export function useReportDrafts() {
  return useContext(DraftContext)!;
}
export function RequireCitizen({
  next,
  children,
}: {
  next: string;
  children: ReactNode;
}) {
  const { session } = useSession();
  if (!session?.user.roles.includes("citizen"))
    return (
      <main className="page api-narrow">
        <h1>請以市民身份登入</h1>
        <p>登入後讀取你的回報與會員資料。</p>
        <a
          className="button primary"
          href={`#login?next=${encodeURIComponent(next)}`}
        >
          市民登入
        </a>
      </main>
    );
  return <>{children}</>;
}
export function ReportForm({ id }: { id: string }) {
  const { session, invalidate } = useSession();
  const { drafts, update, remove } = useReportDrafts();
  const cooldown = useCooldown();
  const saved = drafts[id];
  const draft =
    saved && (!saved.ownerId || saved.ownerId === session?.user.id)
      ? saved
      : emptyDraft();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [preview, setPreview] = useState("");
  const [positionError, setPositionError] = useState("");
  const actor = useRef(session);
  actor.current = session;
  const alive = useRef(true);
  const selection = useRef(0);
  const lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      selection.current++;
    };
  }, []);
  useEffect(() => {
    if (!draft.file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(draft.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.file]);
  const path = `/bins/${encodeURIComponent(id)}/view`;
  const view = useApi(
    path,
    (signal) =>
      request<BinView>(path, { signal, token: session?.access_token }),
    true,
  );
  const lat = draft.latitude.trim() ? Number(draft.latitude) : NaN;
  const lng = draft.longitude.trim() ? Number(draft.longitude) : NaN;
  const validPosition =
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180 &&
    draft.confirmed;
  const frozen = Boolean(draft.operation) || busy;
  async function selectFile(file?: File) {
    const version = ++selection.current;
    const token = session?.access_token;
    setError("");
    update(id, { file: undefined, mediaId: undefined });
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("請選 JPEG、PNG 或 WebP，大小最多 5 MiB。");
      return;
    }
    setValidating(true);
    try {
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 20000000) throw new Error("照片最多 2000 萬像素。");
      if (
        alive.current &&
        actor.current?.access_token === token &&
        version === selection.current
      )
        update(id, { file });
    } catch {
      if (
        alive.current &&
        actor.current?.access_token === token &&
        version === selection.current
      )
        setError("照片無法解碼或超過 2000 萬像素，請重新選擇。");
    } finally {
      if (
        alive.current &&
        actor.current?.access_token === token &&
        version === selection.current
      )
        setValidating(false);
    }
  }
  async function submit() {
    if (
      !session ||
      !session.user.roles.includes("citizen") ||
      lock.current ||
      cooldown.waiting
    )
      return;
    if (
      !draft.operation &&
      (!view.data?.can_report ||
        !validPosition ||
        !draft.file ||
        validating ||
        (draft.type === "other" && !draft.description.trim()))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    const current = session;
    const isCurrent = () =>
      alive.current && actor.current?.access_token === current.access_token;
    let operation = draft.operation;
    try {
      if (!operation) {
        let mediaId = draft.mediaId;
        if (!mediaId) {
          const form = new FormData();
          form.append("file", draft.file!);
          form.append("purpose", "report");
          const { data } = await request<{ id: string }>("/media", {
            method: "POST",
            token: current.access_token,
            body: form,
          });
          if (!isCurrent()) return;
          mediaId = data.id;
          update(id, { mediaId, ownerId: current.user.id });
        }
        operation = command(
          "/reports",
          {
            bin_id: id,
            type: draft.type,
            description: draft.description,
            photo_ids: [mediaId],
            position: { latitude: lat, longitude: lng },
            quick: false,
          },
          current.user.id,
        );
        update(id, { operation, ownerId: current.user.id });
      }
      const { data } = await sendCommand<Report>(operation, current);
      if (!isCurrent()) return;
      remove(id);
      window.location.hash = `report-done/${data.id}`;
    } catch (e) {
      if (!isCurrent()) return;
      setError(errorMessage(e));
      cooldown.hold(e);
      if (e instanceof ApiError && e.status === 401)
        invalidate(current.access_token);
      else if (e instanceof ApiError && e.status < 500 && e.status !== 429) {
        update(id, { operation: undefined });
        view.reload();
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <main className="page api-narrow">
      <a className="back-link" href={`#bin/${id}`}>
        返回桶詳情
      </a>
      <h1>回報問題</h1>
      <p>{view.data?.location.label}</p>
      <LoadState {...view} />
      {session?.user.roles.includes("citizen") &&
        view.data &&
        !view.data.can_report && (
          <p role="alert">暫不能回報：{view.data.report_block_reason}</p>
        )}
      <form
        className="card api-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={frozen}>
          <legend>現場問題</legend>
          <label>
            問題類型
            <select
              value={draft.type}
              onChange={(e) => update(id, { type: e.target.value as Problem })}
            >
              {Object.entries(problemLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            說明
            <textarea
              value={draft.description}
              maxLength={500}
              required={draft.type === "other"}
              onChange={(e) => update(id, { description: e.target.value })}
            />
          </label>
          <label>
            現場照片
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(e) => {
                void selectFile(e.target.files?.[0]);
              }}
            />
          </label>
          <p className="tiny">
            一張 JPEG／PNG／WebP，最多 5 MiB、2000 萬像素。後端會再次驗證並移除
            EXIF。
          </p>
          {preview && (
            <img className="api-photo" src={preview} alt="待送出的現場照片" />
          )}
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setPositionError("");
              if (!navigator.geolocation) {
                setPositionError(
                  "瀏覽器不支援定位，請自行輸入並確認現場座標。",
                );
                return;
              }
              const token = session?.access_token;
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  if (
                    alive.current &&
                    !lock.current &&
                    actor.current?.access_token === token
                  )
                    update(id, {
                      latitude: String(p.coords.latitude),
                      longitude: String(p.coords.longitude),
                      confirmed: false,
                    });
                },
                () => {
                  if (alive.current && actor.current?.access_token === token)
                    setPositionError("定位不可用，請自行輸入並確認現場座標。");
                },
                { timeout: 10000, maximumAge: 0 },
              );
            }}
          >
            取得目前位置
          </button>
          {positionError && <p role="status">{positionError}</p>}
          <label>
            緯度
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              value={draft.latitude}
              onChange={(e) =>
                update(id, { latitude: e.target.value, confirmed: false })
              }
            />
          </label>
          <label>
            經度
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              value={draft.longitude}
              onChange={(e) =>
                update(id, { longitude: e.target.value, confirmed: false })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.confirmed}
              onChange={(e) => update(id, { confirmed: e.target.checked })}
            />
            確認這是我提供的現場位置
          </label>
          <p className="tiny">
            需距桶 50 公尺內，由後端驗證；手動座標不代表防偽 GPS。
          </p>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {!session?.user.roles.includes("citizen") ? (
          <a
            className="button primary"
            href={`#login?next=${encodeURIComponent(`report/${id}`)}`}
          >
            登入後繼續回報
          </a>
        ) : (
          <button
            className="button primary"
            disabled={
              busy ||
              validating ||
              cooldown.waiting ||
              (!draft.operation &&
                (!draft.file ||
                  !validPosition ||
                  !view.data?.can_report ||
                  (draft.type === "other" && !draft.description.trim())))
            }
          >
            {busy ? "送出中…" : draft.operation ? "重試原回報" : "確認送出回報"}
          </button>
        )}
        {draft.operation && (
          <p role="status">
            原操作已保留，請使用相同帳號重試確認結果；不會建立第二次操作。
          </p>
        )}
      </form>
    </main>
  );
}
export function PrivatePhoto({ id }: { id: string }) {
  const { session } = useSession();
  const path = `/media/${encodeURIComponent(id)}/access`;
  const access = useApi(session ? path : null, (signal) =>
    request<{ url: string; expires_at: string }>(path, {
      signal,
      token: session?.access_token,
    }),
  );
  const [failed, setFailed] = useState(false);
  const url = access.data?.url;
  useEffect(() => {
    setFailed(false);
  }, [url]);
  useEffect(() => {
    if (!access.data) return;
    const timer = setTimeout(
      access.reload,
      Math.max(1000, Date.parse(access.data.expires_at) - Date.now() - 5000),
    );
    return () => clearTimeout(timer);
  }, [access.data, access.reload]);
  return (
    <div>
      <LoadState {...access} />
      {url && !failed && (
        <img
          className="api-photo"
          src={url}
          alt="案件現場照片"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <p>
          照片連結可能已過期。
          <button
            onClick={() => {
              setFailed(false);
              access.reload();
            }}
          >
            重新取得照片
          </button>
        </p>
      )}
    </div>
  );
}
export function ReportSummary({ report }: { report: Report }) {
  return (
    <section className="card">
      <h2>{problemLabels[report.type]}</h2>
      <p>查證狀態：{reportLabels[report.status]}</p>
      <p>
        工單進度：
        {report.work_status ? workLabels[report.work_status] : "尚未派工"}
      </p>
      {report.assignment_status === "unassigned" && (
        <p>此回報尚未指派，超出目前大安區隊員範圍。</p>
      )}
      <p>待確認點數 {report.pending_points}</p>
      <p>已入帳點數 {report.awarded_points}</p>
      {report.status === "approved" && report.work_status !== "completed" && (
        <p>查證屬實不代表工作已完成。</p>
      )}
      {report.rejection_reason && <p>不實原因：{report.rejection_reason}</p>}
      <p>{report.description}</p>
      <p>
        送出：{time(report.created_at)} · 查證：{time(report.reviewed_at)}
      </p>
      <details>
        <summary>案件識別</summary>
        <p>回報 {report.id}</p>
        <p>事件 {report.event_id}</p>
        <p>工單 {report.work_order_id || "無"}</p>
      </details>
      {report.photo_ids.map((id) => (
        <PrivatePhoto key={id} id={id} />
      ))}
      <a className="back-link" href={`#bin/${report.bin_id}`}>
        查看這個桶
      </a>
    </section>
  );
}
export function ReportDetail({
  id,
  done = false,
}: {
  id: string;
  done?: boolean;
}) {
  const { session } = useSession();
  const path = `/reports/${encodeURIComponent(id)}`;
  const result = useApi(
    path,
    (signal) => request<Report>(path, { signal, token: session?.access_token }),
    true,
  );
  return (
    <main className="page api-narrow">
      <h1>{done ? "謝謝你幫城市變乾淨！" : "回報進度"}</h1>
      <LoadState {...result} />
      {result.data && <ReportSummary report={result.data} />}
      <a className="button secondary" href="#reports">
        我的回報
      </a>
      <a className="button primary" href="#member">
        前往會員中心
      </a>
    </main>
  );
}
export function ReportsList() {
  const { session } = useSession();
  const [offset, setOffset] = useState(0);
  const path = query("/me/reports", { limit: 20, offset });
  const result = useApi(
    path,
    (signal) =>
      request<import("../../data/api").PageData<Report>>(path, {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  return (
    <main className="page api-narrow">
      <h1>我的回報</h1>
      <LoadState {...result} />
      {result.data?.items.length === 0 && <p>尚無回報</p>}
      <ul className="api-items">
        {result.data?.items.map((r) => (
          <li className="card" key={r.id}>
            <a href={`#review/${r.id}`}>
              {problemLabels[r.type]} · {reportLabels[r.status]}
            </a>
            <p>
              {r.work_status ? workLabels[r.work_status] : "尚未派工"} ·{" "}
              {time(r.created_at)}
            </p>
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
export function Member() {
  const { session } = useSession();
  const membership = useApi(
    "/me/membership",
    (signal) =>
      request<Membership>("/me/membership", {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  const entries = useApi(
    "/me/point-entries",
    async (signal) => ({
      data: await allPages<PointEntry>("/me/point-entries", {
        signal,
        token: session?.access_token,
      }),
      etag: null,
      replayed: false,
    }),
    true,
  );
  return (
    <main className="page api-narrow">
      <h1>會員中心</h1>
      <LoadState {...membership} />
      {membership.data && (
        <section className="card">
          <h2>{membership.data.current_tier.name}</h2>
          <p>累積點數 {membership.data.cumulative_points}</p>
          <p>可用點數 {membership.data.available_points}</p>
          <p>待確認點數 {membership.data.pending_points}</p>
          <p>
            屬實回報 {membership.data.approved_report_count} 次 · 不實{" "}
            {membership.data.rejected_report_count} 次
          </p>
          {membership.data.next_tier && (
            <p>
              再 {membership.data.points_to_next_tier} 點升到「
              {membership.data.next_tier.name}」
            </p>
          )}
          {membership.data.reporting_suspended && (
            <p role="status">
              回報資格暫停，提案／投票／認養不因此停權；相關功能仍依各自串接進度開放。
            </p>
          )}
        </section>
      )}
      <h2>點數台帳</h2>
      <LoadState {...entries} />
      <ul className="api-items">
        {entries.data?.map((e) => (
          <li className="card" key={e.id}>
            {time(e.created_at)} · {e.type} · {e.amount} 點 · 餘額{" "}
            {e.balance_after}
            {e.report_id && <a href={`#review/${e.report_id}`}>查看回報</a>}
          </li>
        ))}
      </ul>
      {entries.data?.length === 0 && <p>尚無點數紀錄</p>}
      <a className="button secondary" href="#reports">
        查看我的回報
      </a>
      <p>獎品兌換尚未開放。</p>
    </main>
  );
}
