import { StaffApp, HonorPage } from "../../src/components/staff/StaffApp";
import {
  latestCleanup,
  submitCitizenReport,
  reportEventOpen,
} from "../../src/data/workOrders";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  districts,
  filterLocations,
  kindLabel,
  locations,
  type LocationKind,
  type LocationRecord,
} from "../../src/data/locations";
import {
  binDemo,
  binFilters,
  demoDistance,
  distanceLabel,
  matchesBinFilter,
  stateLabels,
  isUsableBin,
  walkingMinutes,
  lifecycleLabel,
  type BinFilter,
} from "../../src/data/binDemo";
import {
  availablePoints,
  redeemReward,
  rewardStock,
  reportingSuspended,
  useDemoStore,
} from "../../src/data/demoStore";
import { emptyDraft, type ReportDraft } from "../../src/data/reports";
import { DemoLocationMap as LocationMap } from "../../src/map/DemoLocationMap";
import { Mascot } from "../../src/components/Mascot";
import { AppNav } from "../../src/components/AppNav";
import { MapLegend } from "../../src/components/api/MapPage";
import { stateVisual } from "../../src/components/binVisual";
import { Icon } from "../../src/components/Icon";
import { LocationDetails } from "../../src/components/LocationDetails";
import { NavigationPage } from "../../src/components/NavigationPage";
import { BinDetail } from "../../src/components/BinDetail";
import { LoginPage } from "../../src/components/LoginPage";
import { ReportPage } from "../../src/components/ReportPage";
import { ReportDone } from "../../src/components/ReportDone";
import { MemberPage } from "../../src/components/MemberPage";
import { ReviewPage } from "../../src/components/ReviewPage";
import { RewardsPage } from "../../src/components/RewardsPage";
import {
  adopterName,
  loadParticipationState,
  isAdopter,
  useParticipationStore,
} from "../../src/data/participation";
import { AdoptionPage } from "../../src/components/AdoptionPage";
import { ParticipationPage } from "../../src/components/ParticipationPage";
import type { Reward } from "../../src/data/rewards";

export default function App() {
  const [route, setRoute] = useState(
    () => window.location.hash.slice(1) || "map",
  );
  const [district, setDistrict] = useState("大安區");
  const [kind, setKind] = useState<"all" | LocationKind>("bin");
  const [filter, setFilter] = useState<BinFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LocationRecord | null>(null);
  const [notice, setNotice] = useState("");
  const { state, setState, storageFailed, storageError } = useDemoStore();
  const participation = useParticipationStore();
  const [drafts, setDrafts] = useState<Record<string, ReportDraft>>({});
  const submitting = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      setRoute(window.location.hash.slice(1) || "map");
      setNotice("");
      submitting.current = false;
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    const heading = mainRef.current?.querySelector<HTMLElement>("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [route]);
  const visible = useMemo(
    () =>
      filterLocations(district, kind)
        .filter(
          (location) =>
            matchesBinFilter(
              location,
              filter,
              participation.state.removedBinIds,
              state,
            ) &&
            `${location.label} ${location.district} ${location.address || ""}`.includes(
              query.trim(),
            ),
        )
        .sort((a, b) => demoDistance(a) - demoDistance(b)),
    [district, kind, filter, query, participation.state.removedBinIds, state],
  );
  const nearest = visible
    .filter((item) => !participation.state.removedBinIds.includes(item.id))
    .filter((item) =>
      isUsableBin(item, state, participation.state.removedBinIds),
    )
    .slice(0, 3);
  const [path, search] = route.split("?");
  const params = new URLSearchParams(search);
  const [requestedPage, id] = path.split("/");
  const page =
    requestedPage === "stamps"
      ? "member"
      : ["scan", "quick-report"].includes(requestedPage)
        ? "report"
        : requestedPage;
  const location = locations.find(
    (item) => item.id === id && item.kind === "bin",
  );
  const report = state.reports.find((item) => item.id === id);
  const reportLocation = locations.find(
    (item) => item.id === report?.locationId,
  );
  const draft = {
    ...(drafts[id] || emptyDraft),
    adopter: Boolean(location && isAdopter(participation.state, location.id)),
  };
  draft.firstReporter = !state.reports.some(
    (r) =>
      r.locationId === id &&
      r.type === draft.type &&
      (r.wasteType || "general") === draft.wasteType &&
      reportEventOpen(state, r),
  );
  const loginHref = `#login?next=${encodeURIComponent(route)}`;
  function login() {
    setState((prev) => ({ ...prev, loggedIn: true }));
    const next = params.get("next") || "map";
    const [nextPath, ...queryParts] = next.split("?");
    const nextQuery = new URLSearchParams(queryParts.join("?"));
    const [nextPage, nextId] = nextPath.split("/");
    const validBin = (value: string | null) =>
      locations.some((item) => item.id === value && item.kind === "bin");
    const validPath =
      [
        "map",
        "member",
        "rewards",
        "stamps",
        "vote",
        "vote-progress",
        "adopt",
        "nearby",
      ].includes(nextPath) ||
      (nextPath === `${nextPage}/${nextId}` &&
        (["report", "scan", "quick-report", "adopt", "bin", "nav"].includes(
          nextPage,
        )
          ? validBin(nextId)
          : ["vote-progress", "vote-done"].includes(nextPage)
            ? participation.state.proposals.some((item) => item.id === nextId)
            : ["report-done", "review"].includes(nextPage) &&
              state.reports.some((item) => item.id === nextId)));
    const validQuery =
      nextQuery.size === 0 ||
      (nextQuery.size === 1 &&
        ((["report", "scan"].includes(nextPage) &&
          nextQuery.get("demo") === "1") ||
          (nextPage === "nav" && validBin(nextQuery.get("from"))) ||
          (nextPage === "rewards" &&
            state.redemptions.some(
              (item) => item.id === nextQuery.get("receipt"),
            ))));
    const valid = validPath && validQuery;
    window.location.hash = valid ? next : "map";
  }
  function submitReport() {
    if (
      submitting.current ||
      !location ||
      binDemo(location, participation.state.removedBinIds, state).removed ||
      !state.loggedIn ||
      reportingSuspended(state) ||
      (requestedPage === "quick-report" &&
        !isAdopter(participation.state, location.id)) ||
      !draft.type ||
      !draft.photo ||
      draft.proximity !== "near" ||
      (draft.type === "other" && !draft.description.trim()) ||
      state.reports.some(
        (item) =>
          item.locationId === location.id &&
          item.type === draft.type &&
          (item.wasteType || "general") === draft.wasteType &&
          item.reporter !== "fixture" &&
          reportEventOpen(state, item),
      )
    )
      return;
    submitting.current = true;
    const record = {
      id: crypto.randomUUID(),
      locationId: location.id,
      type: draft.type,
      wasteType: draft.wasteType,
      description: draft.description.trim(),
      createdAt: new Date().toISOString(),
      status: "pending" as const,
      adopter: isAdopter(participation.state, location.id),
      eventId: crypto.randomUUID(),
      quick: requestedPage === "quick-report",
      firstReporter: true,
      photo: true,
    };
    let savedId: string | undefined;
    void setState((prev) => {
      const latestParticipation = loadParticipationState();
      const adopter = isAdopter(latestParticipation, location.id);
      const next =
        prev.loggedIn &&
        !reportingSuspended(prev) &&
        !latestParticipation.removedBinIds.includes(location.id) &&
        (!record.quick || adopter)
          ? submitCitizenReport(prev, { ...record, adopter })
          : prev;
      savedId =
        next.reports.find((r) => r.id === record.id)?.id ||
        next.reports.find(
          (r) =>
            r.reporter !== "fixture" &&
            r.locationId === location.id &&
            r.type === record.type &&
            reportEventOpen(next, r),
        )?.id;
      return next;
    }).then((saved) => {
      if (saved && savedId) {
        setDrafts((prev) => ({ ...prev, [location.id]: { ...emptyDraft } }));
        window.location.hash = `report-done/${savedId}`;
      } else {
        submitting.current = false;
        setNotice("回報未儲存，請查看儲存提示或重新確認登入資格。");
      }
    });
  }

  function redeem(reward: Reward) {
    if (
      !state.loggedIn ||
      availablePoints(state) < reward.cost ||
      rewardStock(state, reward) <= 0
    )
      return;
    const order = {
      id: crypto.randomUUID(),
      rewardId: reward.id,
      cost: reward.cost,
      createdAt: new Date().toISOString(),
    };
    let redeemed = false;
    void setState((prev) => {
      const next = redeemReward(prev, order);
      redeemed = next !== prev;
      return next;
    }).then((saved) => {
      if (saved && redeemed)
        window.location.hash = `rewards?receipt=${order.id}`;
      else setNotice("兌換未完成，請重新確認可用點數、庫存或儲存提示。");
    });
  }

  const select = useCallback((item: LocationRecord) => {
    if (item.kind === "bin") window.location.hash = `bin/${item.id}`;
    else setSelected(item);
  }, []);
  function chooseKind(value: "all" | LocationKind) {
    setKind(value);
    setFilter("all");
    setSelected(null);
  }
  if (requestedPage === "staff") return <StaffApp route={path} />;
  const memberState = {
    ...state,
    reports: state.reports.filter((r) => r.reporter !== "fixture"),
  };
  const cleanup = location && latestCleanup(state, location.id);
  return (
    <div className="app-shell">
      <AppNav
        tabs={[
          {
            href: "#map",
            label: "地圖",
            current: page === "map" || page === "bin",
          },
          { href: "#vote", label: "要桶投票", current: page === "vote" },
        ]}
        desktopLinks={[
          {
            href: "#map",
            label: "找垃圾桶",
            current: page === "map" || page === "bin",
          },
          { href: "#vote", label: "這裡需要桶", current: page === "vote" },
          { href: "#adopt", label: "認養電子雞", current: page === "adopt" },
          { href: "#honor", label: "清潔隊榮譽榜", current: page === "honor" },
        ]}
        sections={[
          {
            title: "CITIZEN · 市民",
            links: [
              { href: "#map", label: "找垃圾桶" },
              { href: "#vote", label: "要桶投票" },
              { href: "#adopt", label: "認養電子雞" },
              { href: "#member", label: "會員中心" },
              { href: "#stamps", label: "集章與等級" },
              { href: "#rewards", label: "兌換獎勵" },
            ],
          },
          {
            title: "CREW · 清潔隊（展示身份切換）",
            links: [
              { href: "#staff/tasks", label: "進入清潔隊工作台" },
              { href: "#staff/route", label: "小車道路指引" },
              { href: "#honor", label: "清潔隊整體成果" },
            ],
          },
          {
            title: "ACCOUNT · 帳號",
            links: [
              {
                href: page === "login" ? `#${route}` : loginHref,
                label: state.loggedIn ? "示範市民（帳號與登出）" : "登入",
              },
            ],
          },
        ]}
        right={
          state.loggedIn ? (
            <a
              className="points-button"
              href="#member"
              aria-label={`會員中心，目前 ${availablePoints(state)} 點`}
            >
              <strong>{availablePoints(state)}</strong>PTS
            </a>
          ) : (
            <a
              className="points-button"
              href={page === "login" ? `#${route}` : loginHref}
            >
              登入
            </a>
          )
        }
        account={<span className="prototype">A + B + D · 展示模式</span>}
      />
      {(storageFailed || participation.storageFailed) && (
        <p className="storage-warning" role="status">
          瀏覽器無法儲存資料，重新整理後可能無法保留本次紀錄。{storageError}
        </p>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="關閉提示" onClick={() => setNotice("")}>
            <Icon name="close" />
          </button>
        </div>
      )}
      <div ref={mainRef}>
        {page === "map" ? (
          <main className="explore-layout">
            <aside className="explorer" aria-label="位置探索">
              <div className="intro">
                <span className="eyebrow">A LITTLE HELP FOR YOUR EVERYDAY</span>
                <h1>
                  附近哪裡
                  <br />
                  可以丟<span className="dot">？</span>
                </h1>
                <p>找到城市小夥伴，讓垃圾有個家。</p>
                <span className="demo-tag">
                  大安區試辦 · 桶況與設撤均為示意
                </span>
              </div>
              <div className="filters">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    aria-label="搜尋地點"
                    placeholder="搜尋路名、地點…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelected(null);
                    }}
                  />
                </label>
                <div className="district-field">
                  <Icon name="pin" />
                  <label htmlFor="district">探索範圍</label>
                  <select
                    id="district"
                    value={district}
                    onChange={(e) => {
                      setDistrict(e.target.value);
                      setSelected(null);
                    }}
                  >
                    <option value="all">全台北市</option>
                    {districts.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="tabs" role="group" aria-label="位置類型">
                  {(["all", "bin", "place"] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={kind === value}
                      onClick={() => chooseKind(value)}
                    >
                      {value === "all" ? "全部" : kindLabel[value]}
                    </button>
                  ))}
                </div>
                <div
                  className="filter-chips"
                  role="group"
                  aria-label="示意桶況篩選"
                >
                  {binFilters.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={filter === item.id}
                      onClick={() => {
                        setFilter(item.id);
                        if (item.id !== "all") setKind("bin");
                        setSelected(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <a className="back-link" href="#nearby">
                附近沒有桶？選點查看與提案
              </a>
              {nearest.length > 0 && (
                <section className="nearest-card">
                  <h2>最近的可用小夥伴</h2>
                  <p className="tiny">固定大安森林公園起點 · 非目前定位</p>
                  <ol className="nearest-list" aria-label="最近三個可用桶">
                    {nearest.map((item, index) => (
                      <li key={item.id}>
                        <span>{index + 1}</span>
                        <a href={`#bin/${item.id}`}>
                          <strong>{item.label}</strong>
                          <small>
                            步行約 {walkingMinutes(item)} 分鐘 · 示意估算
                          </small>
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              <div className="results-heading" role="status">
                <strong>{query ? "搜尋結果" : "附近的小夥伴"}</strong>
                <span>{visible.length} 筆位置紀錄</span>
              </div>
              <p className="distance-note">
                依大安森林公園示意起點排序 · 直線距離
                <br />
                新設{" "}
                {
                  visible.filter(
                    (item) =>
                      item.kind === "bin" &&
                      binDemo(item, participation.state.removedBinIds, state)
                        .isNew,
                  ).length
                }{" "}
                桶（示意）
              </p>
              <div className="location-list" aria-label="位置清單">
                {visible.length === 0 && (
                  <div className="empty">
                    <Icon name="search" />
                    <h2>沒有符合的地點</h2>
                    <p>試試其他關鍵字，或放寬篩選條件。</p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      清除搜尋與桶況篩選
                    </button>
                  </div>
                )}
                {visible.map((item) => {
                  const demo =
                    item.kind === "bin"
                      ? binDemo(item, participation.state.removedBinIds, state)
                      : null;
                  return (
                    <button
                      className={`location-row ${selected?.id === item.id ? "active" : ""}`}
                      key={item.id}
                      onClick={() => select(item)}
                      aria-pressed={selected?.id === item.id}
                    >
                      <span
                        className={`row-buddy ${demo ? stateVisual[demo.state].className : "place"}`}
                      >
                        <Mascot kind={item.kind} state={demo?.state} />
                      </span>
                      <span className="row-copy">
                        <strong>{item.label}</strong>
                        <small>
                          {item.district} · {distanceLabel(demoDistance(item))}{" "}
                          · 直線
                        </small>
                        <span
                          className={`row-state ${demo ? stateVisual[demo.state].className : "place"}`}
                        >
                          {demo
                            ? `● ${demo.removed ? "已撤除（示意）" : stateLabels[demo.state]}`
                            : "✦ 場所代表點"}
                        </span>
                        {demo &&
                          lifecycleLabel(
                            item,
                            participation.state.removedBinIds,
                          ) && (
                            <small
                              className={`lifecycle-label ${demo.removed ? "removed" : ""}`}
                            >
                              {lifecycleLabel(
                                item,
                                participation.state.removedBinIds,
                              )}
                              （示意）
                            </small>
                          )}
                      </span>
                      <Icon name="arrow" />
                    </button>
                  );
                })}
              </div>
              <p className="data-note">
                681 公布桶位置 ＋ 130 場所代表點
                <br />
                公開資料快照 · 非即時桶況 · 代表點不是桶
              </p>
            </aside>
            <section className="map-section" aria-label="地圖瀏覽">
              <LocationMap
                locations={visible}
                selected={selected}
                onSelect={select}
                removedIds={participation.state.removedBinIds}
              />
              <div className="map-badge">
                <span className="live-dot" />
                用一點小順手，讓台北更乾淨<span>TAIPEI, TOGETHER.</span>
              </div>
              <MapLegend />
              {selected && (
                <LocationDetails
                  location={selected}
                  onClose={() => setSelected(null)}
                />
              )}
            </section>
          </main>
        ) : ["vote", "vote-progress", "vote-done", "nearby"].includes(page) ? (
          <ParticipationPage
            key={route}
            state={participation.state}
            act={participation.act}
            loggedIn={state.loggedIn}
            page={page}
            id={id}
          />
        ) : page === "adopt" ? (
          <AdoptionPage
            key={route}
            state={participation.state}
            act={participation.act}
            loggedIn={state.loggedIn}
            id={id}
          />
        ) : page === "bin" && location ? (
          <BinDetail
            location={location}
            liked={Boolean(
              cleanup && state.completionLikes.includes(cleanup.id),
            )}
            onLike={() =>
              setState((prev) => {
                const latest = latestCleanup(prev, location.id);
                return !latest || prev.completionLikes.includes(latest.id)
                  ? prev
                  : {
                      ...prev,
                      completionLikes: [...prev.completionLikes, latest.id],
                    };
              })
            }
            adopter={adopterName(participation.state, location.id)}
            removedIds={participation.state.removedBinIds}
          />
        ) : page === "nav" && location ? (
          <NavigationPage
            key={`${id}/${params.get("from") || ""}`}
            location={location}
            fromId={params.get("from")}
            removedIds={participation.state.removedBinIds}
          />
        ) : page === "report" && location ? (
          <ReportPage
            location={location}
            demoOnDesktop={
              params.get("demo") === "1" || requestedPage === "quick-report"
            }
            quick={requestedPage === "quick-report"}
            removed={participation.state.removedBinIds.includes(id)}
            loggedIn={state.loggedIn}
            draft={draft}
            onChange={(value) =>
              setDrafts((prev) => ({ ...prev, [id]: value }))
            }
            onSubmit={submitReport}
            reports={memberState.reports}
            loginHref={loginHref}
            suspended={reportingSuspended(state)}
          />
        ) : page === "report-done" && report && reportLocation ? (
          <ReportDone
            report={report}
            location={reportLocation}
            state={memberState}
          />
        ) : page === "review" && report && reportLocation ? (
          <ReviewPage
            report={report}
            location={reportLocation}
            state={memberState}
          />
        ) : page === "login" ? (
          <LoginPage
            loggedIn={state.loggedIn}
            onLogin={login}
            onLogout={() => {
              setState((prev) => ({ ...prev, loggedIn: false }));
              window.location.hash = "map";
            }}
          />
        ) : page === "rewards" ? (
          <RewardsPage
            state={memberState}
            receiptId={params.get("receipt")}
            onRedeem={redeem}
          />
        ) : page === "honor" ? (
          <main className="page">
            <HonorPage state={state} citizen />
          </main>
        ) : page === "member" ? (
          <MemberPage state={memberState} />
        ) : (
          <main className="page not-found">
            <Mascot />
            <h1>找不到這個頁面</h1>
            <p className="muted">這個桶或回報可能不存在於目前的瀏覽器紀錄。</p>
            <a className="button primary" href="#map">
              返回地圖
            </a>
          </main>
        )}
      </div>
    </div>
  );
}
