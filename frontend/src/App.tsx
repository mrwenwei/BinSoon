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

import { StaffPage } from "./components/api/StaffPages";
import {
  WorkCommandProvider,
  useWorkCommands,
} from "./components/api/Commands";

function AppContent() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "map");
  const drafts = useReportDrafts();
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
  const role =
    page === "staff" ? "staff" : page === "admin" ? "admin" : "citizen";
  const loginRoute = role === "citizen" ? "login" : `${role}/login`;
  const loginHref = `#${loginRoute}?next=${encodeURIComponent(route)}`;
  const isLogin = page === "login" || id === "login";
  const signOut = () => {
    drafts.clear();
    workCommands.clear();
    void logout();
  };
  return (
    <div className="app-shell api-app">
      <AppNav
        tabs={[
          {
            href: "#map",
            label: "地圖",
            current: ["map", "bin", "nav"].includes(page),
          },
          { href: "#vote", label: "要桶投票", current: page === "vote" },
        ]}
        desktopLinks={[
          {
            href: "#map",
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
              { href: "#map", label: "找垃圾桶", current: page === "map" },
              { href: "#vote", label: "要桶投票（尚未開放）" },
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
              { href: "#rewards", label: "兌換獎勵（尚未開放）" },
              { href: "#adopt", label: "認養電子雞（尚未開放）" },
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
              { href: "#staff/route", label: "小車道路指引（尚未開放）" },
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
        ) : page === "admin" ? (
          <AdminPage
            key={workId || "admin"}
            id={id === "work-orders" ? workId : undefined}
          />
        ) : page === "map" ? (
          <MapPage />
        ) : (page === "bin" || page === "nav") && id ? (
          <BinPage
            key={`${page}/${id}/${params.get("waste_type") || ""}`}
            id={id}
            navigation={page === "nav"}
            wasteType={
              params.get("waste_type") === "recycling" ? "recycling" : undefined
            }
          />
        ) : page === "staff" && id === "tasks" ? (
          <StaffPage key={workId || "list"} id={workId} />
        ) : page === "report" && id ? (
          <ReportForm
            key={id}
            id={id}
            wasteType={
              params.get("waste_type") === "recycling" ? "recycling" : "general"
            }
          />
        ) : ["review", "report-done"].includes(page) && id ? (
          <RequireCitizen next={route}>
            <ReportDetail key={id} id={id} done={page === "report-done"} />
          </RequireCitizen>
        ) : page === "reports" ? (
          <RequireCitizen next={route}>
            <ReportsList />
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
            <a className="back-link" href="#map">
              返回地圖
            </a>
          </main>
        )}
      </div>
      <footer className="api-footer">
        所有滿度目前皆為 simulated 模擬讀值，尚無真實 IoT 接收。
        <a href="#vote">提案（尚未開放）</a> ·{" "}
        <a href="#adopt">認養（尚未開放）</a> ·{" "}
        <a href="#rewards">兌換（尚未開放）</a>
      </footer>
    </div>
  );
}
export default function App() {
  return (
    <SessionProvider>
      <ReportDraftProvider>
        <WorkCommandProvider>
          <AppContent />
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
