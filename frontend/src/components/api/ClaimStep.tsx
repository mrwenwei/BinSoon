import { useEffect, useId, useRef, useState } from "react";
import {
  ApiError,
  command,
  errorMessage,
  sendCommand,
  type Adoption,
} from "../../data/api";
import { isDemoToken } from "../../data/demoMode";
import type { BinState } from "../../data/binState";
import { Icon } from "../Icon";
import { Mascot } from "../Mascot";
import { NameTag, PixelHeart, Points } from "../Pixel";
import { showToast } from "../Toast";
import { useSession } from "./SessionContext";
import { CLAIM_LIMIT, claimName, notifyClaimsChanged } from "./useMyClaims";

// 認領 BinU（設計稿 adoption-flow-v3）：桶詳情的認領列 → 抽屜原地換成取名步驟
// （哪一隻 → 拿多少 → 什麼時候拿 → 取名 → 底部確認）→ 回到桶詳情跳 toast。
// 取消、Esc、點地圖空白都退回桶詳情，名字草稿保留（狀態在 MapPage）。
// 正式後端照後端規則：送出後是待審（toast「已送出，等審核」）、名字是公開名稱、要帶身份（居民）。

// 「第一個回報、查證屬實」的點數：有效認領者 2 點（後端 workflows.py，展示模式同規則）。
export const CLAIM_POINTS = 2;

export type ClaimControls = {
  open: boolean;
  draft: string;
  setDraft: (value: string) => void;
  start: () => void;
  cancel: () => void;
  /** 認領送出成功：關掉取名步驟、清掉草稿。 */
  done: () => void;
};

// 桶詳情的認領列：像素愛心 ×3＋點數元件（代幣第一次出現，下面加小字「點數」）。
export function ClaimCta({
  onStart,
  loginHref,
}: {
  onStart?: () => void;
  /** 沒登入時改成登入連結，登入後回到這個桶。 */
  loginHref?: string;
}) {
  const content = (
    <>
      <PixelHeart scale={3} />
      <span className="claim-cta-copy">
        <strong>認領這位 BinU</strong>
        <small>第一個回報、查證屬實就拿</small>
      </span>
      <Points value={CLAIM_POINTS} />
    </>
  );
  return loginHref ? (
    <a className="claim-cta" href={loginHref}>
      {content}
    </a>
  ) : (
    <button type="button" className="claim-cta" onClick={onStart}>
      {content}
    </button>
  );
}

// 已認領到上限：說明列＋「管理」，不像 CTA（沒有薄荷底、沒有大按鈕）。
export function ClaimLimitRow() {
  return (
    <div className="claim-limit">
      <p>
        <strong>
          你已認領 <span className="numeral-sm">{CLAIM_LIMIT}</span> /{" "}
          {CLAIM_LIMIT} 隻 BinU
        </strong>
        <small>想認領這隻，先到「我的 BinU」結束一隻</small>
      </p>
      <a className="text-button" href="#adopt">
        管理
      </a>
    </div>
  );
}

const situations = [
  ["full", "滿了"],
  ["dirty", "很髒"],
  ["dumping", "旁邊有人亂丟"],
  ["broken", "壞掉"],
] as const;

export function ClaimStep({
  binId,
  address,
  state,
  draft,
  onDraft,
  onCancel,
  onDone,
}: {
  binId: string;
  address: string;
  state: BinState;
  draft: string;
  onDraft: (value: string) => void;
  onCancel: () => void;
  onDone: (adoption: Adoption) => void;
}) {
  const { session } = useSession();
  const demo = isDemoToken(session?.access_token);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  const confirm = async () => {
    const name = draft.trim();
    if (!name) {
      setEmpty(true);
      input.current?.focus();
      return;
    }
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await sendCommand<Adoption>(
        command(
          "/adoptions",
          demo
            ? {
                bin_id: binId,
                role: "居民",
                display_name: session.user.display_name,
                private_bin_name: name,
                intro: "",
                preferences: { full: false, dumping: false, dirty: false },
              }
            : // 正式後端：名字是公開名稱、身份必填（這一步只開放居民；其他身份走完整申請頁）。
              {
                bin_id: binId,
                role: "居民",
                display_name: name,
                intro: "",
                preferences: { full: true, dumping: true, dirty: true },
              },
          session.user.id,
        ),
        session,
      );
      const adoption = result.data;
      notifyClaimsChanged();
      showToast(
        adoption.status === "active"
          ? {
              kind: "tag",
              text: (
                <>
                  認領成功！
                  <NameTag name={claimName(adoption)} />
                  是你的了
                </>
              ),
              action: {
                label: "查看",
                onClick: () => {
                  window.location.hash = "adopt";
                },
              },
            }
          : {
              kind: "info",
              text: "已送出，等審核",
              action: {
                label: "查看",
                onClick: () => {
                  window.location.hash = `adopt/${adoption.id}`;
                },
              },
            },
      );
      onDone(adoption);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "ADOPTION_LIMIT"
          ? `每人最多認領 ${CLAIM_LIMIT} 隻，先到「我的 BinU」結束一隻。`
          : errorMessage(e),
      );
      setBusy(false);
    }
  };
  return (
    <div className="api-bin-detail mx-bin claim-step">
      <div className="claim-head">
        <span className="claim-art" aria-hidden="true">
          <Mascot state={state} />
          <PixelHeart />
        </span>
        <div>
          <h1>認領這位 BinU</h1>
          <p className="claim-sub">{address}</p>
        </div>
      </div>
      <div className="claim-gain">
        <strong>你回報這桶，可以拿</strong>
        <Points value={CLAIM_POINTS} label />
      </div>
      <section className="claim-when" aria-labelledby={`${id}-when`}>
        <h2 id={`${id}-when`}>遇到這些狀況就回報</h2>
        <ul className="claim-situations" aria-label="可以回報的狀況">
          {situations.map(([icon, label]) => (
            <li key={icon}>
              <Icon name={icon} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <p className="claim-note">
          要是第一個回報，清潔隊到場查證屬實就算。回報後清潔隊會來處理。
        </p>
      </section>
      <div className="claim-field">
        <label htmlFor={`${id}-name`}>幫牠取個名字</label>
        <input
          ref={input}
          id={`${id}-name`}
          maxLength={50}
          autoComplete="off"
          placeholder="例如：下班等公車桶"
          value={draft}
          aria-invalid={empty || undefined}
          aria-describedby={`${id}-help`}
          disabled={busy}
          onChange={(e) => {
            onDraft(e.target.value);
            if (e.target.value.trim()) setEmpty(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void confirm();
          }}
        />
        <p className={`claim-help${empty ? " error" : ""}`} id={`${id}-help`}>
          {empty
            ? "先幫牠取個名字，才能認領"
            : demo
              ? "只有你看得到，之後可以改"
              : "這個名字會公開顯示，送出後要等審核"}
        </p>
        {!demo && (
          <a className="text-button" href={`#adopt/apply/${binId}`}>
            用店家、學校或社區團體身份申請
          </a>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="bin-actions">
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => void confirm()}
        >
          確認認領
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </div>
  );
}
