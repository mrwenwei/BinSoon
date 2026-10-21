import { isDemoToken } from "../../data/demoMode";
import { AdoptionMonthly } from "./AdoptionMonthly";
import { useState } from "react";
import {
  query,
  request,
  time,
  type Adoption,
  type AdoptionRole,
  type BinView,
  type PageData,
  type Preferences,
} from "../../data/api";
import { districts } from "../../data/locations";
import { useSession } from "./SessionContext";
import { RequireCitizen } from "./ReportPages";
import { useApi } from "./useApi";
import { useCommand, type Intent } from "./Commands";
import { LoadState } from "./LoadState";
import { Pagination } from "./Pagination";
import {
  ConfirmationControls,
  RequireAdmin,
  type Confirmation,
} from "./MutationConfirmation";
const states: Record<Adoption["status"], string> = {
  pending: "待審核",
  active: "認養中",
  rejected: "已拒絕",
  withdrawn: "已撤回",
  ended: "已結束",
};
const preferenceFields = [
  { key: "full", label: "滿桶通知" },
  { key: "dumping", label: "桶旁堆放通知" },
  { key: "dirty", label: "髒污通知" },
] as const;
function PreferenceInputs({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (value: Preferences) => void;
}) {
  return (
    <fieldset>
      <legend>通知偏好</legend>
      {preferenceFields.map(({ key, label }) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
function AdoptionSummary({ item }: { item: Adoption }) {
  return (
    <>
      <h2>{item.display_name}</h2>
      <p>認養狀態：{states[item.status]}</p>
      <p>身份：{item.role}</p>
      {item.intro && <p>店家介紹：{item.intro}</p>}
      <p>
        目前通知：滿桶 {item.preferences.full ? "開啟" : "關閉"}、堆放{" "}
        {item.preferences.dumping ? "開啟" : "關閉"}、髒污{" "}
        {item.preferences.dirty ? "開啟" : "關閉"}
      </p>
      <p>
        申請：{time(item.created_at)} · 更新：{time(item.updated_at)}
      </p>
      {item.reason && <p>原因：{item.reason}</p>}
      <a className="api-action-link" href={`#bin/${item.bin_id}`}>
        查看關聯桶與公開認養
      </a>
    </>
  );
}
export function Adoptions({
  id,
  admin = false,
}: {
  id?: string;
  admin?: boolean;
}) {
  const next = `${admin ? "admin/adoptions" : "adopt"}${id ? `/${id}` : ""}`;
  const content = id ? (
    <AdoptionDetail key={id} id={id} admin={admin} />
  ) : (
    <AdoptionList admin={admin} />
  );
  return admin ? (
    <RequireAdmin next={next}>{content}</RequireAdmin>
  ) : (
    <RequireCitizen next={next}>{content}</RequireCitizen>
  );
}
function AdoptionList({ admin }: { admin: boolean }) {
  const { session } = useSession();
  const [status, setStatus] = useState(admin ? "pending" : "");
  const [district, setDistrict] = useState("");
  const [offset, setOffset] = useState(0);
  const path = query(admin ? "/admin/adoptions" : "/me/adoptions", {
    offset,
    limit: 20,
    ...(status ? { status } : {}),
    ...(admin && district ? { district } : {}),
  });
  const list = useApi(
    path,
    (signal) =>
      request<PageData<Adoption>>(path, {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  return (
    <main className="page api-narrow">
      <h1>{admin ? "認養審核列表" : "我的認養"}</h1>
      <p>
        {isDemoToken(session?.access_token)
          ? "認養與歷史紀錄僅保存在此瀏覽器，展示狀態不代表真實認養權益。"
          : "認養待審期間沒有權益，歷史紀錄由後端保留。"}
      </p>
      {!admin && (
        <a className="button primary" href="#map">
          前往地圖選桶申請
        </a>
      )}
      <div className="card api-form">
        <label>
          認養狀態
          <select
            aria-label="認養狀態"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">全部</option>
            {Object.entries(states).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {admin && (
          <label>
            行政區
            <select
              aria-label="行政區"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">全部行政區</option>
              {districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <LoadState {...list} />
      <ul className="api-items">
        {list.data?.items.map((item) => (
          <li className="card" key={item.id}>
            <AdoptionSummary item={item} />
            <a href={`#${admin ? "admin/adoptions" : "adopt"}/${item.id}`}>
              {admin ? "審核此認養" : "管理此認養"}
            </a>
          </li>
        ))}
      </ul>
      {list.data?.items.length === 0 && <p>尚無認養紀錄</p>}
      <Pagination page={list.data?.page} onChange={setOffset} />
    </main>
  );
}
export function AdoptionApply({ binId }: { binId: string }) {
  return (
    <RequireCitizen next={`adopt/apply/${binId}`}>
      <Application key={binId} binId={binId} />
    </RequireCitizen>
  );
}
function Application({ binId }: { binId: string }) {
  const { session } = useSession();
  const path = `/bins/${binId}/view`;
  const view = useApi(
    path,
    (signal) =>
      request<BinView>(path, { signal, token: session?.access_token }),
    true,
  );
  const [role, setRole] = useState<AdoptionRole>("居民");
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [preferences, setPreferences] = useState<Preferences>({
    full: true,
    dumping: true,
    dirty: true,
  });
  const [applied, setApplied] = useState<Adoption | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const action = useCommand<Adoption>({
    scope: `adoption-apply/${binId}`,
    authorized: !!session?.user.roles.includes("citizen"),
    ready:
      !!view.data?.can_apply_adoption &&
      !view.loading &&
      !view.error &&
      !!name.trim() &&
      !applied,
    reconfirm: false,
    refresh: view.reload,
    onSuccess: (result) => setApplied(result.data as Adoption),
  });
  return (
    <main className="page api-narrow">
      <h1>申請認養</h1>
      <LoadState {...view} />
      {view.data && (
        <>
          <h2>{view.data.location.label}</h2>
          <p>公開認養：{view.data.adopter?.display_name || "尚無認養者"}</p>
          <a className="back-link" href={`#bin/${binId}`}>
            返回桶詳情
          </a>
        </>
      )}
      {applied ? (
        <section className="card" role="status">
          <p>申請已送出，待審期間尚無認養權益。</p>
          <a className="api-action-link" href={`#adopt/${applied.id}`}>
            查看我的認養
          </a>
        </section>
      ) : view.data?.can_apply_adoption ? (
        <form
          className="card api-form"
          onSubmit={(e) => {
            e.preventDefault();
            action.cancel();
            setConfirmation({
              etag: null,
              intent: {
                path: "/adoptions",
                body: {
                  bin_id: binId,
                  role,
                  display_name: name.trim(),
                  intro: role === "店家" ? intro.trim() : "",
                  preferences,
                },
                label: `以${role}「${name.trim()}」申請認養${view.data?.location.label}`,
              },
            });
          }}
        >
          <fieldset disabled={action.busy || !!action.pending}>
            <legend>認養申請資料</legend>
            <label>
              認養身份
              <select
                aria-label="認養身份"
                value={role}
                onChange={(e) => setRole(e.target.value as AdoptionRole)}
              >
                {(["居民", "店家", "學校", "社區團體"] as const).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              公開名稱
              <input
                required
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {role === "店家" && (
              <label>
                店家介紹
                <textarea
                  aria-label="店家介紹"
                  maxLength={120}
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                />
              </label>
            )}
            <PreferenceInputs value={preferences} onChange={setPreferences} />
          </fieldset>
          <button className="button primary" disabled={action.blocked}>
            預覽認養申請
          </button>
        </form>
      ) : (
        view.data && <p>目前無法申請此桶，請依目前認養與設置狀態選擇其他桶。</p>
      )}
      {view.data?.my_adoption_id && !applied && (
        <a
          className="api-action-link"
          href={`#adopt/${view.data.my_adoption_id}`}
        >
          查看既有認養申請
        </a>
      )}
      <ConfirmationControls
        action={action}
        confirmation={confirmation}
        etag={null}
        cancel={() => setConfirmation(null)}
        impact={
          isDemoToken(session?.access_token)
            ? "只建立本機待審展示申請，不會送交真實管理員或取得真實認養權益；預設展示認養可用來體驗快捷通報。"
            : "送出後為 pending，尚無加倍資格；須管理員核准，且不能保證一定取得認養。"
        }
      />
    </main>
  );
}
function AdoptionDetail({ id, admin }: { id: string; admin: boolean }) {
  const { session } = useSession();
  const path = `/adoptions/${id}`;
  const detail = useApi(
    path,
    (signal) =>
      request<Adoption>(path, { signal, token: session?.access_token }),
    true,
  );
  const item = detail.data;
  const binPath = item ? `/bins/${item.bin_id}/view` : null;
  const bin = useApi(
    binPath,
    (signal) =>
      request<BinView>(binPath!, { signal, token: session?.access_token }),
    true,
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reason, setReason] = useState("");
  const etag = detail.etag || (item ? `"v${item.version}"` : null);
  const canRun = (intent: Intent) => {
    if (!item) return false;
    if (admin)
      return (
        item.status === "pending" &&
        ((intent.body as { decision: string }).decision !== "active" ||
          (!bin.loading && !bin.error && !!bin.data && !bin.data.adopter))
      );
    return intent.path.endsWith("/withdraw")
      ? item.status === "pending"
      : item.status === "active";
  };
  const action = useCommand<Adoption>({
    scope: `adoption/${id}/${admin ? "review" : "owner"}`,
    authorized: !!session?.user.roles.includes(admin ? "admin" : "citizen"),
    ready: !!item && !detail.loading && !detail.error && !!etag,
    etag,
    canRun,
    refresh: () => {
      detail.reload();
      bin.reload();
    },
  });
  const queue = (
    suffix: string,
    body: unknown,
    label: string,
    method: "POST" | "PATCH" = "POST",
  ) => {
    action.cancel();
    setConfirmation({
      etag,
      intent: {
        path: `${admin ? "/admin" : ""}/adoptions/${id}/${suffix}`,
        body,
        label,
        method,
      },
    });
  };
  return (
    <main className="page api-narrow">
      <h1>{admin ? "審核認養" : "認養詳情"}</h1>
      <a className="back-link" href={admin ? "#admin/adoptions" : "#adopt"}>
        返回認養列表
      </a>
      <LoadState {...detail} />
      {item && (
        <>
          <section className="card">
            <AdoptionSummary item={item} />
            <p>版本 {item.version}</p>
            {item.status === "pending" && <p>待審期間尚無認養權益。</p>}
          </section>
          <LoadState {...bin} />
          {bin.data && (
            <p>
              目前公開認養：{bin.data.adopter?.display_name || "尚無認養者"}
            </p>
          )}
          {admin && item.status === "pending" && (
            <section className="card api-form">
              <label>
                認養審查原因
                <textarea
                  aria-label="認養審查原因"
                  maxLength={500}
                  value={reason}
                  disabled={action.busy || !!action.pending}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={
                  action.blocked ||
                  bin.loading ||
                  !!bin.error ||
                  !bin.data ||
                  !!bin.data.adopter
                }
                onClick={() =>
                  queue(
                    "review",
                    { decision: "active", reason: reason.trim() || null },
                    "核准認養",
                  )
                }
              >
                核准認養
              </button>
              <button
                className="button secondary"
                disabled={action.blocked || !reason.trim()}
                onClick={() =>
                  queue(
                    "review",
                    { decision: "rejected", reason: reason.trim() },
                    `拒絕認養：${reason.trim()}`,
                  )
                }
              >
                拒絕認養
              </button>
            </section>
          )}
          {!admin && item.status === "active" && (
            <PreferenceEditor
              key={`${id}/${item.version}`}
              item={item}
              disabled={action.blocked}
              submit={(value) =>
                queue(
                  "preferences",
                  value,
                  `更新通知偏好：滿桶${value.full ? "開啟" : "關閉"}、堆放${value.dumping ? "開啟" : "關閉"}、髒污${value.dirty ? "開啟" : "關閉"}`,
                  "PATCH",
                )
              }
            />
          )}
          {!admin && item.status === "pending" && (
            <button
              className="button secondary"
              disabled={action.blocked}
              onClick={() => queue("withdraw", {}, "撤回待審認養")}
            >
              撤回申請
            </button>
          )}
          {!admin && item.status === "active" && (
            <section className="card api-form">
              <label>
                結束原因
                <textarea
                  aria-label="結束原因"
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={action.busy || !!action.pending}
                />
              </label>
              <button
                className="button secondary"
                disabled={action.blocked}
                onClick={() =>
                  queue("end", { reason: reason.trim() || null }, "結束認養")
                }
              >
                結束認養
              </button>
            </section>
          )}
        </>
      )}
      {!admin && item && (
        <>
          <AdoptionMonthly id={id} />
          {item.status === "active" && !detail.error && (
            <a className="button primary" href={`#quick-report/${id}`}>
              認養快捷通報
            </a>
          )}
        </>
      )}
      <ConfirmationControls
        action={action}
        confirmation={confirmation}
        etag={etag}
        cancel={() => setConfirmation(null)}
        impact={
          confirmation?.intent.path.endsWith("/end") ||
          action.conflict?.intent.path.endsWith("/end")
            ? "結束後關閉通知偏好，新回報不再具有本次認養加倍資格；歷史保留。"
            : "確認後會依最新版本更新認養資料；偏好可全部關閉。撤回後沒有認養權益，歷史仍保留。"
        }
      />
    </main>
  );
}
function PreferenceEditor({
  item,
  disabled,
  submit,
}: {
  item: Adoption;
  disabled: boolean;
  submit: (value: Preferences) => void;
}) {
  const [value, setValue] = useState(item.preferences);
  return (
    <form
      className="card api-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <fieldset disabled={disabled}>
        <legend>更新通知偏好</legend>
        <PreferenceInputs value={value} onChange={setValue} />
      </fieldset>
      <button className="button primary" disabled={disabled}>
        預覽更新偏好
      </button>
    </form>
  );
}
