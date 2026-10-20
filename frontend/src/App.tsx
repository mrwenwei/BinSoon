import { isWasteType, wasteHref, type WasteType } from "./data/waste";
import { useEffect, useRef, useState } from "react";
import { AppNav } from "./components/AppNav";
import { request, type Membership } from "./data/api";
import { useApi } from "./components/api/useApi";
import {
  SessionProvider,
  Login,
  useSession,
} from "./components/api/SessionContext";
import { AdminPage } from "./components/api/CompletionPages";
import { MapPage, BinPage } from "./components/api/MapPages";

import {
  ReportDraftProvider,
  useReportDrafts,
  RequireCitizen,
  ReportForm,
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
import { Outcomes } from "./components/api/OutcomePages";
import { Rewards, Redemptions } from "./components/api/RewardPages";
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
  useEffect(() => {
    const change = () => {
      setRoute(location.hash.slice(1) || "map");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const h = main.current?.querySelector("h1");
    h?.setAttribute("tabindex", "-1");
    h?.focus({ preventScroll: true });
  }, [route]);
  const [path, search] = route.split("?");
  const [page, id, workId] = path.split("/");
  const params = new URLSearchParams(search);
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
  const signOut = () => {
    drafts.clear();
    proposalDraft.clear();
    workCommands.clear();
    void logout();
  };
  return (
    <div className="app-shell api-app">
      <AppNav
        tabs={[
          {
            href: wasteHref("map", wasteType),
            label: "地圖",
            current: ["map", "bin", "nav"].includes(page),
          },
          { href: "#vote", label: "要桶投票", current: page === "vote" },
        ]}
        desktopLinks={[
          {
            href: wasteHref("map", wasteType),
            label: "找垃圾桶",
            current: ["map", "bin", "nav"].includes(page),
          },
          { href: "#reports", label: "我的回報", current: page === "reports" },
          { href: "#member", label: "會員中心", current: page === "member" },
          {
            href: "#staff/tasks",
            label: "清潔隊工作台",
            current: page === "staff",
          },
          { href: "#admin", label: "管理員", current: page === "admin" },
        ]}
        sections={[
          {
            title: "CITIZEN · 市民",
            links: [
              {
                href: wasteHref("map", wasteType),
                label: "找垃圾桶",
                current: page === "map",
              },
              { href: "#vote", label: "要桶投票" },
              {
                href: "#reports",
                label: "我的回報",
                current: page === "reports",
              },
              {
                href: "#member",
                label: "會員中心",
                current: page === "member",
              },
              {
                href: "#stamps",
                label: "集章與等級",
                current: page === "stamps",
              },
              { href: "#rewards", label: "兌換獎勵" },
              { href: "#adopt", label: "認養電子雞" },
            ],
          },
          {
            title: "CREW · 清潔隊與管理",
            links: [
              {
                href: "#staff/tasks",
                label: "清潔隊工作台",
                current: page === "staff" && id === "tasks",
              },
              {
                href: "#staff/route",
                label: "清運道路指引",
                current: page === "staff" && id === "route",
              },
              { href: "#staff/statistics", label: "隊員月份成果" },
              { href: "#outcomes", label: "清潔隊公開成果" },
              { href: "#admin/proposals", label: "提案與命名審查" },
              { href: "#admin/adoptions", label: "認養審核" },
              { href: "#admin", label: "管理員", current: page === "admin" },
            ],
          },
          ...(session
            ? []
            : [
                {
                  title: "ACCOUNT · 帳號",
                  links: [
                    { href: loginHref, label: "市民登入" },
                    {
                      href: `#staff/login?next=staff%2Ftasks`,
                      label: "隊員登入",
                    },
                    { href: `#admin/login?next=admin`, label: "管理員登入" },
                  ],
                },
              ]),
        ]}
        right={
          session?.user.roles.includes("citizen") ? (
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
        account={session && <Account onLogout={signOut} />}
        drawerFooter={session && <Account onLogout={signOut} />}
      />
      {notice && (
        <p className="storage-warning" role="status">
          {notice} <button onClick={clearNotice}>關閉提示</button>
        </p>
      )}
      <div ref={main}>
        {isLogin ? (
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
        ) : page === "map" ? (
          <MapPage {...wasteControls} />
        ) : (page === "bin" || page === "nav") && id ? (
          <BinPage
            key={`${page}/${id}/${wasteType}`}
            id={id}
            navigation={page === "nav"}
            {...wasteControls}
          />
        ) : page === "adopt" ? (
          id === "apply" && workId ? (
            <AdoptionApply
              key={`${workId}/${session?.user.id}`}
              binId={workId}
            />
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
            <ReportsList />
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
        ) : ["member", "stamps"].includes(page) ? (
          <RequireCitizen next={route}>
            <Member />
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
      <footer className="api-footer">
        所有滿度目前皆為 simulated 模擬讀值，尚無真實 IoT 接收。
        <a href="#vote">提案</a> · <a href="#adopt">認養</a> ·{" "}
        <a href="#rewards">兌換</a>
      </footer>
    </div>
  );
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
      <strong>{points ?? "—"}</strong>PTS
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
