import { useCallback, useEffect, useState, type SetStateAction } from "react";

// All writers re-read inside the same origin lock. Storage events alone cannot
// prevent two tabs overwriting each other's balances or workflow transitions.
export function usePersistentState<T>(key: string, load: () => T) {
  const [failure, setFailure] = useState("");
  const read = useCallback(() => {
    try {
      return load();
    } catch {
      return null;
    }
  }, [load]);
  const [state, render] = useState<T | null>(read);
  useEffect(() => {
    const refresh = (event: Event) => {
      if (
        event instanceof StorageEvent &&
        event.key !== key &&
        event.key !== null
      )
        return;
      render(read());
    };
    window.addEventListener("storage", refresh);
    window.addEventListener(key, refresh);
    render(read());
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(key, refresh);
    };
  }, [key, read]);
  const setState = useCallback(
    (update: SetStateAction<T>) => {
      const write = () => {
        const latest = load(); // throws on incompatible storage: never erase it
        const next =
          typeof update === "function"
            ? (update as (previous: T) => T)(latest)
            : update;
        if (next === latest) return;
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event(key));
      };
      if (!navigator.locks) {
        setFailure("此瀏覽器不支援安全的分頁寫入，請使用新版瀏覽器。");
        return Promise.resolve(false);
      }
      return navigator.locks
        .request(key, write)
        .then(() => true)
        .catch((error) => {
          setFailure(
            error instanceof Error
              ? error.message
              : "儲存失敗，原始紀錄仍保留。",
          );
          return false;
        });
    },
    [key, load],
  );
  return {
    state,
    setState,
    failure:
      failure ||
      (state === null
        ? "無法載入本機紀錄，來源已保留，未建立空帳本覆寫。"
        : ""),
  };
}
