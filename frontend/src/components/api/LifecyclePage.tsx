import { useState } from "react";
import { request, time, type BinView, type Lifecycle } from "../../data/api";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { useCommand } from "./Commands";
import {
  ConfirmationControls,
  RequireAdmin,
  type Confirmation,
} from "./MutationConfirmation";

export function LifecyclePage({ id }: { id?: string }) {
  const [binId, setBinId] = useState("");
  return (
    <RequireAdmin next={`admin/bins${id ? `/${id}` : ""}`}>
      {id ? (
        <LifecycleDetail key={id} id={id} />
      ) : (
        <main className="page api-narrow">
          <h1>撤除桶管理</h1>
          <p>輸入桶 UUID，讀取最新生命週期後確認撤除。</p>
          <form
            className="card api-form"
            onSubmit={(e) => {
              e.preventDefault();
              window.location.hash = `admin/bins/${encodeURIComponent(binId.trim())}`;
            }}
          >
            <label>
              桶 UUID
              <input
                required
                value={binId}
                onChange={(e) => setBinId(e.target.value)}
                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              />
            </label>
            <button className="button primary">查看桶生命週期</button>
          </form>
          <a className="api-action-link" href="#map">
            由地圖選桶
          </a>
        </main>
      )}
    </RequireAdmin>
  );
}
function LifecycleDetail({ id }: { id: string }) {
  const { session } = useSession();
  const path = `/bins/${id}/lifecycle`;
  const detail = useApi(
    path,
    (signal) =>
      request<Lifecycle>(path, { signal, token: session?.access_token }),
    true,
  );
  const bin = useApi(
    `/bins/${id}/view`,
    (signal) =>
      request<BinView>(`/bins/${id}/view`, {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const item = detail.data;
  const etag = detail.etag || (item ? `"v${item.version}"` : null);
  const action = useCommand<Lifecycle>({
    scope: `lifecycle/${id}`,
    authorized: !!session?.user.roles.includes("admin"),
    ready: !!item && !!etag && !detail.loading && !detail.error,
    etag,
    canRun: () => item?.operational_status !== "removed",
    refresh: () => {
      detail.reload();
      bin.reload();
    },
  });
  return (
    <main className="page api-narrow">
      <h1>撤除桶管理</h1>
      <a className="back-link" href={`#bin/${id}`}>
        返回桶詳情
      </a>
      <LoadState {...detail} />
      <LoadState {...bin} />
      {item && (
        <section className="card api-form">
          <h2>{bin.data?.location.label || "桶生命週期"}</h2>
          <p>桶 UUID：{item.bin_id}</p>
          <p>
            生命週期版本 {item.version} · 設置狀態 {item.placement_status}
          </p>
          <p>
            設置時間：{time(item.installed_at)} · 撤除時間：
            {time(item.removed_at)}
          </p>
          {item.reason && <p>原因：{item.reason}</p>}
          {item.operational_status === "removed" ? (
            <p role="status">已撤除，保留歷史紀錄</p>
          ) : (
            <form
              className="api-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!reason.trim()) return;
                action.cancel();
                setConfirmation({
                  etag,
                  intent: {
                    path: `/admin/bins/${id}/lifecycle`,
                    body: { action: "remove", reason: reason.trim() },
                    label: `撤除此桶：${reason.trim()}`,
                  },
                });
              }}
            >
              <label>
                撤除原因
                <textarea
                  aria-label="撤除原因"
                  required
                  maxLength={500}
                  value={reason}
                  disabled={action.busy || !!action.pending}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={action.blocked || !reason.trim()}
              >
                預覽撤除
              </button>
            </form>
          )}
        </section>
      )}
      <ConfirmationControls
        action={action}
        confirmation={confirmation}
        etag={etag}
        cancel={() => setConfirmation(null)}
        impact="撤除後停止新回報與認養權益，關閉通知偏好；未完成工單會受阻擋，路線排除此桶。既有歷史與已發點數保留。此處不提供復原。"
      />
    </main>
  );
}
