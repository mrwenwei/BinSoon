import {
  CitizenHome,
  CitizenReports,
  CitizenBins,
} from "./components/api/CitizenPages";
import { CrewDemo } from "./components/api/CrewDemo";
import { ProposalVoteDone } from "./components/api/ProposalVoteDone";
import { isDemoToken, useDemoData } from "./data/demoMode";
import { isWasteType, wasteHref, type WasteType } from "./data/waste";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DemoNav } from "./components/DemoNav";
import { Coin } from "./components/Pixel";
import { ToastHost } from "./components/Toast";
import { request, type Membership } from "./data/api";
import { useApi } from "./components/api/useApi";
import {
  SessionProvider,
  Login,
  useSession,
} from "./components/api/SessionContext";
import { AdminPage } from "./components/api/CompletionPages";
import { MapPage } from "./components/api/MapPage";
import { NavigationPage } from "./components/api/NavigationPage";

import {
  ReportDraftProvider,
  useReportDrafts,
  RequireCitizen,
  ReportForm,
  QuickReport,
  ReportDetail,
  ReportsList,
  Member,
} from "./components/api/ReportPages";

import {
  ProposalDraftProvider,
  useProposalDraft,
} from "./components/api/ProposalDraft";
import {
  ProposalList,
  ProposalDetail,
  ProposalForm,
} from "./components/api/ProposalPages";
import { AdminProposals } from "./components/api/ProposalGovernance";
import { Adoptions, AdoptionApply } from "./components/api/AdoptionPages";
import { LifecyclePage } from "./components/api/LifecyclePage";
import { Notifications } from "./components/api/Notifications";
import { Outcomes } from "./components/api/OutcomePages";
import { Rewards, Redemptions } from "./components/api/RewardPages";
import { PointHistory } from "./components/api/PointHistory";
import { RoutePage } from "./components/api/RoutePage";
import { type CrewVehicle } from "./data/crewRouting";
import { StaffPage } from "./components/api/StaffPages";
import {
  WorkCommandProvider,
  useWorkCommands,
} from "./components/api/Commands";

function AppContent() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "map");
  const drafts = useReportDrafts();
  const proposalDraft = useProposalDraft();
  const workCommands = useWorkCommands();
  const main = useRef<HTMLDivElement>(null);
  const { session, logout, notice, clearNotice } = useSession();
  const citizenDemo = isDemoToken(session?.access_token);
  // 只換 ?waste_type= 時（例如在種類單選或下拉按方向鍵），頁面若因 key 重建，
  // 原本聚焦的控制項會被換掉、焦點掉到 BODY。換之前記下控制項，換完把焦點
  // 放回新畫面上同一個控制項（單選：目前選中的那格）。
  const routeRef = useRef(route);
  const wasteFocus = useRef<string | null>(null);
  useEffect(() => {
    const change = () => {
      const next = location.hash.slice(1) || "map";
      const el = document.activeElement;
      wasteFocus.current =
        onlyWasteChanged(routeRef.current, next) && el
          ? wasteControlSelector(el)
          : null;
      routeRef.current = next;
      setRoute(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const [path, search] = route.split("?");
  const [page, id, workId] = path.split("/");
  const params = new URLSearchParams(search);
  // 換頁時把焦點移到頁面標題；只有 ?waste_type= 變了（例如用方向鍵切換種類）
  // 不算換頁，焦點留在原處，才能連續切換。
  const focusParams = new URLSearchParams(search);
  focusParams.delete("waste_type");
  const focusKey = `${path}?${focusParams}`;
  // Focus during the DOM commit so a delayed effect cannot steal focus after
  // the user has already moved to a map marker on the new page.
  useLayoutEffect(() => {
    // MapPage handles explicit point selection itself. If the user has already
    // moved to another marker while the route commits, preserve that focus.
    if (document.activeElement?.closest(".leaflet-marker-icon")) return;
    const h = main.current?.querySelector("h1");
    h?.setAttribute("tabindex", "-1");
    h?.focus({ preventScroll: true });
  }, [focusKey]);
  useEffect(() => {
    const selector = wasteFocus.current;
    wasteFocus.current = null;
    if (!selector || !main.current) return;
    return restoreFocus(main.current, selector);
  }, [route]);
  const [vehicle, setVehicle] = useState<CrewVehicle>("scooter");
  const [lastWaste, setLastWaste] = useState<WasteType>("general");
  const routeWaste = params.get("waste_type");
  const wasteType = isWasteType(routeWaste) ? routeWaste : lastWaste;
  useEffect(() => {
    if (isWasteType(routeWaste)) setLastWaste(routeWaste);
  }, [routeWaste]);
  const onWasteChange = (value: WasteType) => {
    setLastWaste(value);
    window.location.hash = wasteHref(
      window.location.hash.slice(1) || "map",
      value,
    ).slice(1);
  };
  const wasteControls = { wasteType, onWasteChange };
  const role =
    page === "staff" ? "staff" : page === "admin" ? "admin" : "citizen";
  const loginRoute = role === "citizen" ? "login" : `${role}/login`;
  const loginHref = `#${loginRoute}?next=${encodeURIComponent(route)}`;
  const isLogin = page === "login" || id === "login";
  // 地圖瀏覽模式（#map、#bin/<id>）是一屏 app，不接頁尾；揭露句改在面板底部。
  const isMapView =
    !isLogin &&
    (page === "map" ||
      page === "nav" ||
      (page === "vote" && !id) ||
      (page === "bin" && !!id));
  const signOut = () => {
    drafts.clear();
    proposalDraft.clear();
    workCommands.clear();
    void logout();
  };
  return (
    <div
      className={`app-shell api-app m-app ${page === "crew" ? "m-crew" : ""}`}
    >
      <DemoNav
        crew={page === "crew"}
        tabs={
          page === "crew"
            ? [
                {
                  href: "#crew",
                  label: "工單",
                  current: !id || id === "task" || id === "login",
                },
                { href: "#crew/route", label: "路線", current: id === "route" },
                {
                  href: "#crew/ranking",
                  label: "榮譽榜",
                  current: id === "ranking",
                },
              ]
            : [
                {
                  href: wasteHref("map", wasteType),
                  label: "地圖",
                  current:
                    [
                      "map",
                      "bin",
                      "nav",
                      "report",
                      "quick-report",
                      "report-done",
                    ].includes(page) && params.get("tab") !== "vote",
                },
                {
                  href: "#vote",
                  label: "設桶投票",
                  current:
                    ["vote", "vote-done", "proposals"].includes(page) ||
                    params.get("tab") === "vote",
                },
                {
                  href: "#member",
                  label: "我的",
                  current: [
                    "member",
                    "levels",
                    "point-history",
                    "stamps",
                    "reports",
                    "review",
                    "rewards",
                    "redemptions",
                    "notifications",
                    "adopt",
                  ].includes(page),
                },
              ]
        }
        right={
          page === "crew" ? (
            <span className="role-chip">清潔員模式</span>
          ) : session?.user.roles.includes("citizen") ? (
            <PointsButton />
          ) : session ? (
            <span className="role-chip">
              {session.user.roles.includes("staff") ? "隊員模式" : "管理員模式"}
            </span>
          ) : (
            <a className="points-button" href={loginHref}>
              登入
            </a>
          )
        }
        account={page !== "crew" && session && <Account onLogout={signOut} />}
      />
      <ToastHost />
      {notice && (
        <p className="storage-warning" role="status">
          {notice} <button onClick={clearNotice}>關閉提示</button>
        </p>
      )}
      <div ref={main}>
        {page === "crew" ? (
          <CrewDemo section={id} id={workId} />
        ) : isLogin ? (
          <Login
            key={role}
            role={role}
            next={
              params.get("next") ||
              (role === "staff"
                ? "staff/tasks"
                : role === "admin"
                  ? "admin"
                  : "map")
            }
          />
        ) : page === "notifications" ||
          (["staff", "admin"].includes(page) && id === "notifications") ? (
          <Notifications
            key={`${page}/${session?.user.id}`}
            role={page === "notifications" ? undefined : role}
          />
        ) : page === "admin" && id === "bins" ? (
          <LifecyclePage
            key={`${workId || "list"}/${session?.user.id}`}
            id={workId}
          />
        ) : page === "admin" && id === "adoptions" ? (
          <Adoptions
            key={`${workId || "list"}/${session?.user.id}`}
            id={workId}
            admin
          />
        ) : page === "admin" && id === "proposals" ? (
          <AdminProposals
            key={`${workId || "list"}/${session?.user.id}`}
            id={workId}
          />
        ) : page === "admin" ? (
          <AdminPage
            key={workId || "admin"}
            id={id === "work-orders" ? workId : undefined}
          />
        ) : page === "map" ||
          (page === "vote" && !id) ||
          (page === "bin" && id) ? (
          // 地圖與桶資訊同一個元件：#bin/<id> 是「地圖＋已選該桶的面板」，
          // 切換時地圖不重建。
          <MapPage
            {...wasteControls}
            voting={page === "vote" || params.get("tab") === "vote"}
            binId={page === "bin" ? id : undefined}
            placeId={
              page === "map" ? params.get("place") || undefined : undefined
            }
          />
        ) : page === "nav" && id ? (
          <NavigationPage
            key={`${page}/${id}/${wasteType}`}
            id={id}
            {...wasteControls}
          />
        ) : page === "quick-report" && id ? (
          <QuickReport
            key={`${id}/${wasteType}/${session?.user.id}`}
            id={id}
            {...wasteControls}
          />
        ) : page === "adopt" ? (
          id === "apply" && workId ? (
            <AdoptionApply
              key={`${workId}/${session?.user.id}`}
              binId={workId}
            />
          ) : citizenDemo && !id && !params.has("manage") ? (
            <RequireCitizen next={route}>
              <CitizenBins wasteType={wasteType} />
            </RequireCitizen>
          ) : (
            <Adoptions key={`${id || "list"}/${session?.user.id}`} id={id} />
          )
        ) : page === "vote" ? (
          id === "create" ? (
            <RequireCitizen next={route}>
              <ProposalForm key={session?.user.id} />
            </RequireCitizen>
          ) : id === "mine" || id === "votes" ? (
            <RequireCitizen next={route}>
              <ProposalList key={`${id}/${session?.user.id}`} mode={id} />
            </RequireCitizen>
          ) : (
            <ProposalList key={`all/${session?.user.id}`} />
          )
        ) : page === "vote-done" && id ? (
          <ProposalVoteDone
            key={`${id}/${session?.user.id}`}
            id={id}
            fromProposal={params.get("from") === "proposal"}
            wasteType={wasteType}
          />
        ) : page === "proposals" && id ? (
          <ProposalDetail key={`${id}/${session?.user.id}`} id={id} />
        ) : page === "outcomes" || (page === "staff" && id === "statistics") ? (
          <Outcomes staff={page === "staff"} />
        ) : page === "staff" && id === "route" ? (
          <RoutePage vehicle={vehicle} onVehicleChange={setVehicle} />
        ) : page === "staff" && id === "tasks" ? (
          <StaffPage key={workId || "list"} id={workId} />
        ) : page === "report" && id ? (
          <ReportForm key={`${id}/${wasteType}`} id={id} {...wasteControls} />
        ) : ["review", "report-done"].includes(page) && id ? (
          <RequireCitizen next={route}>
            <ReportDetail key={id} id={id} done={page === "report-done"} />
          </RequireCitizen>
        ) : page === "reports" ? (
          <RequireCitizen next={route}>
            {citizenDemo ? <CitizenReports /> : <ReportsList />}
          </RequireCitizen>
        ) : page === "rewards" || page === "redemptions" ? (
          <RequireCitizen next={route}>
            {page === "rewards" ? (
              <Rewards key={session?.user.id} />
            ) : (
              <Redemptions
                key={`${session?.user.id}/${id || "list"}`}
                id={id}
              />
            )}
          </RequireCitizen>
        ) : page === "point-history" ? (
          <RequireCitizen next={route}>
            <PointHistory key={session?.user.id} />
          </RequireCitizen>
        ) : ["member", "stamps", "levels"].includes(page) ? (
          <RequireCitizen next={route}>
            {citizenDemo && page !== "levels" ? <CitizenHome /> : <Member />}
          </RequireCitizen>
        ) : (
          <main className="page">
            <h1>功能尚未開放</h1>
            <p>此流程尚在串接，請稍後再試。</p>
            {role !== "citizen" && !session?.user.roles.includes(role) && (
              <a className="button primary" href={loginHref}>
                {role === "staff" ? "隊員登入" : "管理員登入"}
              </a>
            )}
            <a className="back-link" href={wasteHref("map", wasteType)}>
              返回地圖
            </a>
          </main>
        )}
      </div>
      {!isMapView &&
        ![
          "login",
          "vote-done",
          "report",
          "report-done",
          "quick-report",
          "member",
          "rewards",
          "adopt",
          "reports",
          "vote",
          "proposals",
        ].includes(page) &&
        page !== "crew" && (
          <footer className="api-footer">
            <a href="#vote">提案</a> · <a href="#adopt">認養</a> ·{" "}
            <a href="#rewards">兌換</a>
          </footer>
        )}
    </div>
  );
}
function routeWithoutWaste(route: string) {
  const [path, search] = route.split("?");
  const params = new URLSearchParams(search);
  params.delete("waste_type");
  return `${path}?${params}`;
}
function onlyWasteChanged(previous: string, next: string) {
  return (
    previous !== next && routeWithoutWaste(previous) === routeWithoutWaste(next)
  );
}
function wasteControlSelector(el: Element) {
  if (el instanceof HTMLInputElement && el.type === "radio" && el.name)
    return `input[type="radio"][name="${CSS.escape(el.name)}"]`;
  if (el instanceof HTMLSelectElement && el.getAttribute("aria-label"))
    return `select[aria-label="${CSS.escape(el.getAttribute("aria-label")!)}"]`;
  return null;
}
// 焦點還在（元件沒重建）就不動；否則等新畫面出現同一個控制項（頁面可能還在
// 載入），最多等 5 秒，期間使用者自己移了焦點也不搶。
function restoreFocus(root: HTMLElement, selector: string) {
  const lost = () =>
    !document.activeElement || document.activeElement === document.body;
  const attempt = () => {
    if (!lost()) return true;
    const target =
      root.querySelector<HTMLElement>(`${selector}:checked`) ??
      root.querySelector<HTMLElement>(selector);
    if (!target) return false;
    target.focus({ preventScroll: true });
    return true;
  };
  if (attempt()) return;
  const observer = new MutationObserver(() => {
    if (attempt()) stop();
  });
  const timer = window.setTimeout(() => stop(), 5000);
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
  };
  observer.observe(root, { childList: true, subtree: true });
  return stop;
}

export default function App() {
  return (
    <SessionProvider>
      <ReportDraftProvider>
        <WorkCommandProvider>
          <ProposalDraftProvider>
            <AppContent />
          </ProposalDraftProvider>
        </WorkCommandProvider>
      </ReportDraftProvider>
    </SessionProvider>
  );
}

// 右上點數按鈕＝會員中心（市民登入時讀 /me/membership 的可用點數）。
function PointsButton() {
  const { session } = useSession();
  const membership = useApi(
    "/me/membership",
    (signal) =>
      request<Membership>("/me/membership", {
        signal,
        token: session?.access_token,
      }),
    true,
  );
  const points = membership.data?.available_points;
  return (
    <a
      className="points-button"
      href="#member"
      aria-label={`會員中心，目前 ${points ?? "—"} 點`}
    >
      {/* 代幣＝點數（認領流程 v3）：代幣＋數字，不再寫英文縮寫 PTS。 */}
      <Coin />
      <strong className="numeral-sm">{points ?? "—"}</strong>
    </a>
  );
}
function Account({ onLogout }: { onLogout: () => void }) {
  const { session } = useSession();
  return (
    <div className="api-account">
      <span>{session?.user.display_name}</span>
      <button className="text-button" onClick={onLogout}>
        登出
      </button>
    </div>
  );
}
