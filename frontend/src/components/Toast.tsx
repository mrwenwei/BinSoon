import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

// 全站 toast（認領流程 v3 第 6 節）：深色 --panel 底＋1px --text-muted 框＋左側類型圖示＋
// heading 字級＋青綠底線文字鍵。認領相關（tag）不放圖示，句中直接放名牌元件。
// 時間：沒有動作 3 秒、有「復原／查看」6 秒、警示 8 秒（滑鼠移上或鍵盤聚焦時暫停）。
// 一次只顯示一個，新的取代舊的；例外：①舊的有「復原」且還沒滿 2 秒，新的排隊等它結束
// （最多排 1 個，再來的取代排隊中的）；②警示只會被新的警示取代，其他的排隊。
export type ToastKind = "ok" | "info" | "warn" | "tag";
export type ToastInput = {
  kind: ToastKind;
  text: ReactNode;
  action?: { label: string; onClick: () => void };
};
type Entry = ToastInput & { id: number; shownAt: number };

export const TOAST_MS = 6000;
const PLAIN_MS = 3000;
const WARN_MS = 8000;
const UNDO_GUARD_MS = 2000;

let current: Entry | null = null;
let queued: Entry | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function showToast(input: ToastInput) {
  const entry: Entry = { ...input, id: nextId++, shownAt: 0 };
  const guarded =
    current &&
    ((current.action?.label === "復原" &&
      Date.now() - current.shownAt < UNDO_GUARD_MS) ||
      (current.kind === "warn" && input.kind !== "warn"));
  if (guarded) queued = entry;
  else {
    current = { ...entry, shownAt: Date.now() };
    queued = null;
  }
  emit();
  return entry.id;
}
export function dismissToast(id?: number) {
  if (id === undefined || current?.id === id) advance();
  else if (queued?.id === id) {
    queued = null;
    emit();
  }
}
function advance() {
  current = queued ? { ...queued, shownAt: Date.now() } : null;
  queued = null;
  emit();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const icons: Partial<Record<ToastKind, ReactNode>> = {
  ok: <Icon name="done" />,
  info: <Icon name="info" />,
};

// 掛在 App 一次。位置在 CSS（.toast-host）：地圖頁在地圖上緣，其他頁在頂欄下方。
export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, () => current);
  const timer = useRef(0);
  const remaining = useRef(0);
  const startedAt = useRef(0);
  const paused = useRef(false);
  const start = () => {
    window.clearTimeout(timer.current);
    paused.current = false;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(advance, Math.max(0, remaining.current));
  };
  // 只有警示會暫停計時（滑鼠移上或鍵盤聚焦）。
  const pause = () => {
    if (toast?.kind !== "warn" || paused.current) return;
    paused.current = true;
    window.clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
  };
  const resume = () => {
    if (paused.current) start();
  };
  useEffect(() => {
    if (!toast) return;
    remaining.current =
      toast.kind === "warn" ? WARN_MS : toast.action ? TOAST_MS : PLAIN_MS;
    start();
    return () => window.clearTimeout(timer.current);
  }, [toast?.id]);
  return (
    <div className="toast-host">
      {toast && (
        <div
          key={toast.id}
          className={`toast ${toast.kind}${toast.action ? "" : " no-action"}`}
          role={toast.kind === "warn" ? "alert" : "status"}
          onMouseEnter={pause}
          onMouseLeave={resume}
          onFocus={pause}
          onBlur={resume}
        >
          {toast.kind === "warn" ? (
            <span className="toast-icon warn">⚠</span>
          ) : (
            icons[toast.kind] && (
              <span className={`toast-icon ${toast.kind}`} aria-hidden="true">
                {icons[toast.kind]}
              </span>
            )
          )}
          <span className="toast-text">{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                const { onClick } = toast.action!;
                dismissToast(toast.id);
                onClick();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
