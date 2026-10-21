import { isDemoToken, DEMO_UPDATED, DEMO_STORE_KEY } from "../../data/demoMode";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage, type Result } from "../../data/api";
import { useSession } from "./SessionContext";

export function useApi<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<Result<T>>,
  poll = false,
  // 選用：paused＝暫停輪詢（恢復時立刻重抓一次）；stopOnNotFound＝拿到 404 就不再輪詢。
  options: { paused?: boolean; stopOnNotFound?: boolean } = {},
) {
  const paused = Boolean(options.paused);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const stopOnNotFound = Boolean(options.stopOnNotFound);
  const { session, invalidate } = useSession();
  const token = session?.access_token;
  const identity = JSON.stringify([key, token]);
  const loader = useRef(load);
  loader.current = load;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    identity: string;
    result?: Result<T>;
    error?: string;
    retryAt?: number;
    loading: boolean;
  }>({ identity, loading: true });
  const retryAfter = useRef(0);
  const reload = useCallback(() => {
    if (Date.now() >= retryAfter.current) {
      setState((old) => ({ ...old, loading: true }));
      setRevision((v) => v + 1);
    }
  }, []);
  useEffect(() => {
    if (key === null) return;
    retryAfter.current = 0;
    let disposed = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = () => {
      if (!pausedRef.current) void refresh();
    };
    async function refresh() {
      controller?.abort();
      let delay = 10000;
      const current = new AbortController();
      controller = current;
      setState((old) => ({
        identity,
        result: old.identity === identity ? old.result : undefined,
        error: old.identity === identity ? old.error : undefined,
        retryAt: old.identity === identity ? old.retryAt : undefined,
        loading: true,
      }));
      try {
        const result = await loader.current(current.signal);
        if (!disposed && !current.signal.aborted)
          setState({ identity, result, loading: false });
      } catch (e) {
        if (!disposed && !current.signal.aborted) {
          const retryAt =
            e instanceof ApiError && e.status === 429
              ? e.retryAt || Date.now() + 30000
              : 0;
          retryAfter.current = retryAt;
          if (retryAt) delay = Math.max(1000, retryAt - Date.now());
          const transient =
            !(e instanceof ApiError) || e.status >= 500 || e.status === 429;
          setState((old) => ({
            identity,
            result:
              transient && old.identity === identity ? old.result : undefined,
            error: errorMessage(e),
            retryAt,
            loading: false,
          }));
          if (e instanceof ApiError && e.status === 401 && token)
            invalidate(token);
          if (stopOnNotFound && e instanceof ApiError && e.status === 404)
            stopped = true;
        }
      } finally {
        if (
          !disposed &&
          !current.signal.aborted &&
          poll &&
          !stopped &&
          !pausedRef.current &&
          !document.hidden
        )
          timer = setTimeout(tick, delay);
      }
    }
    const visibility = () => {
      clearTimeout(timer);
      controller?.abort();
      if (!document.hidden && !stopped && !pausedRef.current) {
        if (Date.now() < retryAfter.current)
          timer = setTimeout(tick, retryAfter.current - Date.now());
        else void refresh();
      }
    };
    const demoUpdate = () => {
      if (isDemoToken(token) && key.startsWith("/me/")) visibility();
    };
    const storageUpdate = (event: StorageEvent) => {
      if (event.key === DEMO_STORE_KEY) demoUpdate();
    };
    if (!document.hidden) void refresh();
    window.addEventListener(DEMO_UPDATED, demoUpdate);
    window.addEventListener("storage", storageUpdate);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener(DEMO_UPDATED, demoUpdate);
      window.removeEventListener("storage", storageUpdate);
    };
  }, [identity, revision, poll, invalidate, stopOnNotFound]);
  // 從暫停恢復：立刻重抓一次，之後照常輪詢。
  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused) reload();
    wasPaused.current = paused;
  }, [paused, reload]);
  const visible =
    key !== null && state.identity === identity ? state : undefined;
  return {
    data: visible?.result?.data,
    etag: visible?.result?.etag,
    error: visible?.error,
    stale: Boolean(visible?.result && visible.error),
    retryAt: visible?.retryAt,
    loading: key !== null && (!visible || visible.loading),
    refreshing: Boolean(visible?.result && visible.loading),
    reload,
  };
}

export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [until]);
  return {
    waiting: now < until,
    hold: (error: unknown) => {
      if (error instanceof ApiError && error.status === 429) {
        setNow(Date.now());
        setUntil(error.retryAt || Date.now() + 30000);
      }
    },
  };
}
