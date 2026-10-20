import { useState } from "react";
import {
  query,
  request,
  time,
  type Notification,
  type PageData,
  type Role,
} from "../../data/api";
import { wasteHref } from "../../data/waste";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { Pagination } from "./Pagination";
import { CommandFeedback, useCommand } from "./Commands";

function destination(item: Notification, role?: Role) {
  switch (item.target.kind) {
    case "report":
      return item.waste_type
        ? wasteHref(`review/${item.target.id}`, item.waste_type)
        : `#review/${item.target.id}`;
    case "work_order":
      return `#staff/tasks/${item.target.id}`;
    case "proposal":
      return `#proposals/${item.target.id}`;
    case "adoption":
      return role === "admin"
        ? `#admin/adoptions/${item.target.id}`
        : `#adopt/${item.target.id}`;
    default:
      return undefined;
  }
}
export function Notifications({ role }: { role?: Role }) {
  const { session } = useSession();
  const next =
    role && role !== "citizen" ? `${role}/notifications` : "notifications";
  if (!session || (role && !session.user.roles.includes(role)))
    return (
      <main className="page api-narrow">
        <h1>登入後查看站內通知</h1>
        <p>通知依目前帳號與角色顯示。</p>
        <a
          className="button primary"
          href={`#${role && role !== "citizen" ? `${role}/` : ""}login?next=${encodeURIComponent(next)}`}
        >
          登入
        </a>
      </main>
    );
  return (
    <Inbox
      key={`${session.user.id}/${role}`}
      role={
        role || (session.user.roles.includes("admin") ? "admin" : undefined)
      }
    />
  );
}
function Inbox({ role }: { role?: Role }) {
  const { session } = useSession();
  const [unread, setUnread] = useState(false);
  const [offset, setOffset] = useState(0);
  const [receipt, setReceipt] = useState<Notification | null>(null);
  const path = query("/me/notifications", {
    unread_only: unread,
    limit: 20,
    offset,
  });
  const list = useApi(
    path,
    (signal) =>
      request<PageData<Notification>>(path, {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  const action = useCommand<Notification>({
    scope: "notification-read",
    authorized: !!session,
    ready: !list.loading && !list.error,
    refresh: list.reload,
    reconfirm: false,
    onSuccess: (result) => setReceipt(result.data as Notification),
  });
  return (
    <main className="page api-narrow">
      <h1>站內通知</h1>
      <p>此處為站內通知匣，前景時定期更新；查看案件仍依目前身份檢查權限。</p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={unread}
          onChange={(e) => {
            setUnread(e.target.checked);
            setOffset(0);
          }}
        />
        只看未讀
      </label>
      <button
        className="button secondary"
        disabled={list.loading}
        onClick={list.reload}
      >
        更新通知
      </button>
      <LoadState {...list} />
      <CommandFeedback action={action} />
      {receipt?.read_at && (
        <p role="status">已讀時間：{time(receipt.read_at)}</p>
      )}
      {list.data?.items.length === 0 && <p>目前沒有通知</p>}
      <div className="api-form">
        {list.data?.items.map((item) => (
          <article className="card" key={item.id}>
            <h2>{item.title}</h2>
            <p>{item.message}</p>
            <p>
              {time(item.created_at)} ·{" "}
              {item.read_at ? `已讀 ${time(item.read_at)}` : "未讀"}
            </p>
            {destination(item, role) ? (
              <a className="button secondary" href={destination(item, role)}>
                查看案件
              </a>
            ) : (
              <p>此通知尚無可開啟的案件類型。</p>
            )}
            {!item.read_at && (
              <button
                className="button secondary"
                disabled={action.blocked}
                onClick={() =>
                  void action.run({
                    path: `/me/notifications/${item.id}/read`,
                    body: {},
                    label: `將「${item.title}」標為已讀`,
                  })
                }
              >
                標為已讀
              </button>
            )}
          </article>
        ))}
      </div>
      <Pagination page={list.data?.page} onChange={setOffset} />
    </main>
  );
}
