import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  command,
  errorMessage,
  sendCommand,
  type Adoption,
} from "../../data/api";
import { NameTag, Points } from "../Pixel";
import { showToast } from "../Toast";
import { CLAIM_POINTS } from "./ClaimStep";
import { useSession } from "./SessionContext";
import { claimName, notifyClaimsChanged } from "./useMyClaims";

// 結束認領的置中確認框（設計稿 adoption-flow-v3 第 9 步）：role=dialog、aria-modal，
// Tab 只在框內、Esc 與點遮罩關閉；「先不要」是主按鈕、預設聚焦，「結束認領」是外框次級鍵。
// 結束要帶目前版本（If-Match），版本不對時後端擋下、框內顯示錯誤，請使用者重新整理。
// 卡片照 .redeem-dialog、遮罩照 .mx-share-scrim。
export function EndClaimDialog({
  item,
  onClose,
}: {
  item: Adoption;
  /** 關閉（取消或結束成功）：由頁面把焦點放回原本的「⋯」。 */
  onClose: () => void;
}) {
  const { session } = useSession();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = claimName(item);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    stay.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab" || !box.current) return;
      const items = [
        ...box.current.querySelectorAll<HTMLElement>("button:not(:disabled)"),
      ];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const end = async () => {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await sendCommand<Adoption>(
        command(
          `/adoptions/${item.id}/end`,
          { reason: null },
          session.user.id,
          `"v${item.version}"`,
        ),
        session,
      );
      notifyClaimsChanged();
      showToast({
        kind: "tag",
        text: (
          <>
            已結束認領
            <NameTag name={name} />
            掰掰
          </>
        ),
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return createPortal(
    <>
      <div className="claim-dialog-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={box}
        className="claim-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
      >
        <h2 id={`${id}-title`}>
          結束認領
          <NameTag name={name} size="xl" />？
        </h2>
        <p id={`${id}-desc`}>
          結束後，你第一個回報、查證屬實拿 <Points value={1} small />
          （現在是 <Points value={CLAIM_POINTS} small />）。
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="claim-dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void end()}
          >
            結束認領
          </button>
          <button
            ref={stay}
            type="button"
            className="button primary"
            onClick={onClose}
          >
            先不要
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
