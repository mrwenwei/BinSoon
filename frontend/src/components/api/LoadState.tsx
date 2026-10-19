import { useEffect, useState } from "react";
export function LoadState({
  loading,
  error,
  reload,
  retryAt = 0,
  stale = false,
}: {
  loading: boolean;
  error?: string;
  reload: () => void;
  retryAt?: number;
  stale?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [retryAt]);
  return (
    <>
      {loading && <p role="status">載入中…</p>}
      {stale && <p role="status">先前讀取的資料可能已過期，請重新載入確認。</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={reload}
            disabled={now < retryAt}
          >
            {now < retryAt ? "稍候再載入" : "重新載入"}
          </button>
        </div>
      )}
    </>
  );
}
