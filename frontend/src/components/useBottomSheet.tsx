import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

// 手機底部抽屜（收起／半開／全開）：市民地圖（MapPage）與步行導航（NavigationPage）共用。
// 高度由各頁自己量（版面不同），這裡只管停點、拖曳手勢、把手與鍵盤操作；
// 外觀沿用 .mx-handle-wrap／.mx-handle，抽屜本身的高度過場由各頁 CSS 處理。
export type SheetStop = "collapsed" | "half" | "full";
export type SheetHeights = Record<SheetStop, number>;
const sheetOrder: SheetStop[] = ["collapsed", "half", "full"];
const sheetNames: Record<SheetStop, string> = {
  collapsed: "收起",
  half: "半開",
  full: "全開",
};
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const MOBILE_QUERY = "(max-width: 760px)";
export function useMediaQuery(media: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(media).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(media);
    const change = () => setMatches(list.matches);
    change();
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [media]);
  return matches;
}

// 手勢參數：超過 DRAG_SLOP 才算拖（以內是點擊）；放開時速度超過 FLICK（px/ms）算甩。
const DRAG_SLOP = 7;
const FLICK = 0.5;
const FAST_FLICK = 1.2;
// 滾輪：一次滾動只移動一個停點；安靜這麼久才算下一次滾動。
const WHEEL_QUIET_MS = 300;
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// 觸控拖曳不接管的地方：輸入框、可編輯區、明確標示不拖的元素、可以橫向捲動的元素。
function exempt(target: HTMLElement, stopAt: HTMLElement) {
  if (
    target.closest("input, textarea, select, [contenteditable], .no-sheet-drag")
  )
    return true;
  for (
    let el: HTMLElement | null = target;
    el && el !== stopAt;
    el = el.parentElement
  ) {
    const overflow = getComputedStyle(el).overflowX;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      el.scrollWidth > el.clientWidth
    )
      return true;
  }
  return false;
}

// 抽屜手勢（參考 Google Maps）：
// - 把手與標題列：滑鼠、觸控都能拖整個抽屜；點把手切換停點。
// - 內容區（觸控／觸控筆）：抽屜不是全開時，往上拖先移動整個抽屜，到全開後同一次手勢接著捲內容；
//   全開時正常捲內容，捲到頂端再往下拖就改成拖動整個抽屜（同一次手勢內無縫交接）。
//   內容區設 touch-action: none，捲動由這裡用 scrollTop 接手（含放開後的慣性），
//   避免瀏覽器原生捲動搶走手勢（iOS Safari 的慣性與回彈也因此不會跟抽屜打架）。
// - 放開時依位置與速度吸附到停點，甩得快直接到全開或收起；減少動態效果時直接到位、不做慣性。
// - 滑鼠滾輪：不是全開時往下滾先展開到全開；全開且內容在頂端時往上滾收回半開；一次滾動只動一個停點。
export function useBottomSheet({
  enabled,
  heights,
  dragZone,
  initial = "half",
  scrollRef,
}: {
  /** 只在手機啟用；桌面不拖曳。 */
  enabled: boolean;
  heights: SheetHeights;
  /** 滑鼠也能按住拖曳的區域（把手以外，例如標題列）。 */
  dragZone: string;
  initial?: SheetStop;
  /** 抽屜裡的捲動內容區。 */
  scrollRef?: RefObject<HTMLElement | null>;
}) {
  const [stop, setStop] = useState<SheetStop>(initial);
  const [dragPx, setDragPx] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{
    id: number;
    startY: number;
    lastY: number;
    sheet: number;
    active: boolean;
    sheetMoved: boolean;
    onHandle: boolean;
    /** 只能拖抽屜（把手、標題列、滑鼠），不捲內容。 */
    sheetOnly: boolean;
    phase: "sheet" | "content";
    samples: { t: number; y: number }[];
  } | null>(null);
  const momentum = useRef(0);
  const px = dragPx ?? heights[stop];
  const latest = useRef({ heights, stop, enabled });
  latest.current = { heights, stop, enabled };
  // 全開時點把手回半開；收起只靠往下拖。
  const cycle = () =>
    setStop((d) =>
      d === "collapsed" ? "half" : d === "half" ? "full" : "half",
    );
  const stopMomentum = () => cancelAnimationFrame(momentum.current);
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const target = e.target as HTMLElement;
    const inHead = Boolean(target.closest(`.mx-handle-wrap, ${dragZone}`));
    const touch = e.pointerType !== "mouse";
    if (!inHead && (!touch || exempt(target, e.currentTarget))) return;
    // 標題列裡的按鈕與連結（例如結束導航）照常點，不從那裡開始拖。
    const control = target.closest("button, a, input, select, label");
    if (inHead && control && !control.classList.contains("mx-handle")) return;
    stopMomentum();
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      sheet: px,
      active: false,
      sheetMoved: false,
      onHandle: Boolean(target.closest(".mx-handle-wrap")),
      sheetOnly: inHead || !touch,
      phase: "sheet",
      samples: [{ t: e.timeStamp, y: e.clientY }],
    };
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    if (!d.active) {
      if (Math.abs(e.clientY - d.startY) < DRAG_SLOP) return;
      // 從按下的位置算起（不丟掉門檻內那幾 px），抽屜才會貼著手指走。
      d.active = true;
      try {
        e.currentTarget.setPointerCapture(d.id);
      } catch {
        /* 有些瀏覽器在指標已放開時會丟例外，拖曳照樣可用。 */
      }
    }
    const { heights: h } = latest.current;
    const scroller = d.sheetOnly ? null : scrollRef?.current;
    let delta = d.lastY - e.clientY; // 正＝手指往上
    d.lastY = e.clientY;
    d.samples.push({ t: e.timeStamp, y: e.clientY });
    if (d.samples.length > 20) d.samples.shift();
    let sheet = d.sheet;
    if (delta > 0) {
      // 往上：先把抽屜拉高，到全開後剩下的距離捲內容。
      const room = h.full - sheet;
      const used = Math.min(room, delta);
      sheet += used;
      delta -= used;
      if (used > 0) d.phase = "sheet";
      if (delta > 0 && scroller) {
        scroller.scrollTop += delta;
        d.phase = "content";
      }
    } else if (delta < 0) {
      // 往下：內容不在頂端就先捲回去，到頂端後剩下的距離把抽屜往下拉。
      let down = -delta;
      if (scroller && scroller.scrollTop > 0) {
        const used = Math.min(scroller.scrollTop, down);
        scroller.scrollTop -= used;
        down -= used;
        d.phase = "content";
      }
      if (down > 0) {
        sheet = Math.max(h.collapsed, sheet - down);
        d.phase = "sheet";
      }
    }
    if (sheet !== d.sheet) {
      d.sheet = sheet;
      d.sheetMoved = true;
      setDragPx(sheet);
    }
  };
  const onPointerEnd = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.active) {
      if (e.type !== "pointerup") return;
      if (d.onHandle) cycle();
      else if (d.sheetOnly && stop === "collapsed") setStop("half");
      return;
    }
    // 拖過了：吞掉這次放開後的 click（清單列、按鈕不會被誤觸）。
    const panel = e.currentTarget;
    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    panel.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(
      () => panel.removeEventListener("click", swallow, { capture: true }),
      400,
    );
    // 放開前 100ms 內的平均速度（px/ms，正＝往上）；停住再放開就是 0。
    d.samples.push({ t: e.timeStamp, y: e.clientY });
    const last = d.samples[d.samples.length - 1];
    const recent = d.samples.filter((p) => p.t >= last.t - 100);
    const first = recent[0];
    const dt = last.t - first.t;
    const velocity =
      e.type === "pointerup" && dt > 0 ? (first.y - last.y) / dt : 0;
    const { heights: h } = latest.current;
    if (d.sheetMoved) {
      let next: SheetStop;
      if (velocity > FLICK)
        next = d.sheet >= h.half - 1 || velocity > FAST_FLICK ? "full" : "half";
      else if (velocity < -FLICK)
        next =
          d.sheet <= h.half + 1 || velocity < -FAST_FLICK
            ? "collapsed"
            : "half";
      else
        next = sheetOrder.reduce((a, b) =>
          Math.abs(h[b] - d.sheet) < Math.abs(h[a] - d.sheet) ? b : a,
        );
      setStop(next);
      setDragPx(null);
    }
    // 放開時還在捲內容：照速度做一段慣性（減少動態效果時不做）。
    const scroller = scrollRef?.current;
    if (
      d.phase === "content" &&
      scroller &&
      !reducedMotion() &&
      Math.abs(velocity) > 0.05
    ) {
      let v = velocity * 16; // 每格位移
      const step = () => {
        scroller.scrollTop += v;
        v *= 0.95;
        if (Math.abs(v) > 0.5) momentum.current = requestAnimationFrame(step);
      };
      momentum.current = requestAnimationFrame(step);
    }
  };
  // 滑鼠滾輪／觸控板（窄視窗桌機）：React 的 wheel 是 passive，改掛原生監聽才能 preventDefault。
  useEffect(() => {
    const panel = panelRef.current;
    if (!enabled || !panel) return;
    let quietUntil = 0;
    const wheel = (event: WheelEvent) => {
      const now = performance.now();
      if (now < quietUntil) {
        // 同一次滾動的後續事件：延長安靜期，不再換停點，也不捲內容。
        quietUntil = now + WHEEL_QUIET_MS;
        event.preventDefault();
        return;
      }
      const { stop: current } = latest.current;
      const scroller = scrollRef?.current;
      if (event.deltaY > 0 && current !== "full") {
        event.preventDefault();
        setStop("full");
        quietUntil = now + WHEEL_QUIET_MS;
      } else if (
        event.deltaY < 0 &&
        current === "full" &&
        (!scroller || scroller.scrollTop <= 0)
      ) {
        event.preventDefault();
        setStop("half");
        quietUntil = now + WHEEL_QUIET_MS;
      }
    };
    panel.addEventListener("wheel", wheel, { passive: false });
    return () => panel.removeEventListener("wheel", wheel);
  }, [enabled, scrollRef]);
  useEffect(() => stopMomentum, []);
  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = sheetOrder.indexOf(stop);
    if (e.key === "ArrowUp" && i < 2) {
      e.preventDefault();
      setStop(sheetOrder[i + 1]);
    } else if (e.key === "ArrowDown" && i > 0) {
      e.preventDefault();
      setStop(sheetOrder[i - 1]);
    }
  };
  return {
    stop,
    setStop,
    /** 目前高度（拖曳中為手指位置，否則為停點高度）。 */
    px,
    dragging: dragPx !== null,
    /** 停在收起（不是拖曳中）：內容不可操作。 */
    collapsed: enabled && stop === "collapsed" && dragPx === null,
    panelProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
    handleProps: { stop, onCycle: cycle, onKeyDown: onHandleKey },
    /** 掛在抽屜外框上（滾輪監聽用）。 */
    panelRef,
  };
}

// 抽屜把手：拖曳或點一下切換，上下鍵調整。滑鼠／觸控的點擊由 pointerup 處理，
// 這裡只接鍵盤（detail 0）觸發的 click。
export const SheetHandle = forwardRef<
  HTMLDivElement,
  {
    stop: SheetStop;
    onCycle: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  }
>(function SheetHandle({ stop, onCycle, onKeyDown }, ref) {
  return (
    <div className="mx-handle-wrap" ref={ref}>
      <button
        type="button"
        className="mx-handle"
        aria-label={`面板高度：${sheetNames[stop]}。按一下切換，或用上下鍵調整`}
        onClick={(e) => {
          if (e.detail === 0) onCycle();
        }}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
});
