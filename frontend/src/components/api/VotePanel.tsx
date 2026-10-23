import { Icon } from "../Icon";
import { dismissToast, showToast } from "../Toast";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { request, type Proposal } from "../../data/api";
import {
  VOTE_MIN_VOTERS,
  VOTE_PASS_PERCENT,
  votePassing,
  votePercent,
  type VoteSide,
} from "../../data/voteTally";
import type { ProposalTally } from "../../map/browseMarkers";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { useCommand, CommandFeedback } from "./Commands";
import { voteOptions } from "./ProposalPages";

// 地圖抽屜裡的建議點投票面板（設計定案稿 vote-panel-v12）：
// 問句標題＋地點名＋分享鈕 → 半圓儀表（支持從左、不支持從右、60% 門檻線）→ 說明句
// → 支持／不支持 → 投過票才出現的回饋句、分隔線與「從投票到設桶」四步。
// 計票規則與百分比在 data/voteTally.ts（照後端 participation.py）。
// 動態只在沒有減少動態效果時播：儀表弧與數字 600ms、「+1」、湊滿 60 人時停 0.7 秒才切到結局。

const ANIM_MS = 600;
const HOLD_BEFORE_MS = 500; // 登入回來自動投票前，先讓舊比例停留一下
const HOLD_CLOSE_MS = 700; // 這一票湊滿 60 人：動畫播完再停這麼久才切到結局
const RULE = `滿 ${VOTE_MIN_VOTERS} 人、支持 ${VOTE_PASS_PERCENT}% 以上，就會送環保局評估。`;
const sideName = (side: VoteSide) => (side === "support" ? "支持" : "不支持");
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// 分享選單掛在 .m-app（拿得到 --m-tabs-h，才能停在底部分頁列上方），沒有就掛 body。
const overlayRoot = () =>
  document.querySelector<HTMLElement>(".m-app") ?? document.body;
const isOpen = (item: Proposal) =>
  item.status === "collecting" && item.voting_closed_at === null;

// ── 分享：先試系統分享（navigator.share），不支援才開小選單（LINE／複製連結／取消）。
export function useProposalShare(binId: string, name: string) {
  const [open, setOpen] = useState(false);
  // 沒辦法自動複製時，選單留著並把網址放進可選取的欄位（網址不塞進 toast）。
  const [manual, setManual] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const url = new URL(window.location.href);
  url.hash = `bin/${binId}?tab=vote`;
  const text = `一起支持「${name}」設置 BinU！`;
  // LINE 連結沿用 ProposalVoteDone.tsx 的做法。
  const lineHref = `https://social-plugins.line.me/lineit/share?${new URLSearchParams({ url: url.href, text })}`;
  const share = async () => {
    trigger.current = document.activeElement as HTMLElement | null;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url: url.href });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    setOpen(true);
  };
  const close = useCallback(() => {
    setOpen(false);
    setManual(false);
    trigger.current?.focus?.();
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url.href);
      showToast({ kind: "ok", text: "連結複製好了，貼給朋友吧" });
      close();
    } catch {
      showToast({ kind: "warn", text: "沒辦法自動複製，請長按連結複製" });
      setManual(true);
    }
  };
  const sheet = open && (
    <ShareSheet
      lineHref={lineHref}
      url={manual ? url.href : null}
      onCopy={copy}
      onClose={close}
    />
  );
  return { share, sheet };
}
function ShareSheet({
  lineHref,
  url,
  onCopy,
  onClose,
}: {
  lineHref: string;
  /** 自動複製失敗時才給：放進可選取的欄位讓使用者長按複製。 */
  url: string | null;
  onCopy: () => void;
  onClose: () => void;
}) {
  const first = useRef<HTMLAnchorElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!url) return;
    field.current?.focus();
    field.current?.select();
  }, [url]);
  useEffect(() => {
    first.current?.focus();
    // 掛在 document：比地圖頁掛在 window 的 Esc（關閉詳情）先收到，先關選單。
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return createPortal(
    <>
      <div className="mx-share-scrim" onClick={onClose} aria-hidden="true" />
      <div className="mx-share-sheet" role="dialog" aria-label="分享這個地點">
        <h2>分享這個地點</h2>
        <div className="mx-share-options">
          <a
            ref={first}
            className="button secondary"
            href={lineHref}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
          >
            用 LINE 分享
          </a>
          <button type="button" className="button secondary" onClick={onCopy}>
            複製連結
          </button>
        </div>
        {url && (
          <label className="mx-share-url">
            <span className="visually-hidden">分享連結</span>
            <input
              ref={field}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
        )}
        <button type="button" className="button secondary" onClick={onClose}>
          取消
        </button>
      </div>
    </>,
    overlayRoot(),
  );
}

// ── 標題列：問句靠左、副標只放地點名，右上分享鈕（與導航頁 ✕ 同一個 .icon-button）。
export function VoteHeader({
  name,
  onShare,
}: {
  name: string;
  onShare: () => void;
}) {
  return (
    <div className="mx-vote-top">
      <h1 className="mx-vote-q">你支持在這裡放垃圾桶嗎？</h1>
      <p className="mx-vote-sub">{name}</p>
      <button
        type="button"
        className="icon-button mx-vote-share"
        aria-label="分享這個地點"
        title="分享"
        onClick={onShare}
      >
        <Icon name="share" />
      </button>
    </div>
  );
}

// 數字跑動：目標值變了就從目前顯示的值補間到新值（減少動態效果時直接跳）。
function useTween(target: number) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (reducedMotion()) {
      current.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - start) / ANIM_MS);
      const value = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      current.current = value;
      setShown(value);
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

type Bump = { side: VoteSide; key: number; crossed: boolean };
// ── 半圓儀表（viewBox 300×145，畫成 240px 寬）：支持 --teal 從左、不支持 --text-body 從右，
// 交會處深色縫；60% 門檻白線與「60%」。弧心「還差／N 人」，滿 60 人後「已滿／N 人」。
const CX = 150;
const CY = 135;
const R = 105;
const ANGLE = ((180 - VOTE_PASS_PERCENT * 1.8) * Math.PI) / 180;
const at = (r: number) =>
  `${(CX + r * Math.cos(ANGLE)).toFixed(1)} ${(CY - r * Math.sin(ANGLE)).toFixed(1)}`;
const ARC_L = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const ARC_R = `M${CX + R} ${CY} A${R} ${R} 0 0 0 ${CX - R} ${CY}`;
function VoteGauge({
  support,
  oppose,
  ended,
  bump,
  closing,
}: {
  support: number;
  oppose: number;
  ended: boolean;
  bump: Bump | null;
  closing: boolean;
}) {
  const total = support + oppose;
  const p = votePercent(support, oppose);
  const full = total >= VOTE_MIN_VOTERS;
  const left = Math.max(0, VOTE_MIN_VOTERS - total);
  const pass = votePassing(support, oppose);
  const s = useTween(p ? p[0] : 0);
  const o = useTween(p ? p[1] : 0);
  const centre = useTween(full ? total : left);
  const label =
    (p
      ? `${ended ? "最後" : "目前"}支持 ${p[0]}%，不支持 ${p[1]}%。`
      : "還沒有人投票。") +
    `門檻 ${VOTE_PASS_PERCENT}%，` +
    (p
      ? pass
        ? "已達到。"
        : ended
          ? "未達到。"
          : "還沒達到。"
      : "還沒有票。") +
    `投票人數 ${total} 人，門檻 ${VOTE_MIN_VOTERS} 人，` +
    (full ? "已滿。" : `還差 ${left} 人。`);
  const number = (side: VoteSide) => {
    const value = side === "support" ? s : o;
    return (
      <span
        key={bump?.side === side ? `n-${bump.key}` : "n"}
        className={`n${bump?.side === side ? " mx-vote-bump" : ""}`}
      >
        {p ? (
          <>
            {value}
            <small>%</small>
          </>
        ) : (
          "—"
        )}
      </span>
    );
  };
  const plus = (side: VoteSide) =>
    bump?.side === side && (
      <span
        key={`plus-${bump.key}`}
        className="mx-vote-plus1"
        aria-hidden="true"
      >
        +1
      </span>
    );
  return (
    <div className="mx-vote-gauge" role="img" aria-label={label}>
      <svg
        className={`mx-gauge${closing ? " mx-vote-closing" : ""}`}
        viewBox="0 0 300 145"
        aria-hidden="true"
        style={
          {
            "--sd": p ? Math.max(0, p[0] - 0.6) : 0,
            "--od": p ? Math.max(0, p[1] - 0.6) : 0,
          } as CSSProperties
        }
      >
        <path className="g-track" d={ARC_L} pathLength={100} />
        {p && (
          <>
            <path className="g-s" d={ARC_L} pathLength={100} />
            <path className="g-o" d={ARC_R} pathLength={100} />
          </>
        )}
        <path className="g-cut" d={`M${at(97)} L${at(113)}`} />
        <path
          key={bump?.crossed ? bump.key : "tick"}
          className={`g-tick${bump?.crossed ? " mx-vote-flash" : ""}`}
          d={`M${at(90)} L${at(97)} M${at(113)} L${at(120)}`}
        />
        <text
          className="g-lab"
          fontSize={15}
          x={(CX + 133 * Math.cos(ANGLE)).toFixed(1)}
          y={(CY - 133 * Math.sin(ANGLE) + 5).toFixed(1)}
          textAnchor="middle"
        >
          {VOTE_PASS_PERCENT}%
        </text>
      </svg>
      <div className="g-center" aria-hidden="true">
        <span className="cap">{full ? "已滿" : "還差"}</span>
        <b>
          {centre}
          <small>人</small>
        </b>
      </div>
      <div className="g-side s" aria-hidden="true">
        <span className="lab">支持</span>
        {number("support")}
        {plus("support")}
      </div>
      <div className="g-side o" aria-hidden="true">
        {number("oppose")}
        <span className="lab">不支持</span>
        {plus("oppose")}
      </div>
    </div>
  );
}

const resultLine: Partial<Record<Proposal["status"], string>> = {
  evaluation: "投票結束，已送環保局評估",
  village: "投票結束，改由里長確認",
  survey: "投票結束，環保局會勘中",
  installed: "投票結束，已設桶",
  declined: "投票結束，未通過",
};
// 這個建議點在網址上帶的「登入後要投的那一票」（#bin/<id>?tab=vote&vote=support）。
function readVoteParam(): VoteSide | null {
  const vote = new URLSearchParams(window.location.hash.split("?")[1]).get(
    "vote",
  );
  return vote === "support" || vote === "oppose" ? vote : null;
}
function dropVoteParam() {
  const [route, search = ""] = window.location.hash.slice(1).split("?");
  const params = new URLSearchParams(search);
  if (!params.has("vote")) return;
  params.delete("vote");
  const rest = params.toString();
  // replaceState：重新整理不會再投一次，也不多一筆瀏覽紀錄。
  history.replaceState(history.state, "", `#${route}${rest ? `?${rest}` : ""}`);
}

type VoteEvent = {
  side: VoteSide;
  auto: boolean;
  closedByMe: boolean;
  crossed: boolean;
  key: number;
};
export function VoteBallot({
  id,
  binId,
  onShare,
  onTally,
}: {
  id: string;
  binId: string;
  onShare: () => void;
  onTally?: (tally: ProposalTally) => void;
}) {
  const { session } = useSession();
  const citizen = !!session?.user.roles.includes("citizen");
  const path = `/proposals/${id}`;
  const detail = useApi(
    path,
    (signal) =>
      request<Proposal>(path, { signal, token: session?.access_token }),
    true,
  );
  const [updated, setUpdated] = useState<Proposal | null>(null);
  const item = detail.loading && updated ? updated : detail.data;
  const open = !!item && isOpen(item);
  const action = useCommand<Proposal>({
    scope: `vote/${id}`,
    authorized: citizen,
    ready: open && !detail.error,
    reconfirm: false,
    refresh: detail.reload,
    onSuccess: (result) => setUpdated(result.data as Proposal),
  });
  const [event, setEvent] = useState<VoteEvent | null>(null);
  const [hold, setHold] = useState(false);
  const [closing, setClosing] = useState(false);
  // 自動投票的 toast（全站 toast，components/Toast.tsx）：記下 id，按「復原」或離開面板時收掉。
  const toastId = useRef<number | undefined>(undefined);
  const [ask, setAsk] = useState<VoteSide | null>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) =>
    timers.current.push(window.setTimeout(fn, ms));
  useEffect(
    () => () => {
      timers.current.forEach(window.clearTimeout);
      if (toastId.current !== undefined) dismissToast(toastId.current);
    },
    [],
  );
  useEffect(() => {
    if (item)
      onTally?.({
        support: item.support,
        oppose: item.oppose,
        status: item.status,
      });
  }, [item?.support, item?.oppose, item?.status]);

  const cast = async (side: VoteSide, auto: boolean) => {
    if (!item) return;
    const before = item;
    const result = await action.run({
      path: `${path}/vote`,
      body: { vote: side },
      label: voteOptions.find((o) => o.vote === side)!.commandLabel,
    });
    if (!result) return;
    const after = result.data as Proposal;
    const next: VoteEvent = {
      side,
      auto,
      closedByMe: !isOpen(after),
      crossed:
        !votePassing(before.support, before.oppose) &&
        votePassing(after.support, after.oppose),
      key: Date.now(),
    };
    setEvent(next);
    setAsk(null);
    if (toastId.current !== undefined) dismissToast(toastId.current);
    toastId.current = auto
      ? showToast({
          kind: "ok",
          text: next.closedByMe
            ? "你這一票讓投票結算了！"
            : `投好了！你${side === "support" ? "支持" : "反對"}在這裡放桶`,
          action: next.closedByMe
            ? undefined
            : { label: "復原", onClick: () => void undoRef.current() },
        })
      : undefined;
    // 這一票湊滿 60 人：動畫播完再停 0.7 秒才切到結局，切換時儀表閃一下。
    if (next.closedByMe && !reducedMotion()) {
      setHold(true);
      later(() => {
        setHold(false);
        setClosing(true);
        later(() => setClosing(false), 520);
      }, ANIM_MS + HOLD_CLOSE_MS);
    }
  };
  const undo = async () => {
    if (toastId.current !== undefined) dismissToast(toastId.current);
    toastId.current = undefined;
    const result = await action.run({
      path: `${path}/vote`,
      body: { vote: null },
      label: voteOptions.find((o) => o.vote === null)!.commandLabel,
    });
    if (result) setEvent(null);
  };
  const undoRef = useRef(undo);
  undoRef.current = undo;

  // 登入回來（網址帶 ?vote=）：自動投下剛剛選的那一票；已投過另一邊就先問，
  // 投票已經結束就告知沒投出。只處理一次，處理完把 ?vote= 從網址拿掉。
  const pending = useRef(readVoteParam());
  useEffect(() => {
    const side = pending.current;
    if (!side || !item || !citizen || detail.error) return;
    pending.current = null;
    dropVoteParam();
    if (!isOpen(item)) {
      showToast({ kind: "warn", text: "投票已經結束，這票沒投出" });
      return;
    }
    if (item.my_vote === side) return;
    if (item.my_vote) {
      setAsk(side);
      return;
    }
    if (reducedMotion()) void cast(side, true);
    else later(() => void cast(side, true), HOLD_BEFORE_MS);
  }, [item, citizen, detail.error]);

  const login = (side: VoteSide) => {
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    params.set("tab", "vote");
    params.set("vote", side);
    window.location.hash = `login?next=${encodeURIComponent(`bin/${binId}?${params}`)}`;
  };

  if (!item) return <LoadState {...detail} />;
  const ended = !hold && !open;
  const my = item.my_vote;
  const total = item.support + item.oppose;
  const button = (side: VoteSide) => {
    const isS = side === "support";
    const chosen = my === side;
    const kind =
      ended || my
        ? `secondary${chosen ? (isS ? " chosen-s" : " chosen-o") : ""}`
        : isS
          ? "primary"
          : "secondary";
    return (
      <button
        type="button"
        className={`button ${kind}`}
        aria-pressed={chosen}
        disabled={ended || hold || action.blocked}
        onClick={() => {
          if (!citizen) login(side);
          else if (!chosen) void cast(side, false);
        }}
      >
        {my ? (
          chosen ? (
            <>
              <span aria-hidden="true">✓ </span>
              {isS ? "你支持" : "你不支持"}
            </>
          ) : ended ? (
            sideName(side)
          ) : isS ? (
            "改投支持"
          ) : (
            "改投不支持"
          )
        ) : (
          sideName(side)
        )}
      </button>
    );
  };
  const mine = my && event?.side === my ? event : null;
  const live = ended
    ? mine?.closedByMe
      ? `你這一票剛好湊滿 ${VOTE_MIN_VOTERS} 人${item.status === "evaluation" ? "，已送環保局評估。" : "。"}`
      : my === "support"
        ? "你投了支持。"
        : "你投了不支持。"
    : mine?.crossed
      ? `你這一票讓支持過了 ${VOTE_PASS_PERCENT}%！`
      : my === "support"
        ? "已投下支持，謝謝你！"
        : "已投下不支持，謝謝你的意見！";
  const stepNow = item.status === "installed" ? 3 : ended ? 2 : 1;
  const steps = [
    "建議點",
    "市民投票",
    item.status === "village" ? "里長確認" : "環保局評估",
    "設桶",
  ];
  return (
    <div className="mx-vote">
      <div className="mx-vote-meter">
        <VoteGauge
          support={item.support}
          oppose={item.oppose}
          ended={ended}
          bump={event && !reducedMotion() ? event : null}
          closing={closing}
        />
        {ended ? (
          <p className="mx-vote-main">
            {resultLine[item.status] ?? "投票已結束"}
          </p>
        ) : total === 0 ? (
          <div className="mx-vote-status">
            <p className="mx-vote-main">還沒有人投票，來投第一票</p>
            <p className="tiny">{RULE}</p>
          </div>
        ) : (
          <p className="tiny">{RULE}</p>
        )}
      </div>
      <div className="mx-vote-act">
        <div className="mx-vote-actions">
          {button("support")}
          {button("oppose")}
        </div>
        {ask && (
          <div className="mx-vote-ask" role="status">
            <p>
              你之前投了「{sideName(ask === "support" ? "oppose" : "support")}
              」，要改投「{sideName(ask)}」嗎？
            </p>
            <div className="mx-vote-actions">
              <button
                type="button"
                className="button primary"
                disabled={action.blocked}
                onClick={() => void cast(ask, false)}
              >
                改投{sideName(ask)}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setAsk(null)}
              >
                保留原本的票
              </button>
            </div>
          </div>
        )}
        <CommandFeedback action={action} />
        {my && (
          <div className="mx-vote-after">
            <div className="mx-vote-group">
              <div className="mx-vote-live">
                <p className="mx-vote-main">{live}</p>
                {!ended && (
                  <button
                    type="button"
                    className="mx-vote-invite"
                    onClick={onShare}
                  >
                    邀朋友一起投
                  </button>
                )}
              </div>
            </div>
            <hr className="mx-vote-sep" />
            <section
              className="mx-vote-group"
              aria-labelledby={`vote-steps-${id}`}
            >
              <div className="mx-vote-steps-head">
                <h2 className="mx-vote-steps-title" id={`vote-steps-${id}`}>
                  從投票到設桶
                </h2>
                <a className="mx-vote-history" href="#vote/votes">
                  我的投票紀錄 →
                </a>
              </div>
              <ol className="mx-vote-steps" aria-label="從投票到設桶">
                {steps.map((label, i) => (
                  <li
                    key={label}
                    className={
                      i < stepNow ? "done" : i === stepNow ? "cur" : undefined
                    }
                    aria-current={i === stepNow ? "step" : undefined}
                  >
                    <span className="dot">{i + 1}</span>
                    <span className="lbl">{label}</span>
                  </li>
                ))}
              </ol>
              <p className="tiny">每走到下一步都會通知你。</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
