import { isDemoToken } from "../../data/demoMode";
import { Icon } from "../Icon";
import { Mascot } from "../Mascot";
import { AdoptionMonthly } from "./AdoptionMonthly";
import { useState } from "react";
import {
  query,
  allPages,
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
  fullOnly = false,
  compact = false,
}: {
  value: Preferences;
  onChange: (value: Preferences) => void;
  fullOnly?: boolean;
  compact?: boolean;
}) {
  return (
    <fieldset className={compact ? "binu-notifications" : undefined}>
      <legend>
        {compact
          ? "BinU 通知"
          : fullOnly
            ? "BinU 通知我（可隨時關閉）"
            : "通知偏好"}
      </legend>
      {preferenceFields
        .filter(({ key }) => !fullOnly || key === "full")
        .map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(e) =>
                onChange({
                  ...(fullOnly
                    ? { full: false, dumping: false, dirty: false }
                    : value),
                  [key]: e.target.checked,
                })
              }
            />
            {fullOnly ? "吃飽了（80% 以上）" : label}
          </label>
        ))}
      {fullOnly && !compact && (
        <p className="tiny">只在吃飽了時通知，不會一直吵你。</p>
      )}
    </fieldset>
  );
}
function AdoptionSummary({ item }: { item: Adoption }) {
  const { session } = useSession();
  const demo = isDemoToken(session?.access_token);
  return (
    <>
      <h2>{item.private_bin_name || item.display_name}</h2>
      {item.private_bin_name && <p>私人桶名 · 只有你看得到</p>}
      <p>認養狀態：{states[item.status]}</p>
      {!demo && <p>身份：{item.role}</p>}
      {item.intro && <p>店家介紹：{item.intro}</p>}
      {demo ? (
        <p>
          目前通知：吃飽了（80% 以上）{item.preferences.full ? "開啟" : "關閉"}
        </p>
      ) : (
        <p>
          目前通知：滿桶 {item.preferences.full ? "開啟" : "關閉"}、堆放{" "}
          {item.preferences.dumping ? "開啟" : "關閉"}、髒污{" "}
          {item.preferences.dirty ? "開啟" : "關閉"}
        </p>
      )}
      <p>
        申請：{time(item.created_at)} · 更新：{time(item.updated_at)}
      </p>
      {item.reason && <p>原因：{item.reason}</p>}
      <a className="api-action-link" href={`#bin/${item.bin_id}`}>
        查看 BinU
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
          ? ""
          : "認養待審期間沒有權益，歷史紀錄由後端保留。"}
      </p>
      {!admin && (
        <p>每位認領者都可各自命名，桶名只有自己看得到；每人至多認領 5 個桶。</p>
      )}
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
  const demo = isDemoToken(session?.access_token);
  const owned = useApi(
    demo ? "/me/adoptions?claim-limit" : null,
    async (signal) => ({
      data: await allPages<Adoption>("/me/adoptions", {
        signal,
        token: session?.access_token,
      }),
      etag: null,
      replayed: false,
    }),
    true,
  );
  const count =
    owned.data?.filter((item) => ["pending", "active"].includes(item.status))
      .length || 0;
  const atLimit = demo && count >= 5;
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
    full: !demo,
    dumping: !demo,
    dirty: !demo,
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
      (!demo || (!!owned.data && !owned.error && !atLimit)) &&
      !applied,
    reconfirm: false,
    refresh: view.reload,
    onSuccess: (result) => setApplied(result.data as Adoption),
  });
  return (
    <main className={`page api-narrow${demo ? " binu-adoption-page" : ""}`}>
      {demo ? (
        <>
          <header className="compact-page-head binu-adoption-heading">
            <a
              className="back-link"
              href={`#bin/${binId}`}
              aria-label="返回桶詳情"
            >
              <Icon name="back" />
            </a>
            <div>
              <h1>認領 BinU</h1>
              {view.data && <p>{view.data.location.label}</p>}
            </div>
          </header>
          <section className="binu-adoption-hero" aria-label="等你認領的 BinU">
            <div role="img" aria-label="等你認領的 BinU 吉祥物">
              <Mascot />
            </div>
            <div>
              <h2>認領這隻 BinU</h2>
              {view.data && <p>{view.data.location.label}</p>}
            </div>
          </section>
          <aside className="binu-adoption-bonus">
            <strong>×2</strong>
            <div>
              <h2>認領後回報點數加倍</h2>
              <p>查證屬實的首報可獲得 +2 點</p>
            </div>
          </aside>
          <LoadState {...owned} />
          {atLimit && (
            <p role="status">已認領 {count} / 5 個桶，請先結束現有認領。</p>
          )}
        </>
      ) : (
        <h1>申請認養</h1>
      )}
      <LoadState {...view} />
      {view.data && (
        <>
          {!demo && <h2>{view.data.location.label}</h2>}
          {!demo && (
            <p>公開認養：{view.data.adopter?.display_name || "尚無認養者"}</p>
          )}
          {!demo && (
            <a className="back-link" href={`#bin/${binId}`}>
              返回桶詳情
            </a>
          )}
        </>
      )}
      {applied ? (
        <section className="card" role="status">
          <p>
            {demo
              ? `已認領「${applied.private_bin_name}」，桶名只有你看得到。`
              : "申請已送出，待審期間尚無認養權益。"}
          </p>
          <a className="api-action-link" href={`#adopt/${applied.id}`}>
            查看我的認養
          </a>
        </section>
      ) : view.data?.can_apply_adoption && !atLimit ? (
        <form
          className={`card api-form${demo ? " binu-adoption-form" : ""}`}
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
                  display_name: demo ? session?.user.display_name : name.trim(),
                  ...(demo ? { private_bin_name: name.trim() } : {}),
                  intro: role === "店家" ? intro.trim() : "",
                  preferences,
                },
                label: `以${role}「${name.trim()}」申請認養${view.data?.location.label}`,
              },
            });
          }}
        >
          <fieldset disabled={action.busy || !!action.pending}>
            <legend className={demo ? "visually-hidden" : undefined}>
              認養申請資料
            </legend>
            {!demo && (
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
            )}
            <label>
              {demo ? "幫 BinU 取名" : "公開名稱"}
              <input
                aria-label={demo ? "BinU的私人桶名" : "公開名稱"}
                required
                maxLength={50}
                placeholder={demo ? "例如：下班等公車桶" : undefined}
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
            {!demo && (
              <PreferenceInputs value={preferences} onChange={setPreferences} />
            )}
          </fieldset>
          <button className="button primary" disabled={action.blocked}>
            {demo ? "預覽認領" : "預覽認養申請"}
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
            ? "私人桶名不會公開。每人至多認領 5 個桶。"
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
          {bin.data && !isDemoToken(session?.access_token) && (
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
          {!admin &&
            isDemoToken(session?.access_token) &&
            item.status === "active" && (
              <PrivateNameEditor
                key={`name/${id}/${item.version}`}
                item={item}
                disabled={action.blocked}
                submit={(private_bin_name) =>
                  queue(
                    "private-name",
                    { private_bin_name },
                    "更新私人桶名（只有自己看得到）",
                    "PATCH",
                  )
                }
              />
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
  const { session } = useSession();
  const demo = isDemoToken(session?.access_token);
  const [value, setValue] = useState(
    demo
      ? { full: item.preferences.full, dumping: false, dirty: false }
      : item.preferences,
  );
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
        <PreferenceInputs value={value} onChange={setValue} fullOnly={demo} />
      </fieldset>
      <button className="button primary" disabled={disabled}>
        預覽更新偏好
      </button>
    </form>
  );
}

function PrivateNameEditor({
  item,
  disabled,
  submit,
}: {
  item: Adoption;
  disabled: boolean;
  submit: (name: string) => void;
}) {
  const [name, setName] = useState(item.private_bin_name || "");
  return (
    <form
      className="card api-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(name.trim());
      }}
    >
      <label>
        BinU的私人桶名
        <input
          required
          maxLength={50}
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p>只有你看得到，可隨時更名；不影響其他認領者的桶名。</p>
      <button className="button primary" disabled={disabled || !name.trim()}>
        預覽更名
      </button>
    </form>
  );
}
