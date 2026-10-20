import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  errorMessage,
  request,
  type Role,
  type Session,
  type User,
} from "../../data/api";
import { Mascot } from "../Mascot";

type Auth = {
  session: Session | null;
  setSession: (s: Session | null) => void;
  invalidate: (token: string) => void;
  logout: () => Promise<void>;
  notice: string;
  clearNotice: () => void;
};
const Context = createContext<Auth | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  // Deliberately tab-local and memory-only: role sessions never overwrite another tab.
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const invalidate = useCallback((token: string) => {
    setSession((current) => {
      if (current?.access_token !== token) return current;
      return null;
    });
    setNotice("登入已失效，請重新登入；當次表單仍保留。");
  }, []);
  useEffect(() => {
    if (!session) return;
    const check = () => {
      if (Date.parse(session.expires_at) <= Date.now())
        invalidate(session.access_token);
    };
    check();
    const timer = window.setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [session, invalidate]);
  async function logout() {
    const current = session;
    setSession(null);
    if (current) {
      try {
        await request<void>("/auth/session", {
          method: "DELETE",
          token: current.access_token,
        });
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401))
          setNotice(
            "本頁已登出，但服務端撤銷未確認；此 session 將於期限到達失效。",
          );
      }
    }
  }
  return (
    <Context.Provider
      value={{
        session,
        setSession,
        invalidate,
        logout,
        notice,
        clearNotice: () => setNotice(""),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  return useContext(Context)!;
}

export function Login({ role, next }: { role: Role; next: string }) {
  const { setSession } = useSession();
  const attempt = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => () => attempt.current?.abort(), []);
  const [account, setAccount] = useState(`demo-${role}`);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <main className="page api-narrow login-page">
      <span className="login-mascot" aria-hidden="true">
        <Mascot />
      </span>
      <h1>
        {role === "citizen"
          ? "市民登入"
          : role === "staff"
            ? "隊員登入"
            : "管理員登入"}
      </h1>
      <p>展示帳號 session 有效期為 60 分鐘。請使用維運提供的密碼。</p>
      <form
        className="card api-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current || now < retryAt) return;
          lock.current = true;
          const controller = new AbortController();
          attempt.current = controller;
          setBusy(true);
          setError("");
          try {
            const { data } = await request<Session>("/auth/demo/login", {
              method: "POST",
              body: { account, password },
              signal: controller.signal,
            });
            const { data: me } = await request<User>("/me", {
              token: data.access_token,
              signal: controller.signal,
            });
            if (!me.roles.includes(role)) {
              await request("/auth/session", {
                method: "DELETE",
                token: data.access_token,
              });
              setError("此帳號沒有這個入口需要的角色，請使用對應帳號。");
              return;
            }
            if (controller.signal.aborted) return;
            setSession({ ...data, user: me });
            setPassword("");
            // Only known internal hash routes are accepted as return destinations.
            window.location.hash =
              /^(map|bin\/|nav\/|report\/|review\/|report-done\/|reports$|member$|stamps$|rewards(?:\/|$)|redemptions(?:\/|$)|vote(?:\/|$)|proposals(?:\/|$)|outcomes(?:\/|$)|staff(?:\/|$)|admin(?:\/|$))/.test(
                next,
              ) && !next.includes("login")
                ? next
                : role === "staff"
                  ? "staff/tasks"
                  : role === "admin"
                    ? "admin"
                    : "map";
          } catch (e) {
            if (controller.signal.aborted) return;
            setError(errorMessage(e));
            if (e instanceof ApiError && e.status === 429)
              setRetryAt(e.retryAt || Date.now() + 30000);
          } finally {
            lock.current = false;
            if (!controller.signal.aborted) setBusy(false);
          }
        }}
      >
        <label>
          帳號
          <input
            autoComplete="username"
            value={account}
            required
            maxLength={100}
            onChange={(e) => setAccount(e.target.value)}
          />
        </label>
        <label>
          密碼
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            required
            maxLength={200}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button primary" disabled={busy || now < retryAt}>
          {busy ? "登入中…" : now < retryAt ? "請稍候再登入" : "登入"}
        </button>
      </form>
      <p className="tiny">
        沒有台北通或手機簡訊驗證；帳密只在這次登入送往服務。
      </p>
    </main>
  );
}
