import { PhoneReportGate, isPhoneBrowser } from "./PhoneReportGate";
import { isDemoToken } from "../../data/demoMode";
import {
  wasteName,
  wasteHref,
  type WasteType,
  type WasteControls,
} from "../../data/waste";
import { WasteSelect, WasteInfo } from "./Waste";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { validatePhoto } from "../../data/media";
import { createDemoPhoto } from "../../data/demoPhoto";
import {
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
  type Adoption,
  type Command,
  type Membership,
  type Problem,
  type Report,
} from "../../data/api";
import { useSession } from "./SessionContext";
import { WastePicker, WasteTag } from "../WasteType";
import { Mascot } from "../Mascot";
import { LoadState } from "./LoadState";
import { useApi, useCooldown } from "./useApi";
import { Icon } from "../Icon";
import { MemberNavigation } from "./MemberNavigation";

type Draft = {
  type: Problem;
  description: string;
  latitude: string;
  longitude: string;
  confirmed: boolean;
  file?: File;
  demoPhoto?: boolean;
  aiProblem?: Problem;
  problems?: Problem[];
  operations?: Command[];
  completedIds?: string[];
  demoPosition?: "near" | "far" | "unavailable";
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
export function QuickReport({
  id,
  ...controls
}: { id: string } & WasteControls) {
  return (
    <PhoneReportGate>
      <RequireCitizen
        next={wasteHref(`quick-report/${id}`, controls.wasteType).slice(1)}
      >
        <QuickReportContent id={id} {...controls} />
      </RequireCitizen>
    </PhoneReportGate>
  );
}
function QuickReportContent({
  id,
  ...controls
}: { id: string } & WasteControls) {
  const { session } = useSession();
  const path = `/adoptions/${id}`;
  const adoption = useApi(
    path,
    (signal) =>
      request<Adoption>(path, { signal, token: session?.access_token }),
    true,
  );
  if (!adoption.data)
    return (
      <main className="page api-narrow">
        <h1>認養快捷通報</h1>
        <LoadState {...adoption} />
        <a className="back-link" href="#adopt">
          返回我的認養
        </a>
      </main>
    );
  return (
    <>
      <LoadState {...adoption} />
      <ReportForm
        id={adoption.data.bin_id}
        {...controls}
        quickAdoption={{
          item: adoption.data,
          ready: !adoption.loading && !adoption.error,
          reload: adoption.reload,
        }}
      />
    </>
  );
}
export function ReportForm(props: Parameters<typeof PhoneReportForm>[0]) {
  return (
    <PhoneReportGate>
      <PhoneReportForm {...props} />
    </PhoneReportGate>
  );
}
function PhoneReportForm({
  id,
  wasteType,
  onWasteChange,
  quickAdoption,
}: {
  id: string;
  quickAdoption?: { item: Adoption; ready: boolean; reload: () => void };
} & WasteControls) {
  const { session, invalidate } = useSession();
  const { drafts, update, remove } = useReportDrafts();
  const cooldown = useCooldown();
  const draftKey = `${id}/${wasteType}${quickAdoption ? `/quick/${quickAdoption.item.id}` : ""}`;
  const quickAllowed =
    !quickAdoption ||
    (quickAdoption.ready &&
      quickAdoption.item.status === "active" &&
      quickAdoption.item.bin_id === id);
  const saved = drafts[draftKey];
  const draft =
    saved && (!saved.ownerId || saved.ownerId === session?.user.id)
      ? saved
      : emptyDraft();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [preview, setPreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const actor = useRef(session);
  actor.current = session;
  const alive = useRef(true);
  const selection = useRef(0);
  useEffect(() => {
    selection.current++;
    setAnalyzing(false);
    setValidating(false);
  }, [session?.access_token]);
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
  const path = query(`/bins/${encodeURIComponent(id)}/view`, {
    waste_type: wasteType,
  });
  const view = useApi(
    path,
    (signal) =>
      request<BinView>(path, { signal, token: session?.access_token }),
    true,
  );
  useEffect(() => {
    if (
      !view.data ||
      draft.demoPosition ||
      draft.operation ||
      draft.operations?.length
    )
      return;
    update(draftKey, {
      latitude: String(view.data.location.latitude),
      longitude: String(view.data.location.longitude),
      confirmed: true,
      demoPosition: "near",
    });
  }, [view.data?.location.id, draft.demoPosition, draftKey]);
  const selectedProblems = draft.problems ?? (draft.file ? [draft.type] : []);
  const lat = draft.latitude.trim() ? Number(draft.latitude) : NaN;
  const lng = draft.longitude.trim() ? Number(draft.longitude) : NaN;
  const validPosition =
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180 &&
    draft.confirmed &&
    draft.demoPosition === "near" &&
    Boolean(view.data) &&
    distanceToBin(
      lat,
      lng,
      view.data!.location.latitude,
      view.data!.location.longitude,
    ) <= 50;
  const pendingOperation = Boolean(draft.operation || draft.operations?.length);
  const frozen = pendingOperation || busy || analyzing;
  const demoMarker =
    draft.demoPhoto || draft.demoPosition
      ? `[模擬測試：${[draft.demoPhoto && "示意照片", draft.demoPosition && "模擬座標（非實測 GPS）"].filter(Boolean).join("／")}]\n`
      : "";
  const description = demoMarker + draft.description;
  const descriptionTooLong = description.length > 500;
  async function selectFile(input?: File | Promise<File>, demoPhoto = false) {
    const version = ++selection.current;
    const token = session?.access_token;
    setError("");
    update(draftKey, {
      file: undefined,
      mediaId: undefined,
      demoPhoto: false,
      aiProblem: undefined,
      problems: [],
    });
    setAnalyzing(false);
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
        actor.current?.access_token === token &&
        version === selection.current
      ) {
        update(draftKey, { file, demoPhoto });
        if (demoPhoto && isDemoToken(token)) {
          setAnalyzing(true);
          // 純本機情境：依所選槽的展示桶況決定預選，不傳送圖片至 AI 服務。
          const aiProblem: Problem =
            view.data?.status.fill_status === "full" ? "full" : "dirty";
          await new Promise<void>((resolve) =>
            window.setTimeout(resolve, 1600),
          );
          if (
            alive.current &&
            actor.current?.access_token === token &&
            version === selection.current
          ) {
            update(draftKey, {
              type: aiProblem,
              aiProblem,
              problems: [aiProblem],
            });
            setAnalyzing(false);
          }
        }
      }
    } catch (e) {
      if (
        alive.current &&
        actor.current?.access_token === token &&
        version === selection.current
      )
        setError(e instanceof Error ? e.message : "照片無法使用，請重新選擇。");
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
      !isPhoneBrowser() ||
      !session ||
      !session.user.roles.includes("citizen") ||
      lock.current ||
      cooldown.waiting
    )
      return;
    if (
      !pendingOperation &&
      (!quickAllowed ||
        !view.data?.can_report ||
        Boolean(view.error) ||
        descriptionTooLong ||
        !validPosition ||
        !draft.file ||
        !draft.demoPhoto ||
        validating ||
        !selectedProblems.length)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    const current = session;
    const isCurrent = () =>
      alive.current && actor.current?.access_token === current.access_token;
    let operations =
      draft.operations ?? (draft.operation ? [draft.operation] : []);
    const completedIds = [...(draft.completedIds ?? [])];
    try {
      if (!operations.length) {
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
          update(draftKey, { mediaId, ownerId: current.user.id });
        }
        operations = selectedProblems.map((problem) =>
          command(
            "/reports",
            {
              bin_id: id,
              waste_type: wasteType,
              type: problem,
              description:
                demoMarker + (problem === "other" ? "其他現場問題" : ""),
              photo_ids: [mediaId],
              position: { latitude: lat, longitude: lng },
              quick: Boolean(quickAdoption),
            },
            current.user.id,
          ),
        );
        update(draftKey, { operations, ownerId: current.user.id });
      }
      while (operations.length) {
        const { data } = await sendCommand<Report>(operations[0], current);
        if (!isCurrent()) return;
        completedIds.push(data.id);
        operations = operations.slice(1);
        update(draftKey, { operations, completedIds });
      }
      remove(draftKey);
      window.location.hash = `report-done/${completedIds[0]}?reports=${completedIds.map(encodeURIComponent).join(",")}&problems=${selectedProblems.join(",")}`;
    } catch (e) {
      if (!isCurrent()) return;
      setError(
        (completedIds.length
          ? `已送出 ${completedIds.length} 項，其餘尚未完成。`
          : "") + errorMessage(e),
      );
      cooldown.hold(e);
      if (e instanceof ApiError && e.status === 401)
        invalidate(current.access_token);
      else if (e instanceof ApiError && e.status < 500 && e.status !== 429) {
        view.reload();
        quickAdoption?.reload();
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <main className="page api-narrow report-compose">
      <header className="report-header">
        <a
          className="back-link"
          href={wasteHref(`bin/${id}`, wasteType)}
          aria-label="返回桶詳情"
        >
          <Icon name="back" />
        </a>
        <h1>{quickAdoption ? "快捷通報" : "回報桶況"}</h1>
        <span />
      </header>
      <LoadState {...view} />
      <div
        className={`report-proximity ${validPosition && !view.error ? "ready" : "blocked"}`}
        role="status"
      >
        <Icon name={validPosition && !view.error ? "check" : "pin"} />
        <span>
          {validPosition && !view.error
            ? "你在桶位 50 公尺內，可以回報"
            : view.loading
              ? "正在確認與桶位的距離…"
              : "請靠近桶位 50 公尺內再回報"}
        </span>
      </div>
      <p className="report-bin-name">{view.data?.location.label}</p>
      {quickAdoption && !quickAllowed && (
        <p role="alert">僅有效認領可快捷通報。</p>
      )}
      {view.data && !view.data.can_report && (
        <p role="alert">
          暫不能回報：
          {view.data.report_block_reason === "suspended"
            ? "回報資格暫停"
            : view.data.report_block_reason}
        </p>
      )}
      <form
        className="report-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <WastePicker
          name="report-waste-type"
          value={wasteType}
          disabled={frozen}
          onChange={onWasteChange}
        />
        <fieldset className="report-capture-fields" disabled={frozen}>
          <legend className="visually-hidden">現場問題</legend>
          <section className="report-photo-stage" aria-label="手機現場回報">
            {preview ? (
              <img className="api-photo" src={preview} alt="待送出的照片" />
            ) : (
              <div className="report-photo-empty">
                <Icon name="camera" />
                <h2>拍下桶況，讓我們看看</h2>
                <p>對準垃圾桶與周圍環境</p>
              </div>
            )}
            <button
              type="button"
              className={`button ${preview ? "secondary" : "primary"}`}
              disabled={
                !validPosition ||
                Boolean(view.error) ||
                validating ||
                !quickAllowed
              }
              onClick={() => {
                if (isPhoneBrowser() && validPosition)
                  void selectFile(createDemoPhoto(), true);
              }}
            >
              <Icon name="camera" />
              {preview ? "重新拍照" : "現場拍照"}
            </button>
          </section>
          {analyzing && (
            <div className="ai-analysis" role="status" aria-live="polite">
              <span className="ai-progress" aria-hidden="true" />
              AI 正在辨識桶況…
            </div>
          )}
          {preview && !analyzing && (
            <section className="report-issues" aria-label="問題類型">
              <div className="report-issues-heading">
                <h2>發現什麼問題？</h2>
                <span>可複選</span>
              </div>
              {draft.aiProblem && <p className="tiny">AI 已選好，可以再調整</p>}
              <div className="report-issue-grid">
                {Object.entries(problemLabels).map(([key, label]) => (
                  <label key={key} className="report-issue">
                    <input
                      type="checkbox"
                      checked={selectedProblems.includes(key as Problem)}
                      onChange={(e) => {
                        const problems = e.target.checked
                          ? [...selectedProblems, key as Problem]
                          : selectedProblems.filter((item) => item !== key);
                        update(draftKey, {
                          problems,
                          type: problems[0] ?? "full",
                        });
                      }}
                    />
                    <span>{label}</span>
                    <Icon name="check" />
                  </label>
                ))}
              </div>
            </section>
          )}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="report-submit">
          {!session?.user.roles.includes("citizen") ? (
            <a
              className="button primary"
              href={`#login?next=${encodeURIComponent(wasteHref(quickAdoption ? `quick-report/${quickAdoption.item.id}` : `report/${id}`, wasteType).slice(1))}`}
            >
              登入後繼續回報
            </a>
          ) : (
            <button
              className="button primary"
              disabled={
                busy ||
                validating ||
                analyzing ||
                cooldown.waiting ||
                (!pendingOperation &&
                  (!quickAllowed ||
                    !draft.file ||
                    !draft.demoPhoto ||
                    !selectedProblems.length ||
                    !validPosition ||
                    !view.data?.can_report ||
                    Boolean(view.error)))
              }
            >
              {busy
                ? "送出中…"
                : pendingOperation
                  ? "重試原回報"
                  : "確認送出回報"}
              <Icon name="arrow" />
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

export function PrivatePhoto({
  id,
  alt = "案件現場照片",
}: {
  id: string;
  alt?: string;
}) {
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
          alt={alt}
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
  const { session } = useSession();
  return (
    <section className="card report-summary-card">
      <h2>{problemLabels[report.type]}</h2>
      <WasteTag type={report.waste_type} />
      <WasteInfo value={report} />
      <p>查證狀態：{reportLabels[report.status]}</p>
      <p>
        工單進度：
        {report.work_status ? workLabels[report.work_status] : "尚未派工"}
      </p>
      {report.assignment_status === "unassigned" && (
        <p>
          {isDemoToken(session?.access_token)
            ? ""
            : "此回報尚未指派，超出目前大安區隊員範圍。"}
        </p>
      )}
      <p>
        提交時認養資格：{report.adopter ? "有效認養" : "無認養資格"} ·{" "}
        {report.first_reporter ? "事件首報" : "同事件後續回報"}
        {report.quick ? " · 快捷通報" : ""}
      </p>
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
      <a
        className="back-link"
        href={wasteHref(`bin/${report.bin_id}`, report.waste_type)}
      >
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
  const member = useApi(done && session ? "/me/membership" : null, (signal) =>
    request<Membership>("/me/membership", {
      signal,
      token: session?.access_token,
    }),
  );
  if (done) {
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    const problems = (params.get("problems") || result.data?.type || "")
      .split(",")
      .filter((value): value is Problem => value in problemLabels);
    return (
      <main className="page api-narrow report-success">
        <span className="report-success-check" aria-hidden="true">
          <Icon name="check" />
        </span>
        <h1>謝謝回報！</h1>
        <strong className="report-success-status">審核中</strong>
        <LoadState {...result} />
        {result.data && (
          <section className="report-success-summary">
            <div className="report-success-tags">
              {problems.map((problem) => (
                <span key={problem}>{problemLabels[problem]}</span>
              ))}
            </div>
            <WasteTag type={result.data.waste_type || "general"} />
            <p>清潔隊到場確認符合照片狀況後入帳</p>
          </section>
        )}
        {isDemoToken(session?.access_token) && member.data && result.data && (
          <section className="report-reward-progress">
            <strong>3 點換超商咖啡</strong>
            <progress
              aria-label="超商咖啡兌換進度"
              max={3}
              value={Math.min(3, member.data.available_points)}
            />
            <p>
              {member.data.available_points >= 3
                ? "你的點數已可兌換超商咖啡"
                : `目前 ${member.data.available_points} 點，再 ${3 - member.data.available_points} 點就能換`}
            </p>
          </section>
        )}
        <a className="button primary" href="#map">
          回到地圖
          <Icon name="arrow" />
        </a>
        <a className="button secondary" href="#reports">
          看回報紀錄
        </a>
      </main>
    );
  }
  return (
    <main className={`page api-narrow ${done ? "done-page" : ""}`}>
      {done && (
        <span className="login-mascot" aria-hidden="true">
          <Mascot />
        </span>
      )}
      <h1>{done ? "謝謝你幫城市變乾淨！" : "回報進度"}</h1>
      {done && (
        <p>
          {isDemoToken(session?.access_token)
            ? "已儲存回報，點數待查證後確認。"
            : "清潔隊收到後會到場查證；屬實才會入帳點數。"}
        </p>
      )}
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
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);
  const { session } = useSession();
  const [offset, setOffset] = useState(0);
  const [wasteFilter, setWasteFilter] = useState<WasteType | "">("");
  const path = query("/me/reports", {
    limit: 20,
    offset,
    ...(wasteFilter ? { waste_type: wasteFilter } : {}),
  });
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
      <a className="back-link" href="#member">
        <Icon name="back" />
        返回會員中心
      </a>
      <h1>我的回報</h1>
      <MemberNavigation current="reports" />
      <p>查證結果與處理進度分開顯示，點選案件查看完整紀錄。</p>
      <WasteSelect
        value={wasteFilter}
        all
        onChange={(value) => {
          setWasteFilter(value);
          setOffset(0);
        }}
      />
      <LoadState {...result} />
      {result.data?.items.length === 0 && <p>尚無回報</p>}
      <ul className="api-items">
        {result.data?.items.map((r) => (
          <li className="card" key={r.id}>
            <a href={`#review/${r.id}`}>
              {problemLabels[r.type]} · {reportLabels[r.status]}
            </a>
            <WasteInfo value={r} />
            <p>
              {r.work_status ? workLabels[r.work_status] : "尚未派工"} ·{" "}
              {time(r.created_at)}
            </p>
          </li>
        ))}
      </ul>
      <div className="pager">
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
      </div>
    </main>
  );
}
const memberBadgeTiers = [
  { name: "見習生", points: 0 },
  { name: "新手", points: 10 },
  { name: "獨當一面", points: 50 },
  { name: "高手", points: 150 },
  { name: "專家", points: 500 },
  { name: "教授", points: 1000 },
];
export function Member() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);
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
  return (
    <main className="page member-hub">
      <header className="page-heading">
        <div>
          <span className="eyebrow">把順手的善意，累積成城市的改變</span>
          <h1>會員中心</h1>
        </div>
        <span className="demo-tag">我的城市紀錄</span>
      </header>
      <MemberNavigation current="member" />
      <div className="member-hub-layout">
        <aside className="member-hub-overview">
          <LoadState {...membership} />
          {membership.data && (
            <section className="member-hero" aria-label="會員等級摘要">
              <div className="member-hero-title">
                <span className="member-seal" aria-hidden="true">
                  <Icon name="star" />
                </span>
                <div>
                  <span>目前等級</span>
                  <h2>{membership.data.current_tier.name}</h2>
                </div>
              </div>
              <p>累積點數 {membership.data.cumulative_points}</p>
              {membership.data.next_tier ? (
                <p>
                  再 {membership.data.points_to_next_tier} 點升到「
                  {membership.data.next_tier.name}」
                </p>
              ) : (
                <p>已達最高等級，謝謝你持續照顧城市！</p>
              )}
              <progress
                aria-label="會員升級進度"
                value={
                  membership.data.next_tier
                    ? membership.data.cumulative_points
                    : 1
                }
                max={
                  membership.data.next_tier
                    ? membership.data.cumulative_points +
                      (membership.data.points_to_next_tier ?? 0)
                    : 1
                }
              />
              <div className="member-hero-balance">
                <p>
                  可用點數 <strong>{membership.data.available_points}</strong>
                </p>
                <a className="button primary" href="#rewards">
                  兌換獎品 <Icon name="arrow" />
                </a>
              </div>
              <p>待確認點數 {membership.data.pending_points}</p>
              <p>
                屬實回報 {membership.data.approved_report_count} 次 · 不實{" "}
                {membership.data.rejected_report_count} 次
              </p>
              {membership.data.reporting_suspended && (
                <p role="status">
                  回報資格暫停，合法兌換、提案與投票不因此停權。
                </p>
              )}
            </section>
          )}
          {membership.data && (
            <section
              className="card member-section"
              id="member-levels"
              tabIndex={-1}
              aria-label="集章與等級"
            >
              <div className="section-heading">
                <h2>集章與等級</h2>
                <span className="tiny">依累積點數 · 門檻暫定</span>
              </div>
              <ul className="member-badges" aria-label="會員等級徽章">
                {memberBadgeTiers.map((tier) => (
                  <li
                    key={tier.name}
                    className={
                      tier.name === membership.data!.current_tier.name
                        ? "current"
                        : membership.data!.cumulative_points >= tier.points
                          ? "earned"
                          : "locked"
                    }
                  >
                    <span className="member-badge">{tier.name}</span>
                    <small>
                      {tier.points.toLocaleString()} 點
                      {tier.name === membership.data!.current_tier.name
                        ? " · 目前"
                        : ""}
                    </small>
                  </li>
                ))}
              </ul>
              <p className="tiny">以查證屬實的回報累積點數，解鎖等級徽章。</p>
            </section>
          )}
          <aside className="member-how">
            <h2>怎麼拿點數</h2>
            <p>
              回報經查證屬實，一般首報 +1 點、有效認養首報 +2
              點；同事件後續回報不重複發點。
            </p>
          </aside>
        </aside>
      </div>
    </main>
  );
}

function distanceToBin(
  lat: number,
  lng: number,
  binLat: number,
  binLng: number,
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((lat - binLat) * rad) / 2) ** 2 +
    Math.cos(lat * rad) *
      Math.cos(binLat * rad) *
      Math.sin(((lng - binLng) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
