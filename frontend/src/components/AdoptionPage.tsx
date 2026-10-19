import { useDemoStore } from "../data/demoStore";
import { useEffect, useRef, useState } from "react";
import { locations } from "../data/locations";
import { binDemo, stateLabels } from "../data/binDemo";
import {
  adoptionStatusLabels,
  canApply,
  type Adoption,
  type ParticipationAction,
  type ParticipationState,
} from "../data/participation";
import { Mascot } from "./Mascot";
import { NotificationFields } from "./AdoptionForm";

// Active first, then pending, then closed records; newest first within each group.
const statusOrder = (status: Adoption["status"]) =>
  status === "active" ? 0 : status === "pending" ? 1 : 2;
const statusPill: Record<Adoption["status"], string> = {
  active: "status-pill",
  pending: "status-pill half",
  rejected: "status-pill unknown",
  withdrawn: "status-pill unknown",
  ended: "status-pill unknown",
};

function successMessage(action: ParticipationAction) {
  if (action.type === "notifications") return "通知設定已更新（站內示意）。";
  if (action.type === "remove-bin")
    return "已將此桶標為移除（示範），認養已結束。";
  if (action.type === "adoption-status")
    return {
      active: "已核准（示範）。",
      rejected: "已標為未通過（示範）。",
      withdrawn: "已撤回申請。",
      ended: "已結束認養。",
      pending: "已更新。",
    }[action.status];
  return "已更新。";
}

export function AdoptionPage({
  state,
  loggedIn,
  act,
}: {
  state: ParticipationState;
  loggedIn: boolean;
  act: (
    action: ParticipationAction,
    loggedIn: boolean,
  ) => Promise<string | null>;
}) {
  const { state: operations } = useDemoStore();
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
    setFeedback(error || successMessage(action));
    return !error;
  }
  const records = state.adoptions
    .map((adoption, index) => ({ adoption, index }))
    .sort(
      (a, b) =>
        statusOrder(a.adoption.status) - statusOrder(b.adoption.status) ||
        b.index - a.index,
    )
    .map(({ adoption }) => adoption);
  return (
    <main className="page participation-page adoption-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CARE, CLOSE TO HOME.</span>
          <h1>我的認養</h1>
          <p>你申請與認養中的桶都在這裡。</p>
        </div>
        <span className="demo-tag">認養、審批、通知與月報均為示範</span>
      </div>
      {feedback && (
        <p className="participation-feedback" role="status">
          {feedback}
        </p>
      )}
      {!records.length ? (
        <section className="card adoption-empty" aria-label="還沒有認養">
          <Mascot />
          <div>
            <h2>還沒有認養的桶</h2>
            <p>
              認養是幫附近一個公布桶多看一眼：路過時留意桶況，有問題用快捷回報，不必自己清運。核准後可設定桶況通知、屬實首報
              +2 點；待審期間沒有認養權益，隨時可撤回。
            </p>
            <a className="button primary" href="#map">
              到地圖挑一個桶
            </a>
            <p className="tiny">示範版以大安森林公園為起點，不讀取你的位置</p>
          </div>
        </section>
      ) : (
        <section className="adoption-history" aria-label="我的認養紀錄">
          <h2>申請與認養紀錄</h2>
          {!loggedIn && (
            <p className="muted">
              目前未登入，紀錄僅供檢視；
              <a href={`#login?next=${encodeURIComponent("adopt")}`}>登入後</a>
              才能撤回、結束或修改通知。
            </p>
          )}
          {records.map((a) => {
            const bin = locations.find((p) => p.id === a.locationId)!;
            return (
              <article
                className="card adoption-record"
                key={a.id}
                aria-label={`認養申請：${bin.label}`}
              >
                <div className="section-heading">
                  <h3>{bin.label}</h3>
                  <span className={statusPill[a.status]}>
                    {adoptionStatusLabels[a.status]}
                  </span>
                </div>
                <p>
                  認養名稱：{a.displayName} · {a.role}
                </p>
                {a.intro && <p>{a.intro}</p>}
                {a.reason &&
                  ["rejected", "withdrawn", "ended"].includes(a.status) && (
                    <p>結果原因：{a.reason}</p>
                  )}
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
                      <a
                        className="button secondary"
                        href={`#bin/${bin.id}?adopt=1`}
                      >
                        重新填寫申請
                      </a>
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
                    <h4>電子雞月報 · 示意數據</h4>
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
      )}
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
