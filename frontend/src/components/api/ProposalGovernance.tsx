import { ProposalNaming } from "./ProposalNaming";
import { useState } from "react";
import { request, type Proposal } from "../../data/api";
import { useApi } from "./useApi";
import { useSession } from "./SessionContext";
import { useCommand, type Intent } from "./Commands";
import { LoadState } from "./LoadState";
import { ProposalList, ProposalSummary } from "./ProposalPages";
import {
  ConfirmationControls,
  RequireAdmin,
  type Confirmation,
} from "./MutationConfirmation";

const stages = {
  village: { action: "village_approve", label: "通過里辦評議" },
  evaluation: { action: "evaluation_approve", label: "通過評估" },
  survey: { action: "survey_approve", label: "確認設置" },
} as const;
function canReview(item: Proposal, intent: Intent) {
  const body = intent.body as { action?: string; reason?: string };
  const next = stages[item.status as keyof typeof stages];
  return (
    !!next &&
    (body.action === next.action ||
      (body.action === "decline" && !!body.reason?.trim()))
  );
}
export function AdminProposals({ id }: { id?: string }) {
  return (
    <RequireAdmin next={`admin/proposals${id ? `/${id}` : ""}`}>
      {id ? <AdminProposal key={id} id={id} /> : <ProposalList admin />}
    </RequireAdmin>
  );
}
function AdminProposal({ id }: { id: string }) {
  const { session } = useSession();
  const path = `/proposals/${id}`;
  const detail = useApi(
    path,
    (signal) =>
      request<Proposal>(path, { signal, token: session?.access_token }),
    true,
  );
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const item = detail.data;
  const etag = detail.etag || (item ? `"v${item.version}"` : null);
  const action = useCommand<Proposal>({
    scope: `proposal-review/${id}`,
    authorized: !!session?.user.roles.includes("admin"),
    ready: !!item && !!etag && !detail.loading && !detail.error,
    etag,
    refresh: detail.reload,
    canRun: (intent) => !!item && canReview(item, intent),
  });
  const next = item && stages[item.status as keyof typeof stages];
  const queue = (name: string, label: string) => {
    action.cancel();
    setConfirmation({
      etag,
      intent: {
        path: `/admin/proposals/${id}/review`,
        body: { action: name, reason: reason.trim() || null },
        label: `${label}${reason.trim() ? `：${reason.trim()}` : ""}`,
      },
    });
  };
  return (
    <main className="page api-narrow">
      <h1>提案審查</h1>
      <a className="back-link" href="#admin/proposals">
        返回提案列表
      </a>
      <LoadState {...detail} />
      {item && (
        <section className="card">
          <ProposalSummary item={item} />
          <p>原提案名稱：{item.name}</p>
          {item.outcome_reason && <p>結果原因：{item.outcome_reason}</p>}
          <p>版本 {item.version}</p>
          <a className="api-action-link" href={`#proposals/${id}`}>
            查看市民進度
          </a>
          <a className="api-action-link" href={`#bin/${item.bin_id}`}>
            查看關聯 Bin
          </a>
        </section>
      )}
      {next ? (
        <section className="card api-form">
          <h2>目前合法操作</h2>
          <label>
            審查原因
            <textarea
              aria-label="審查原因"
              maxLength={500}
              value={reason}
              disabled={action.busy || !!action.pending}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={action.blocked}
            onClick={() => queue(next.action, next.label)}
          >
            {next.label}
          </button>
          <button
            className="button secondary"
            disabled={action.blocked || !reason.trim()}
            onClick={() => queue("decline", "拒絕提案")}
          >
            拒絕提案
          </button>
        </section>
      ) : (
        item && <p>此階段沒有可用的設置審查操作。</p>
      )}
      <ConfirmationControls
        action={action}
        confirmation={confirmation}
        etag={etag}
        cancel={() => setConfirmation(null)}
        impact="操作會更新市民提案進度與點位狀態。"
      />
      {item && (
        <ProposalNaming
          key={`${id}/${session?.user.id}`}
          item={item}
          etag={etag}
          ready={!detail.loading && !detail.error}
          refresh={detail.reload}
          admin
        />
      )}
    </main>
  );
}
