import { useDemoData } from "../../data/demoMode";
import {
  wasteName,
  wasteHref,
  type WasteControls,
  type WasteType,
} from "../../data/waste";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  allPages,
  apiBinState,
  apiCompartments,
  query,
  type ApiCompartment,
  type ApiLocation,
  type Proposal,
} from "../../data/api";
import { stateLabels, usableCount } from "../../data/binState";
import { stateVisual } from "../binVisual";
import type { LocationRecord } from "../../data/locations";
import { LocationMap } from "../../map/LocationMap";
import { proposedBinSvg } from "../../map/binBot";
import {
  type ProposalTally,
  browseMarkerDescription,
  browseMarkerIcon,
  browseMarkerLabel,
  isProposed,
  landmarkSvg,
  usableFor,
  wasteState,
} from "../../map/browseMarkers";
import { Mascot } from "../Mascot";
import { WasteIcon, WastePicker } from "../WasteType";
import { FillBar } from "../StationCard";
import { LoadState } from "./LoadState";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { ORIGIN, Status } from "./mapShared";
import { BinPanel } from "./BinPage";
import { PlacePanel } from "./PlacePanel";
import { consumeJustClaimed, type ClaimControls } from "./ClaimStep";
import { useMyClaims } from "./useMyClaims";
import { NameTag } from "../Pixel";
import {
  MOBILE_QUERY,
  SheetHandle,
  useBottomSheet,
  useMediaQuery,
  type SheetStop,
} from "../useBottomSheet";

// ── 地圖瀏覽模式 ─────────────────────────────────────────────────────
// 手機：地圖滿版＋下方抽屜（收起／半開／全開）；桌面：左側面板＋右側地圖。
// 面板未選桶時是「附近的桶」清單；選桶（#bin/<id>）或地標（#map?place=<id>）
// 時原地顯示資訊（手機仍是底部抽屜，地圖留在上方），地圖飛到選取點；
// 點地圖空白處或按 Esc 回清單。資料流照原本：/map/locations 全部分頁讀完、?waste_type=
// 決定看哪一槽。清單列、篩選膠囊、狀態膠囊、圖例都沿用既有元件。

type Filter = "all" | "usable" | "new";
const filters: [Filter, string][] = [
  ["all", "全部"],
  ["usable", "還能丟"],
  ["new", "新設"],
];
const SEARCH_DELAY_MS = 300;
const originMarker = { ...ORIGIN, label: "起點" };
const initialCenter: [number, number] = [ORIGIN.latitude, ORIGIN.longitude];

function distanceText(item: ApiLocation) {
  if (item.distance_m == null) return "距離未知";
  return item.distance_m < 1000
    ? `${Math.round(item.distance_m)} 公尺`
    : `${(item.distance_m / 1000).toFixed(1)} 公里`;
}
function walkText(item: ApiLocation) {
  return item.walking_estimate_seconds == null
    ? null
    : `步行 ${Math.max(1, Math.round(item.walking_estimate_seconds / 60))} 分鐘`;
}
// 建議點標記與清單列用的票數（status 讓關票後的標記改寫結果）。
function tallyOf(item: Proposal): ProposalTally {
  return { support: item.support, oppose: item.oppose, status: item.status };
}
// 換種類只換網址參數，不多一筆瀏覽紀錄（返回鍵直接回上一個畫面）。
function replaceWaste(value: WasteType) {
  window.location.replace(
    wasteHref(window.location.hash.slice(1) || "map", value),
  );
}

export function MapPage({
  wasteType,
  binId,
  placeId,
  voting = false,
}: WasteControls & { binId?: string; placeId?: string; voting?: boolean }) {
  const { session } = useSession();
  const [filter, setFilter] = useState<Filter>("all");
  const [voteNotice, setVoteNotice] = useState("");
  useEffect(() => {
    setFilter("all");
    setQ("");
    setSearch("");
  }, [voting]);
  const [q, setQ] = useState("");
  // 預設只拿後端保留的近七日撤除標記；勾選後查詢全部撤除紀錄。
  const [includeRemoved, setIncludeRemoved] = useState(false);
  // 搜尋停止輸入 300ms 後才送出；換字時 useApi 會取消上一個讀取。
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(q), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [q]);
  const [binLocation, setBinLocation] = useState<ApiLocation | null>(null);
  const mobile = useMediaQuery(MOBILE_QUERY);
  // 自己認領的 BinU：地圖標記腳下、清單列都掛名牌（愛心＋名字）。
  const mine = useMyClaims().names;
  // 認領步驟（ClaimStep）：在桶詳情抽屜裡原地打開；名字草稿跟著這個桶，
  // 取消、Esc、點地圖空白都只退回桶詳情，草稿保留，換桶才清掉。
  const [claimDraft, setClaimDraft] = useState<{
    binId: string;
    open: boolean;
    draft: string;
  } | null>(null);
  const claimOpen = !!binId && claimDraft?.binId === binId && claimDraft.open;
  const closeClaim = useCallback(
    () => setClaimDraft((old) => old && { ...old, open: false }),
    [],
  );
  const claim: ClaimControls | undefined = binId
    ? {
        open: claimOpen,
        draft: claimDraft?.binId === binId ? claimDraft.draft : "",
        setDraft: (draft) => setClaimDraft({ binId, open: true, draft }),
        start: () =>
          setClaimDraft((old) => ({
            binId,
            open: true,
            draft: old?.binId === binId ? old.draft : "",
          })),
        cancel: closeClaim,
        done: () => setClaimDraft(null),
      }
    : undefined;
  // 全台北市一次讀完（district=all，後端可接受），建議點也一起讀，前端再依篩選分：
  // 「還能丟」看所選種類那一槽；「新設」跟原本一樣交給後端 filter=new。
  const path = query("/map/locations", {
    waste_type: wasteType,
    district: "all",
    kind: "all",
    filter: filter === "new" ? "new" : "all",
    q: search,
    include_proposed: true,
    include_removed: includeRemoved,
    ...ORIGIN,
  });
  const list = useApi(
    `${path}/${voting ? "vote" : "map"}`,
    async (signal) => {
      const bins = await allPages<ApiLocation>(path, {
        signal,
        token: session?.access_token,
      });
      if (voting) {
        let proposals: Proposal[] = [];
        try {
          proposals = await allPages<Proposal>("/proposals?limit=100", {
            signal,
            token: session?.access_token,
          });
          signal.throwIfAborted();
          setVoteNotice("");
        } catch {
          signal.throwIfAborted();
          setVoteNotice("提案清單暫時無法取得，先顯示已載入的建議點。");
        }
        for (const item of proposals) {
          if (
            search.trim() &&
            !`${item.name} ${item.reason}`
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase())
          )
            continue;
          if (["installed", "declined"].includes(item.status)) continue;
          const existing = bins.find((b) => b.id === item.bin_id);
          if (existing) {
            Object.assign(existing, { proposalTally: tallyOf(item) });
            continue;
          }
          bins.push(
            Object.assign(
              {
                id: item.bin_id,
                kind: "bin",
                label: item.approved_name || item.name,
                district: item.district,
                latitude: item.latitude,
                longitude: item.longitude,
                address: null,
                note: "市民提案／待現勘，非已設置桶",
                source_type: "citizen_proposal",
                source_row: null,
                source_file: null,
                location_precision: null,
                reported_count: null,
                bin_type: "proposed",
                placement_status: "proposed",
                distance_m: null,
                walking_estimate_seconds: null,
                bin_status: null,
                compartments: [],
              } as ApiLocation,
              { proposalTally: tallyOf(item) },
            ),
          );
        }
      }
      return { data: bins, etag: null, replayed: false };
    },
    true,
    // 開著桶面板時暫停清單輪詢（用不到清單）；回到清單立刻重抓一次再恢復。
    { paused: Boolean(binId) },
  );
  const items = list.data;
  // 清單只列桶；選「建議點」時才列建議點。所選種類還能丟的排前面，其餘照後端距離順序。
  const rows = useMemo(() => {
    if (!items) return undefined;
    const bins = items.filter(
      (item) =>
        item.kind === "bin" &&
        (voting
          ? isProposed(item)
          : !isProposed(item) &&
            (filter !== "usable" || usableFor(item, wasteType))),
    );
    return bins
      .map((item, index) => ({ item, index, ok: usableFor(item, wasteType) }))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.index - b.index)
      .map(({ item }) => item);
  }, [items, filter, wasteType, voting]);
  const place =
    !binId && placeId
      ? (items?.find((item) => item.id === placeId && item.kind === "place") ??
        null)
      : null;
  // 開著桶面板時清單暫停輪詢；面板的 view 每次更新都帶最新桶況，
  // 拿它蓋過清單裡那一筆，地圖上這個桶的標記才會跟面板一致。
  const fresh = binId && binLocation?.id === binId ? binLocation : null;
  // 投票面板投完票時回報最新票數，建議點標記的「支持 N%」跟著更新（清單輪詢暫停中）。
  const [liveTally, setLiveTally] = useState<{
    id: string;
    tally: ProposalTally;
  } | null>(null);
  const onTally = useCallback(
    (tally: ProposalTally) => binId && setLiveTally({ id: binId, tally }),
    [binId],
  );
  const withFresh = useCallback(
    (item: ApiLocation) => {
      const next =
        fresh && item.id === fresh.id
          ? {
              ...item,
              bin_status: fresh.bin_status,
              compartments: fresh.compartments,
            }
          : item;
      return liveTally?.id === item.id
        ? { ...next, proposalTally: liveTally.tally }
        : next;
    },
    [fresh, liveTally],
  );
  const listed = binId ? items?.find((item) => item.id === binId) : undefined;
  const selected: ApiLocation | null = binId
    ? listed
      ? withFresh(listed)
      : fresh
    : place;
  // 地圖：「全部」顯示桶＋地標＋建議點；其他篩選只顯示清單上的點。選中的點一定顯示。
  const mapItems = useMemo(() => {
    const shown = (
      (voting
        ? rows
        : filter === "all"
          ? items?.filter((item) => !isProposed(item))
          : rows) ?? []
    ).map(withFresh);
    return selected && !shown.some((item) => item.id === selected.id)
      ? [...shown, selected]
      : shown;
  }, [items, rows, filter, selected, withFresh, voting]);
  // 選桶、選地標都寫進網址（push），瀏覽器返回鍵回到清單；選完把焦點移到面板標題。
  const pendingFocus = useRef<string | null>(null);
  const layoutRef = useRef<HTMLElement>(null);
  const focusTitle = useCallback((id: string) => {
    if (pendingFocus.current !== id) return;
    const title = layoutRef.current?.querySelector<HTMLElement>(
      ".mx-panel-body h1, .mx-panel-body h2",
    );
    if (!title) return;
    pendingFocus.current = null;
    title.setAttribute("tabindex", "-1");
    title.focus({ preventScroll: true });
  }, []);
  const select = useCallback(
    (item: LocationRecord) => {
      // 再點一次已選取的桶／地標不做任何事（焦點只在選取對象改變時移動一次）。
      if (item.id === (item.kind === "bin" ? binId : placeId)) return;
      pendingFocus.current = item.id;
      const fromList = !binId && !placeId;
      window.location.hash = (
        item.kind === "bin"
          ? wasteHref(
              `bin/${item.id}${voting || isProposed(item) ? "?tab=vote" : ""}`,
              wasteType,
            )
          : wasteHref(`map?place=${encodeURIComponent(item.id)}`, wasteType)
      ).slice(1);
      // 記在這筆瀏覽紀錄上：上一筆就是清單，關閉詳情時直接回上一頁。
      if (fromList) history.replaceState({ mxFromList: true }, "");
    },
    [wasteType, binId, placeId, voting],
  );
  const binLoaded = useCallback(
    (location: ApiLocation) => {
      setBinLocation(location);
      if (isProposed(location) && !voting) {
        window.location.replace(
          wasteHref(`bin/${location.id}?tab=vote`, wasteType),
        );
      }
      focusTitle(location.id);
    },
    [focusTitle, voting, wasteType],
  );
  useEffect(() => {
    if (place) focusTitle(place.id);
  }, [place?.id, focusTitle]);
  const iconFor = useCallback(
    (location: LocationRecord, active: boolean) =>
      browseMarkerIcon(
        location,
        active,
        wasteType,
        (location as LocationRecord & { proposalTally?: ProposalTally })
          .proposalTally,
        mine.get(location.id),
      ),
    [wasteType, mine],
  );
  const markerLabel = useCallback(
    (location: LocationRecord) =>
      mine.has(location.id)
        ? `${browseMarkerLabel(location)}（你的 BinU）`
        : browseMarkerLabel(location),
    [mine],
  );

  // ── 抽屜（只在手機） ──
  const toolbarRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ layout: 0, head: 0, toolbar: 0 });
  const [focusKey, setFocusKey] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const next = {
        layout: layoutRef.current?.clientHeight ?? 0,
        toolbar: toolbarRef.current?.offsetHeight ?? 0,
        head:
          (handleRef.current?.offsetHeight ?? 0) +
          (headRef.current?.offsetHeight ?? 0),
      };
      setDims((previous) =>
        previous.layout === next.layout &&
        previous.head === next.head &&
        previous.toolbar === next.toolbar
          ? previous
          : next,
      );
    };
    measure();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    for (const ref of [layoutRef, handleRef, headRef, toolbarRef])
      if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [mobile, voting, binId, placeId]);
  const showingBallot = !!binId && !!selected && isProposed(selected);
  // 半開高度：清單 42%（最高 300px）；桶詳情 50%、投票面板 55%，都不設 300px 上限，
  // 半開時就看得到標題、兩槽卡與底部固定的「導航過去／回報問題」。
  // 地圖的選取位移（focusOffsetY）由這個實際高度算出，桶落在抽屜上方可見區的正中間。
  const showingBinDetail = !!binId && !showingBallot;
  const heights = useMemo(() => {
    const full = Math.max(
      dims.head,
      dims.layout - (dims.toolbar ? dims.toolbar + 24 : 12),
    );
    // 桶詳情半開 50%；投票面板 55%（標題、儀表、說明句與兩顆投票鈕都要在半開時看得到，
    // 0 票時多一句「還沒有人投票」）；兩者都不設 300px 上限。
    const half = showingBinDetail
      ? Math.round(dims.layout * 0.5)
      : showingBallot
        ? Math.round(dims.layout * 0.55)
        : Math.min(300, Math.round(dims.layout * 0.42));
    return {
      collapsed: dims.head,
      half: Math.min(full, Math.max(dims.head, half)),
      full,
    };
  }, [dims, showingBallot, showingBinDetail]);
  // 拖曳、把手與鍵盤操作共用 useBottomSheet（步行導航頁也用同一套）。
  const bodyRef = useRef<HTMLDivElement>(null);
  const sheet = useBottomSheet({
    enabled: mobile,
    heights,
    dragZone: ".mx-panel-head",
    scrollRef: bodyRef,
  });
  const { stop: drawer, setStop: setDrawer, px: drawerPx } = sheet;
  // 選了桶或地標：抽屜一律回半開（全開時地圖幾乎被蓋住，收起時看不到資訊）。
  useEffect(() => {
    if (binId || placeId) setDrawer("half");
  }, [binId, placeId]);
  // 從全開回到半開時，把目前選取重新置中到抽屜上方的可見區。
  const previousDrawer = useRef<SheetStop>(drawer);
  useEffect(() => {
    if (previousDrawer.current === "full" && drawer === "half")
      setFocusKey((k) => k + 1);
    previousDrawer.current = drawer;
  }, [drawer]);
  const collapsed = sheet.collapsed;
  // 選取一律在半開時置中，所以位移固定用半開高度的一半。
  const focusOffsetY = mobile ? Math.round(heights.half / 2) : 0;
  // 目前看得到的地圖區中心（手機：扣掉目前停點的抽屜，清單畫面再扣掉頂部搜尋工具列；
  // 工具列離地圖頂 8px）。點聚合桶放大時用。
  const viewOffsetY = mobile
    ? Math.round(
        (heights[drawer] -
          (binId || placeId || !dims.toolbar ? 0 : dims.toolbar + 8)) /
          2,
      )
    : 0;
  const style = mobile
    ? ({
        "--mx-drawer-h": `${drawerPx}px`,
        "--mx-toolbar-h": `${dims.toolbar}px`,
      } as CSSProperties)
    : undefined;
  const resetFilters = () => {
    setQ("");
    setSearch("");
    setFilter("all");
  };
  const view = binId ? "bin" : place ? "place" : "list";
  const listHref = wasteHref(voting ? "vote" : "map", wasteType);
  // 關閉桶／地標詳情回清單（取代原本的「← 返回清單」連結）：上一筆瀏覽紀錄是
  // 清單時回上一頁，不多疊一筆；深連結或桶換桶之後則照原連結改網址（保留 ?waste_type=）。
  // 返回是非同步的：畫面換掉之前再呼叫一次（例如連按 Esc）不做事，免得連退兩格離開 app。
  const closing = useRef(false);
  useEffect(() => {
    closing.current = false;
  }, [view, binId, placeId]);
  const closeDetail = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if ((history.state as { mxFromList?: boolean } | null)?.mxFromList)
      history.back();
    else window.location.hash = listHref.slice(1);
  }, [listHref]);
  // Esc 關閉詳情（側邊選單等自己處理 Esc 的元件會先 preventDefault，所以掛在 window）。
  // 焦點原本在面板裡時，回清單後把焦點放回原本那一列；焦點在標記上就留在標記。
  const restoreRow = useRef<string | null>(null);
  // 剛看過的桶：回到清單時那一列標 active＋aria-current（配色 v4 的清單選中列）。
  const [lastViewed, setLastViewed] = useState<string | null>(null);
  useEffect(() => {
    if (binId) setLastViewed(binId);
  }, [binId]);
  useEffect(() => {
    if (view === "list") return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // 取名步驟開著：Esc 只退回桶詳情（草稿保留）。
      if (claimOpen) {
        closeClaim();
        return;
      }
      const active = document.activeElement;
      restoreRow.current =
        binId &&
        (!active || active === document.body || active.closest(".mx-panel"))
          ? binId
          : null;
      closeDetail();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [view, binId, closeDetail, claimOpen, closeClaim]);
  // 取名步驟開／關：抽屜捲回頂端；退回桶詳情時焦點回到標題（打開時焦點由名字欄自己拿）。
  const wasClaiming = useRef(false);
  // 剛認領成功（只有 active 才有旗標）：內容區換成桶詳情時播一次進場轉場（swapKey）
  // ＋地圖標記慶祝（celebration）。旗標在這個 layout effect 讀取、存進 state，
  // StrictMode 重跑 effect 不會吃掉；不延遲 claim.done()，內容照常在 t0 換成桶詳情，抽屜本身不動。
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    id: string;
    key: number;
    at: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (wasClaiming.current === claimOpen) return;
    wasClaiming.current = claimOpen;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (claimOpen) {
      setSwapKey(null);
      return;
    }
    if (binId && consumeJustClaimed(binId)) {
      const at = Date.now();
      // 沒有減少動態效果時才標記（reduce 時不播，也不留 class 等之後切換設定才重播）。
      if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches)
        setSwapKey(`bin/${binId}`);
      setCelebration({ id: binId, key: at, at });
    }
    const title =
      layoutRef.current?.querySelector<HTMLElement>(".mx-panel-body h1");
    title?.setAttribute("tabindex", "-1");
    title?.focus({ preventScroll: true });
  }, [claimOpen]);
  // 詳情最上面的「回到清單」按鈕（讀屏與鍵盤用）：按了回清單，焦點放回原本那一列。
  const closeFromPanel = () => {
    restoreRow.current = binId ?? null;
    closeDetail();
  };
  useEffect(() => {
    const id = restoreRow.current;
    if (view !== "list" || !id || !rows) return;
    restoreRow.current = null;
    layoutRef.current
      ?.querySelector<HTMLElement>(`.location-row[data-id="${CSS.escape(id)}"]`)
      ?.focus();
  }, [view, rows]);
  // 面板內容換畫面（清單 ⇄ 詳情、桶換桶）：內容以 key 重建、播淡入；詳情從頂端開始，
  // 回到清單時捲回原本的位置。
  const contentKey =
    view === "bin"
      ? `bin/${binId}`
      : view === "place"
        ? `place/${placeId}`
        : "list";
  const listScroll = useRef(0);
  const shownContent = useRef(contentKey);
  useLayoutEffect(() => {
    if (shownContent.current === contentKey) return;
    shownContent.current = contentKey;
    if (bodyRef.current)
      bodyRef.current.scrollTop = view === "list" ? listScroll.current : 0;
  }, [contentKey, view]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const controls =
    view === "list" && !voting ? (
      <div
        ref={toolbarRef}
        className="mx-home-toolbar"
        aria-label="地圖搜尋與篩選"
      >
        <div className="mx-home-controls">
          <label className="search-field">
            <span className="visually-hidden">搜尋地點</span>
            <input
              type="search"
              aria-label="搜尋地點"
              placeholder="搜尋路名、地點⋯"
              maxLength={200}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {!voting && (
            <WastePicker
              name="map-waste"
              legend="垃圾種類"
              iconOnly
              value={wasteType}
              onChange={replaceWaste}
            />
          )}
          <button
            type="button"
            className="mx-filter-toggle"
            aria-label="篩選桶況"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 17h16M9 4v6m6 4v6" />
            </svg>
          </button>
          <div
            className="filter-chips"
            role="group"
            aria-label="篩選"
            hidden={!filtersOpen}
          >
            {(voting ? [] : filters).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <main
      className={`mx-layout px-map ${view === "list" && !voting ? "mx-home" : ""}`}
      ref={layoutRef}
      style={style}
      data-drawer={mobile ? drawer : undefined}
      data-voting={voting || undefined}
    >
      {controls}
      <section
        className={`mx-panel${sheet.dragging ? " dragging" : ""}`}
        aria-label="資訊面板"
        data-view={view}
        data-ballot={showingBallot || undefined}
        ref={sheet.panelRef}
        {...sheet.panelProps}
      >
        <SheetHandle ref={handleRef} {...sheet.handleProps} />
        {/* 詳情不放「← 返回清單」：點地圖空白處或按 Esc 回清單，標題列只在清單出現。 */}
        {view === "list" && (
          <div className="mx-panel-head" ref={headRef}>
            <div className="mx-head-title">
              <h1 className="mx-title">{voting ? "設桶投票" : "附近的桶"}</h1>
              {voting && (
                <span className="tiny">
                  {rows ? `${rows.length} 個建議點 · 待現勘` : "—"}
                </span>
              )}
            </div>
          </div>
        )}
        <div
          className="mx-panel-body"
          ref={bodyRef}
          inert={collapsed}
          onScroll={(e) => {
            if (view === "list") listScroll.current = e.currentTarget.scrollTop;
          }}
        >
          <div
            className={`mx-panel-content${swapKey === contentKey ? " swapped" : ""}`}
            key={contentKey}
            onAnimationEnd={(e) => {
              if (
                e.target === e.currentTarget &&
                e.animationName === "mx-sheet-swap"
              )
                setSwapKey(null);
            }}
          >
            {/* 桶詳情（含投票面板）與場所詳情都沒有看得到的關閉鈕：放一顆平常隱藏、
                鍵盤聚焦才出現的「回到清單」，讀屏使用者不必靠瀏覽器返回鍵。 */}
            {view !== "list" && (
              <button
                type="button"
                className="text-button mx-close-detail"
                onClick={closeFromPanel}
              >
                回到清單
              </button>
            )}
            {view === "bin" ? (
              <BinPanel
                key={`${binId}/${wasteType}`}
                id={binId!}
                wasteType={wasteType}
                label={listed?.label}
                onLocation={binLoaded}
                onTally={onTally}
                claim={claim}
              />
            ) : view === "place" ? (
              <PlacePanel location={place!} />
            ) : (
              <>
                <LoadState {...list} />
                {voting && voteNotice && <p role="status">{voteNotice}</p>}
                {rows && rows.length > 0 && (
                  <ul
                    className="mx-list"
                    aria-label={voting ? "建議設置點" : "附近的桶"}
                  >
                    {rows.map((item) => (
                      <li key={item.id}>
                        <NearbyRow
                          item={item}
                          wasteType={wasteType}
                          onSelect={select}
                          active={item.id === lastViewed}
                          mine={mine.get(item.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {rows?.length === 0 && (
                  <div className="mx-empty">
                    <p>
                      {voting ? "目前沒有符合的建議點。" : "找不到符合的桶。"}
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={resetFilters}
                    >
                      清除搜尋與篩選
                    </button>
                  </div>
                )}
                {/* 進階查詢放在清單下方：不佔半開抽屜裡篩選與第一列之間的高度。 */}
                {!voting && (
                  <div className="mx-removed">
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={includeRemoved}
                        onChange={(e) => setIncludeRemoved(e.target.checked)}
                      />
                      包含所有撤除紀錄
                    </label>
                    <p className="tiny">
                      預設顯示後端保留的近七日撤除標記；勾選後查詢全部撤除紀錄。
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
      <div className="mx-map">
        <LocationMap
          locations={mapItems}
          selected={selected}
          onSelect={select}
          initialCenter={initialCenter}
          fitKey={search.trim() || undefined}
          markerIcon={iconFor}
          markerLabel={markerLabel}
          markerDescription={browseMarkerDescription}
          origin={originMarker}
          focusOffsetY={focusOffsetY}
          viewOffsetY={viewOffsetY}
          focusKey={focusKey}
          celebrate={
            celebration
              ? {
                  ...celebration,
                  // 抽屜實際蓋住的區域：抽屜本身不動；手機的高度有過場，
                  // 所以取「目前的位置」與「停點高度的位置」中較高的上緣。
                  obstruction: () => {
                    const layout = layoutRef.current?.getBoundingClientRect();
                    const panel = layoutRef.current
                      ?.querySelector(".mx-panel")
                      ?.getBoundingClientRect();
                    if (!layout || !panel) return null;
                    const top = mobile
                      ? Math.min(panel.top, layout.bottom - drawerPx)
                      : panel.top;
                    return new DOMRect(
                      panel.left,
                      top,
                      panel.width,
                      panel.bottom - top,
                    );
                  },
                }
              : undefined
          }
          onBackgroundTap={
            view === "list" ? undefined : claimOpen ? closeClaim : closeDetail
          }
        />
      </div>
    </main>
  );
}

// 清單列沿用 .location-row：BinU（所選種類那一槽的狀態）、桶名（新設時旁邊
// 一顆「新設」膠囊）、距離，下一行兩槽滿度條並排（所選種類在左），右側兩槽可丟數。
function NearbyRow({
  item,
  wasteType,
  onSelect,
  active = false,
  mine,
}: {
  item: ApiLocation;
  wasteType: WasteType;
  onSelect: (item: LocationRecord) => void;
  /** 從詳情回清單時，剛看過的那一列（左側橘線、aria-current）。 */
  active?: boolean;
  /** 自己認領的 BinU：桶名換成名牌（愛心＋名字）。 */
  mine?: string;
}) {
  const proposed = isProposed(item);
  const removed = item.bin_status?.operational_status === "removed";
  const state = proposed ? "offline" : wasteState(item, wasteType);
  const parts = apiCompartments(item.bin_status, item.compartments);
  const usable = usableCount(parts.map((c) => ({ state: apiBinState(c) })));
  // 全部失聯時「可丟 0/2」不是吃飽了，用中性色。
  const allOffline =
    parts.length > 0 && parts.every((c) => apiBinState(c) === "offline");
  const walk = walkText(item);
  return (
    <button
      type="button"
      className={`location-row${active ? " active" : ""}`}
      aria-current={active ? "true" : undefined}
      data-id={item.id}
      onClick={() => onSelect(item)}
    >
      {proposed ? (
        // 建議點：跟地圖 M3 標記同一個虛線外框＋「＋」。
        <span className="row-buddy mx-proposed-row" aria-hidden="true">
          <span dangerouslySetInnerHTML={{ __html: proposedBinSvg() }} />
          <span className="mx-proposed-plus">＋</span>
        </span>
      ) : (
        <span className={`row-buddy ${stateVisual[state].className}`}>
          <Mascot state={state} />
        </span>
      )}
      <span className="row-copy">
        <span className="mx-row-title">
          <strong>{mine ? <NameTag name={mine} /> : item.label}</strong>
          {!proposed && item.bin_status?.is_new && (
            <span className="status-pill">新設</span>
          )}
        </span>
        <small>
          {distanceText(item)}
          {walk && ` · ${walk}`}
        </small>
        {proposed ? (
          <small>建議點／待現勘，尚未設置</small>
        ) : removed ? (
          // 整個點位已撤除：一顆狀態膠囊（含撤除說明），不再列兩槽滿度條。
          <span className="mx-row-status">
            <Status status={item.bin_status} />
          </span>
        ) : (
          <span className="mx-slots">
            {parts.map((part) => (
              <SlotBar key={part.waste_type} part={part} />
            ))}
          </span>
        )}
      </span>
      {!proposed && !removed && (
        <span
          className={`mx-usable ${allOffline ? "state-offline" : usable === 0 ? "state-full" : "state-hungry"}`}
        >
          <small>可丟</small>
          <span className="numeral-sm">
            {usable}/{parts.length}
          </span>
        </span>
      )}
    </button>
  );
}

// 清單列裡的一槽：種類圖示＋短滿度條（沿用 StationCard 的 FillBar）＋百分比。
// 不寫「餓了／吃飽了」；失聯／維修／撤除不放百分比，改虛線空條加狀態字。
// 無障礙名稱寫完整，例如「一般垃圾，吃飽了，92%」。
function SlotBar({ part }: { part: ApiCompartment }) {
  const state = apiBinState(part);
  const word =
    part.operational_status === "removed"
      ? "已撤除"
      : part.operational_status === "repair"
        ? "維修中"
        : stateLabels.offline;
  const pct = state === "offline" ? null : part.fill_level_pct;
  const label = `${wasteName(part.waste_type)}，${state === "offline" ? word : stateLabels[state]}${pct === null ? "" : `，${pct}%`}`;
  return (
    <span
      className={`mx-slot ${stateVisual[state].className}`}
      role="img"
      aria-label={label}
    >
      <WasteIcon type={part.waste_type} />
      <FillBar
        c={{
          wasteType: part.waste_type,
          state,
          pct,
          statusText: label,
        }}
      />
      <span className="mx-slot-value" aria-hidden="true">
        {pct === null ? word : `${pct}%`}
      </span>
    </span>
  );
}

// 圖例：桶況三態＋場所代表點（失聯一定有虛線外框）。
// 地圖瀏覽模式另外傳 wasteType（標題「依〈種類〉」）、landmarks（地標旗子＋建議點，
// 取代場所代表點色塊）、stacked（直式排列，放進圖例 popover）。
export function MapLegend({
  wasteType,
  landmarks = false,
  stacked = false,
}: {
  wasteType?: WasteType;
  landmarks?: boolean;
  stacked?: boolean;
} = {}) {
  return (
    <div className={`map-legend${stacked ? " stacked" : ""}`} aria-label="圖例">
      {wasteType && (
        <span className="map-legend-title">依{wasteName(wasteType)}</span>
      )}
      <span>
        <i className="legend-swatch state-hungry" />
        {stateLabels.hungry}
        <small>0–79%</small>
      </span>
      <span>
        <i className="legend-swatch state-full" />
        {stateLabels.full}
        <small>80%+</small>
      </span>
      <span>
        <i className="legend-swatch state-offline" />
        {landmarks ? "失聯／維修／撤除" : stateLabels.offline}
      </span>
      {landmarks ? (
        <>
          <span>
            <i
              className="map-legend-flag"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: landmarkSvg }}
            />
            地標
          </span>
          <span>
            <i className="map-legend-proposed" aria-hidden="true">
              ＋
            </i>
            建議點
          </span>
        </>
      ) : (
        <span>
          <i className="legend-swatch place" />
          場所代表點
        </span>
      )}
    </div>
  );
}

// 地圖右上角的圖例按鈕（沿用 .menu-button 圖示按鈕）＋按鈕下方的 popover。
// 預設收起；點外面、按 Esc、再點一次按鈕都會關閉，Esc 與按鈕關閉後焦點回到按鈕。
// 面板換畫面（選桶／地標／回清單）或焦點離開圖例時也會關閉。
