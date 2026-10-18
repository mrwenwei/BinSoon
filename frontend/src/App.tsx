import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  districts,
  filterLocations,
  kindLabel,
  locations,
  type LocationKind,
  type LocationRecord,
} from "./data/locations";
import {
  binDemo,
  binFilters,
  demoDistance,
  distanceLabel,
  matchesBinFilter,
  stateLabels,
  type BinFilter,
} from "./data/binDemo";
import { availablePoints, useDemoStore } from "./data/demoStore";
import { emptyDraft, type ReportDraft } from "./data/reports";
import { LocationMap } from "./map/LocationMap";
import { Mascot } from "./components/Mascot";
import { Icon } from "./components/Icon";
import { LocationDetails } from "./components/LocationDetails";
import { BinDetail } from "./components/BinDetail";
import { LoginPage } from "./components/LoginPage";
import { ReportPage } from "./components/ReportPage";
import { ReportDone } from "./components/ReportDone";
import { StampsPage, stampCount } from "./components/StampsPage";
import { ScanPage } from "./components/ScanPage";

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
  const { state, setState, storageFailed } = useDemoStore();
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
            matchesBinFilter(location, filter) &&
            `${location.label} ${location.district} ${location.address || ""}`.includes(
              query.trim(),
            ),
        )
        .sort((a, b) => demoDistance(a) - demoDistance(b)),
    [district, kind, filter, query],
  );
  const [path, search] = route.split("?");
  const params = new URLSearchParams(search);
  const [page, id] = path.split("/");
  const location = locations.find(
    (item) => item.id === id && item.kind === "bin",
  );
  const report = state.reports.find((item) => item.id === id);
  const reportLocation = locations.find(
    (item) => item.id === report?.locationId,
  );
  const draft = drafts[id] || emptyDraft;
  const loginHref = `#login?next=${encodeURIComponent(route)}`;
  function login() {
    setState((prev) => ({ ...prev, loggedIn: true }));
    const next = params.get("next") || "map";
    const [nextPath] = next.split("?");
    const [nextPage, nextId] = nextPath.split("/");
    const valid =
      next === "map" ||
      next === "stamps" ||
      ((["report", "scan", "bin"].includes(nextPage)
        ? locations.some((item) => item.id === nextId && item.kind === "bin")
        : nextPage === "report-done" &&
          state.reports.some((item) => item.id === nextId)) &&
        /^[a-z-]+\/[\da-f-]+(?:\?demo=1)?$/.test(next));
    window.location.hash = valid ? next : "map";
  }
  function submitReport() {
    if (
      submitting.current ||
      !location ||
      !state.loggedIn ||
      !draft.type ||
      !draft.photo ||
      draft.proximity !== "near" ||
      (draft.type === "other" && !draft.description.trim()) ||
      state.reports.some(
        (item) => item.locationId === location.id && item.type === draft.type,
      )
    )
      return;
    submitting.current = true;
    const record = {
      id: crypto.randomUUID(),
      locationId: location.id,
      type: draft.type,
      description: draft.description.trim(),
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      reports: [...prev.reports, record],
      stamps: [...new Set([...prev.stamps, location.id])],
    }));
    window.location.hash = `report-done/${record.id}`;
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
  function unavailable(label: string) {
    setNotice(`${label}屬於其他 flow，本次先體驗找桶、回報與集章。`);
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#map" aria-label="BinSoon 首頁">
          <Mascot />
          <span>
            BinSoon<span className="brand-sub">台北丟垃圾變順</span>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="主選單">
          <a
            className={page === "map" || page === "bin" ? "active" : ""}
            href="#map"
          >
            找垃圾桶
          </a>
          <button onClick={() => unavailable("預約小車")}>預約小車</button>
          <button onClick={() => unavailable("這裡需要桶")}>這裡需要桶</button>
          <button onClick={() => unavailable("認養電子雞")}>認養電子雞</button>
        </nav>
        <span className="prototype">A FLOW · 展示模式</span>
        <a className="account-link" href="#stamps">
          <Icon name="star" />
          <span>{availablePoints(state)} 點</span>
          <strong>我的集章</strong>
        </a>
        <a
          className="login-link"
          href={page === "login" ? `#${route}` : loginHref}
        >
          {state.loggedIn ? "示範市民" : "登入"}
        </a>
      </header>
      {storageFailed && (
        <p className="storage-warning" role="status">
          瀏覽器無法儲存資料，重新整理後可能無法保留本次紀錄。
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
                <span className="demo-tag">大安區試辦 · 桶況為示意資料</span>
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
              <div className="results-heading" role="status">
                <strong>{query ? "搜尋結果" : "附近的小夥伴"}</strong>
                <span>{visible.length} 筆位置紀錄</span>
              </div>
              <p className="distance-note">
                依大安森林公園示意起點排序 · 直線距離
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
                  const demo = item.kind === "bin" ? binDemo(item) : null;
                  return (
                    <button
                      className={`location-row ${selected?.id === item.id ? "active" : ""}`}
                      key={item.id}
                      onClick={() => select(item)}
                      aria-pressed={selected?.id === item.id}
                    >
                      <span className={`row-buddy ${demo?.state || "place"}`}>
                        <Mascot kind={item.kind} />
                      </span>
                      <span className="row-copy">
                        <strong>{item.label}</strong>
                        <small>
                          {item.district} · {distanceLabel(demoDistance(item))}{" "}
                          · 直線
                        </small>
                        <span className={`row-state ${demo?.state || "place"}`}>
                          {demo
                            ? `● ${stateLabels[demo.state]}${demo.dog ? " · 可丟狗便便" : ""}`
                            : "✦ 場所代表點"}
                        </span>
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
              />
              <div className="map-badge">
                <span className="live-dot" />
                用一點小順手，讓台北更乾淨<span>TAIPEI, TOGETHER.</span>
              </div>
              <div className="legend">
                <span>
                  <i className="legend-dot hungry" />
                  餓了 0–49%
                </span>
                <span>
                  <i className="legend-dot half" />
                  半飽 50–79%
                </span>
                <span>
                  <i className="legend-dot full" />
                  吃飽了 80%+
                </span>
                <span>
                  <i className="legend-dot unknown" />
                  未知
                </span>
                <span>
                  <i className="legend-dot place" />
                  場所代表點
                </span>
                <small>桶況皆為示意</small>
              </div>
              {selected && (
                <LocationDetails
                  location={selected}
                  onClose={() => setSelected(null)}
                />
              )}
            </section>
          </main>
        ) : page === "bin" && location ? (
          <BinDetail
            location={location}
            liked={state.likes.includes(location.id)}
            onLike={() =>
              setState((prev) => ({
                ...prev,
                likes: [...new Set([...prev.likes, location.id])],
              }))
            }
            onNotice={setNotice}
          />
        ) : page === "report" && location ? (
          <ReportPage
            location={location}
            demoOnDesktop={params.get("demo") === "1"}
            loggedIn={state.loggedIn}
            draft={draft}
            onChange={(value) =>
              setDrafts((prev) => ({ ...prev, [id]: value }))
            }
            onSubmit={submitReport}
            reports={state.reports}
            loginHref={loginHref}
          />
        ) : page === "report-done" && report && reportLocation ? (
          <ReportDone
            report={report}
            location={reportLocation}
            count={stampCount(state, reportLocation.district)}
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
        ) : page === "scan" && location ? (
          <ScanPage
            key={location.id}
            location={location}
            collected={state.stamps.includes(location.id)}
            loggedIn={state.loggedIn}
            loginHref={loginHref}
            onCollect={() => {
              if (!state.loggedIn) return;
              setState((prev) => ({
                ...prev,
                stamps: [...new Set([...prev.stamps, location.id])],
              }));
              window.location.hash = "stamps";
            }}
          />
        ) : page === "stamps" ? (
          <StampsPage
            state={state}
            onRedeem={() =>
              setState((prev) =>
                prev.loggedIn && !prev.redeemed && availablePoints(prev) >= 200
                  ? { ...prev, redeemed: true }
                  : prev,
              )
            }
          />
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
      <nav className="mobile-nav" aria-label="手機主選單">
        <a
          className={page === "map" || page === "bin" ? "active" : ""}
          href="#map"
        >
          <Icon name="map" />
          地圖
        </a>
        <button onClick={() => unavailable("預約小車")}>
          <Icon name="clock" />
          小車
        </button>
        <button onClick={() => unavailable("要桶投票")}>
          <Icon name="pin" />
          要桶投票
        </button>
        <a className={page === "stamps" ? "active" : ""} href="#stamps">
          <Icon name="star" />
          我的
        </a>
      </nav>
    </div>
  );
}
