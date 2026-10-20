import type { ReactNode } from "react";
import { useSession } from "./SessionContext";
import { CommandFeedback, type Intent, useCommand } from "./Commands";
export type Confirmation = { intent: Intent; etag: string | null };
export function RequireAdmin({
  next,
  children,
}: {
  next: string;
  children: ReactNode;
}) {
  const { session } = useSession();
  return session?.user.roles.includes("admin") ? (
    <>{children}</>
  ) : (
    <main className="page api-narrow">
      <h1>請以管理員身份登入</h1>
      <p>此操作需要獨立管理員 session，市民與隊員不能代為審查。</p>
      <a
        className="button primary"
        href={`#admin/login?next=${encodeURIComponent(next)}`}
      >
        管理員登入
      </a>
    </main>
  );
}
export function ConfirmationControls<T>({
  action,
  confirmation,
  etag,
  cancel,
  impact,
}: {
  action: ReturnType<typeof useCommand<T>>;
  confirmation: Confirmation | null;
  etag: string | null;
  cancel: () => void;
  impact: string;
}) {
  const changed = confirmation && confirmation.etag !== etag;
  return (
    <>
      <CommandFeedback action={action} />
      {confirmation && !action.pending && !action.conflict && (
        <section className="card api-command" aria-label="操作確認">
          <h2>確認操作</h2>
          <p>{confirmation.intent.label}</p>
          <p>{impact}</p>
          {changed && (
            <p role="status">資料版本已變更，請取消後重新選擇操作。</p>
          )}
          <button
            className="button primary"
            disabled={!!changed || action.blocked}
            onClick={() =>
              void action.run(confirmation.intent).then(() => cancel())
            }
          >
            確認送出
          </button>
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={cancel}
          >
            取消
          </button>
        </section>
      )}
    </>
  );
}
