import { useState } from "react";
import type { Proposal } from "../../data/api";
import { useSession } from "./SessionContext";
import { useCommand } from "./Commands";
import {
  ConfirmationControls,
  type Confirmation,
} from "./MutationConfirmation";
export function ProposalNaming({
  item,
  etag,
  ready,
  refresh,
  admin = false,
}: {
  item: Proposal;
  etag: string | null;
  ready: boolean;
  refresh: () => void;
  admin?: boolean;
}) {
  const { session } = useSession();
  const [name, setName] = useState("");
  const [expectedName, setExpectedName] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const owner = !!session?.user.roles.includes("citizen") && item.mine;
  const canRequest =
    owner && item.status === "installed" && item.name_status !== "pending";
  const canAdmin =
    admin &&
    !!session?.user.roles.includes("admin") &&
    item.name_status === "pending" &&
    item.status === "installed";
  const action = useCommand<Proposal>({
    scope: `proposal-name/${item.id}/${admin ? "review" : "request"}`,
    authorized: admin ? !!session?.user.roles.includes("admin") : owner,
    ready: ready && !!etag,
    etag,
    refresh,
    canRun: (intent) => {
      if (admin)
        return (
          canAdmin &&
          item.pending_name === expectedName &&
          ((intent.body as { approve: boolean; reason: string | null })
            .approve ||
            !!(intent.body as { reason: string | null }).reason?.trim())
        );
      return canRequest;
    },
    onSuccess: () => {
      setName("");
      setReason("");
    },
  });
  const queue = (body: unknown, label: string) => {
    action.cancel();
    setExpectedName(item.pending_name);
    setConfirmation({
      etag,
      intent: {
        path: admin
          ? `/admin/proposals/${item.id}/name-review`
          : `/proposals/${item.id}/name-requests`,
        body,
        label,
      },
    });
  };
  return (
    <section className="card api-form">
      <h2>桶名申請與審核</h2>
      <p>原提案名稱：{item.name}</p>
      <p>已核准桶名：{item.approved_name ?? "尚無核准名稱"}</p>
      <p>申請名稱：{item.pending_name ?? "尚無申請"}</p>
      <p>
        命名狀態：
        {item.name_status === "pending"
          ? "待審核"
          : item.name_status === "returned"
            ? "已退回，可重新申請"
            : item.name_status === "approved"
              ? "已核准"
              : "尚無申請"}
      </p>
      {canRequest && (
        <>
          <label>
            申請桶名
            <input
              required
              maxLength={30}
              value={name}
              disabled={action.busy || !!action.pending}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={action.blocked || !name.trim()}
            onClick={() =>
              queue({ name: name.trim() }, `申請桶名「${name.trim()}」`)
            }
          >
            送出命名申請
          </button>
        </>
      )}
      {canAdmin && (
        <>
          <label>
            命名退回原因
            <textarea
              aria-label="命名退回原因"
              maxLength={500}
              value={reason}
              disabled={action.busy || !!action.pending}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={action.blocked}
            onClick={() =>
              queue(
                { approve: true, reason: reason.trim() || null },
                `核准桶名「${item.pending_name}」`,
              )
            }
          >
            核准桶名
          </button>
          <button
            className="button secondary"
            disabled={action.blocked || !reason.trim()}
            onClick={() =>
              queue(
                { approve: false, reason: reason.trim() },
                `退回命名申請：${reason.trim()}`,
              )
            }
          >
            退回命名
          </button>
        </>
      )}
      <ConfirmationControls
        action={action}
        confirmation={confirmation}
        etag={etag}
        cancel={() => setConfirmation(null)}
        impact="申請待審期間保留已核准桶名；核准後才會更新公開 Bin 名稱，認養公開名稱不受影響。"
      />
    </section>
  );
}
