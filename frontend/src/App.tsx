import { useEffect, useRef, useState } from "react";
import { Mascot } from "./components/Mascot";
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
  return (
    <div className="app-shell api-app">
      <header className="topbar">
        <a className="brand" href="#map">
          <Mascot />
          <span>
            BinSoon<span className="brand-sub">台北丟垃圾變順</span>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="主選單">
          <a href="#map">找垃圾桶</a>
          <a href="#reports">我的回報</a>
          <a href="#member">會員中心</a>
          <a href="#staff/tasks">清潔隊工作台</a>
          <a href="#admin">管理員</a>
        </nav>
        {session ? (
          <div className="api-account">
            <span>{session.user.display_name}</span>
            <button
              className="text-button"
              onClick={() => {
                drafts.clear();
                workCommands.clear();
                void logout();
              }}
            >
              登出
            </button>
          </div>
        ) : (
          <a href={loginHref}>登入</a>
        )}
      </header>
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
          <BinPage key={`${page}/${id}`} id={id} navigation={page === "nav"} />
        ) : page === "staff" && id === "tasks" ? (
          <StaffPage key={workId || "list"} id={workId} />
        ) : page === "report" && id ? (
          <ReportForm key={id} id={id} />
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
