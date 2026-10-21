import { useDemoStore } from "../data/demoStore";
import { useEffect, useRef, useState } from "react";
import { locations } from "../data/locations";
import { binDemo, stateLabels } from "../data/binDemo";
import {
  adoptionStatusLabels,
  canApply,
  defaultNotifications,
  notificationLabels,
  type Adoption,
  type NotificationPreferences,
  type ParticipationAction,
  type ParticipationState,
} from "../data/participation";
import { Mascot } from "./Mascot";

export function AdoptionPage({
  state,
  loggedIn,
  act,
  id,
}: {
  state: ParticipationState;
  loggedIn: boolean;
  id?: string;
  act: (
    action: ParticipationAction,
    loggedIn: boolean,
  ) => Promise<string | null>;
}) {
  const { state: operations } = useDemoStore();
  const eligible = locations.filter(
    (p) => p.kind === "bin" && p.district === "大安區" && canApply(state, p.id),
  );
  const [binId, setBinId] = useState(id || eligible[0]?.id || "");
  const [role, setRole] = useState<Adoption["role"]>("居民");
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [preferences, setPreferences] = useState(defaultNotifications);
  const [feedback, setFeedback] = useState("");
  const [confirmation, setConfirmation] = useState<{
    id: string;
    status: "withdrawn" | "ended";
  } | null>(null);
  const [reason, setReason] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmation && !dialog.current?.open) dialog.current?.showModal();
  }, [confirmation]);
  async function perform(action: ParticipationAction) {
    const error = await act(action, loggedIn);
    setFeedback(error || "本機認養紀錄已更新；未傳送區清潔隊。");
    return !error;
  }
  const selected = locations.find((p) => p.kind === "bin" && p.id === binId);
  return (
    <main className="page participation-page adoption-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CARE, CLOSE TO HOME.</span>
          <h1>我的Bin友</h1>
          <p>認養家門口的小夥伴，讓順手成為日常。</p>
        </div>
        <span className="demo-tag">認養、審批、通知與月報均為示範</span>
      </div>
      <nav className="action-row" aria-label="市民參與選單">
        <a className="button secondary" href="#vote">
          要桶投票
        </a>
        <a className="button secondary" href="#vote-progress">
          我的投票進度
        </a>
        <a className="button secondary" href="#member">
          會員中心
        </a>
      </nav>
      {feedback && (
        <p className="participation-feedback" role="status">
          {feedback}
        </p>
      )}
      <div className="participation-grid">
        <section className="card adoption-intro">
          <Mascot />
          <h2>一起照顧，不必自己清運</h2>
          <p>
            居民、店家、學校、社區團體都能申請；核准後可設定桶況通知，屬實首報
            +2 點。
          </p>
          <p>清運仍由清潔隊負責，同事件只有第一位回報者得點。</p>
          <p className="tiny">
            本次只操作本機示範帳號，不是正式認養合約；不會真的通知清潔隊。
          </p>
        </section>
        <section className="card" aria-label="認養申請表">
          <h2>認養這隻Bin友</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await perform({
                  type: "apply",
                  id: crypto.randomUUID(),
                  locationId: binId,
                  role,
                  displayName: name,
                  intro,
                  preferences,
                })
              ) {
                setName("");
                setIntro("");
              }
            }}
          >
            <label>
              要認養的桶
              <select value={binId} onChange={(e) => setBinId(e.target.value)}>
                <option value="">請挑選既有桶</option>
                {selected && !eligible.some((p) => p.id === selected.id) && (
                  <option value={selected.id}>
                    {selected.label}（目前無法申請）
                  </option>
                )}
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} · {binDemo(p).code}
                  </option>
                ))}
              </select>
            </label>
            {selected && <a href={`#bin/${selected.id}`}>查看申請桶的詳情</a>}
            <label>
              認養身分
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Adoption["role"])}
              >
                {(["居民", "店家", "學校", "社區團體"] as const).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              認養者公開名稱
              <input
                required
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="顯示在地圖與桶詳情的名字"
              />
            </label>
            {role === "店家" && (
              <label>
                店家介紹（選填）
                <textarea
                  maxLength={120}
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                />
              </label>
            )}
            <NotificationFields value={preferences} onChange={setPreferences} />
            <button
              className="button primary"
              disabled={!loggedIn || !canApply(state, binId) || !name.trim()}
            >
              送出認養申請
            </button>
            {!loggedIn && (
              <a
                href={`#login?next=${encodeURIComponent(`adopt${id ? `/${id}` : ""}`)}`}
              >
                登入後申請認養
              </a>
            )}
            <p className="tiny">
              由區清潔隊核准的流程以展示控制模擬，不承諾3個工作天。待審尚無認養權益。
            </p>
          </form>
        </section>
      </div>
      <section className="adoption-history" aria-label="我的認養紀錄">
        <h2>申請與認養紀錄</h2>
        {!state.adoptions.length && (
          <p className="muted">還沒有認養紀錄。先挑選一隻既有Bin友吧。</p>
        )}
        {[...state.adoptions].reverse().map((a) => {
          const bin = locations.find((p) => p.id === a.locationId)!;
          return (
            <article
              className="card adoption-record"
              key={a.id}
              aria-label={`認養申請：${bin.label}`}
            >
              <div className="section-heading">
                <h3>{bin.label}</h3>
                <span className="status-pill neutral">
                  {adoptionStatusLabels[a.status]}
                </span>
              </div>
              <p>
                認養名稱：{a.displayName} · {a.role}
              </p>
              {a.intro && <p>{a.intro}</p>}
              {a.reason && <p>結果原因：{a.reason}</p>}
              <div className="action-row">
                <a className="button secondary" href={`#bin/${bin.id}`}>
                  查看這個桶
                </a>
                {a.status === "pending" && (
                  <button
                    className="button secondary"
                    disabled={!loggedIn}
                    onClick={() =>
                      setConfirmation({ id: a.id, status: "withdrawn" })
                    }
                  >
                    撤回申請
                  </button>
                )}
                {a.status === "active" && (
                  <>
                    <a
                      className="button primary"
                      href={`#quick-report/${bin.id}`}
                    >
                      一鍵通報附近清潔隊
                    </a>
                    <button
                      className="button secondary"
                      disabled={!loggedIn}
                      onClick={() =>
                        setConfirmation({ id: a.id, status: "ended" })
                      }
                    >
                      結束認養
                    </button>
                  </>
                )}
                {["withdrawn", "rejected", "ended"].includes(a.status) &&
                  canApply(state, bin.id) && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setBinId(bin.id);
                        setName(a.displayName);
                        document
                          .querySelector('[aria-label="認養申請表"]')
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      重新填寫申請
                    </button>
                  )}
              </div>
              {a.status === "active" && (
                <>
                  <NotificationFields
                    value={a.preferences}
                    disabled={!loggedIn}
                    onChange={(value, changed) =>
                      perform({
                        type: "notifications",
                        id: a.id,
                        preferences: value,
                        changed,
                      })
                    }
                  />
                  <div className="demo-notification" role="status">
                    {Object.values(a.preferences).some(Boolean)
                      ? "桶況通知已啟用（站內示意，未連接推播）。"
                      : "你已關閉全部桶況通知。"}
                  </div>
                  <h4>Bin友月報 · 示意數據</h4>
                  <div className="monthly-stats">
                    <span>
                      <strong>1,240</strong>被餵次數
                    </span>
                    <span>
                      <strong>18</strong>清運次數
                    </span>
                    <span>
                      <strong>1</strong>被堆放次數
                    </span>
                  </div>
                  <p className="tiny">
                    現在
                    {
                      stateLabels[
                        binDemo(bin, state.removedBinIds, operations).state
                      ]
                    }
                    ；月報為固定展示，不取自感測器或投入紀錄。
                  </p>
                </>
              )}
              {a.status === "pending" && (
                <details className="demo-controls">
                  <summary>展示控制：認養審批</summary>
                  <p>只改本機示範，未提交區清潔隊。</p>
                  <button
                    className="button secondary"
                    disabled={!loggedIn}
                    onClick={() =>
                      perform({
                        type: "adoption-status",
                        id: a.id,
                        status: "active",
                        reason: "核准認養（示範）",
                      })
                    }
                  >
                    核准認養
                  </button>
                  <label>
                    認養未通過原因
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                    />
                  </label>
                  <button
                    className="button secondary"
                    disabled={!loggedIn || !reason.trim()}
                    onClick={() =>
                      perform({
                        type: "adoption-status",
                        id: a.id,
                        status: "rejected",
                        reason,
                      })
                    }
                  >
                    不核准認養
                  </button>
                </details>
              )}
              {a.status === "active" && (
                <details className="demo-controls">
                  <summary>展示控制：桶移除</summary>
                  <p>
                    將此桶標為本機示範已移除，終止認養與新回報資格，原始資料不變。
                  </p>
                  <button
                    className="button secondary"
                    disabled={!loggedIn}
                    onClick={() =>
                      perform({ type: "remove-bin", locationId: bin.id })
                    }
                  >
                    移除此桶（示範）
                  </button>
                </details>
              )}
            </article>
          );
        })}
      </section>
      {confirmation && (
        <dialog
          ref={dialog}
          className="card participation-dialog"
          aria-label="確認認養變更"
          onCancel={() => setConfirmation(null)}
        >
          <h2>
            {confirmation.status === "ended" ? "結束認養？" : "撤回申請？"}
          </h2>
          <p>
            歷史會保留；停止通知與之後的新回報加倍。已送出的案件仍按送出資格計算，重新申請需重新核准。
          </p>
          <div className="action-row">
            <button
              className="button secondary"
              onClick={() => setConfirmation(null)}
            >
              再想一下
            </button>
            <button
              className="button primary"
              onClick={async () => {
                if (
                  await perform({
                    type: "adoption-status",
                    id: confirmation.id,
                    status: confirmation.status,
                    reason:
                      confirmation.status === "ended"
                        ? "本人結束認養"
                        : "本人撤回申請",
                  })
                )
                  setConfirmation(null);
              }}
            >
              {confirmation.status === "ended"
                ? "確認結束認養"
                : "確認撤回申請"}
            </button>
          </div>
        </dialog>
      )}
    </main>
  );
}

function NotificationFields({
  value,
  onChange,
  disabled = false,
}: {
  value: NotificationPreferences;
  onChange: (
    value: NotificationPreferences,
    changed: keyof NotificationPreferences,
  ) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <fieldset className="notification-fields">
      <legend>桶況通知（可全部關閉）</legend>
      {(
        Object.keys(notificationLabels) as (keyof NotificationPreferences)[]
      ).map((key) => (
        <label className="checkbox-field" key={key}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={draft[key]}
            onChange={(e) => {
              const next = { ...draft, [key]: e.target.checked };
              setDraft(next);
              onChange(next, key);
            }}
          />
          {notificationLabels[key]}
        </label>
      ))}
    </fieldset>
  );
}
