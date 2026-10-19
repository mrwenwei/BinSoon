import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  command,
  errorMessage,
  sendCommand,
  type Command,
  type Result,
} from "../../data/api";
import { useSession } from "./SessionContext";
import { useCooldown } from "./useApi";

export type Intent = { path: string; body: unknown; label: string };
type Pending = { operation: Command; intent: Intent };
type PhotoDraft = { actorId: string; file?: File; mediaId?: string };
const Context = createContext<{
  pending: Record<string, Pending>;
  photos: Record<string, PhotoDraft>;
  save: (scope: string, value: Pending | null) => void;
  savePhoto: (scope: string, value: PhotoDraft | null) => void;
  clear: () => void;
} | null>(null);
export function WorkCommandProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [photos, setPhotos] = useState<Record<string, PhotoDraft>>({});
  return (
    <Context.Provider
      value={{
        pending,
        photos,
        save: (scope, value) =>
          setPending((old) => {
            const next = { ...old };
            if (value) next[scope] = value;
            else delete next[scope];
            return next;
          }),
        savePhoto: (scope, value) =>
          setPhotos((old) => {
            const next = { ...old };
            if (value) next[scope] = value;
            else delete next[scope];
            return next;
          }),
        clear: () => {
          setPending({});
          setPhotos({});
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkCommands() {
  return useContext(Context)!;
}

type Options = {
  scope: string;
  authorized: boolean;
  ready: boolean;
  etag?: string | null;
  refresh: () => void;
  canRun?: (intent: Intent) => boolean;
  reconfirm?: boolean;
};
export function useCommand<T>(options: Options) {
  const { session, invalidate } = useSession();
  const store = useWorkCommands();
  const candidate = store.pending[options.scope];
  const pending =
    candidate?.operation.actorId === session?.user.id ? candidate : undefined;
  const [conflict, setConflict] = useState<{
    actorId: string;
    intent: Intent;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();
  const alive = useRef(true),
    lock = useRef(false);
  const visibleConflict =
    conflict?.actorId === session?.user.id ? conflict : null;
  const latest = useRef({
    options,
    session,
    pending,
    conflict: visibleConflict,
    waiting: cooldown.waiting,
    store,
  });
  latest.current = {
    options,
    session,
    pending,
    conflict: visibleConflict,
    waiting: cooldown.waiting,
    store,
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(
    intent: Intent,
    retry = false,
  ): Promise<Result<T> | undefined> {
    const current = latest.current;
    if (
      !current.session ||
      !current.options.authorized ||
      current.waiting ||
      lock.current
    )
      return;
    if (!retry && current.conflict && current.conflict.intent !== intent)
      return;
    if (
      retry
        ? !current.pending
        : !current.options.ready ||
          Boolean(current.pending) ||
          current.options.canRun?.(intent) === false
    )
      return;
    const actor = current.session;
    const op = retry
      ? current.pending!.operation
      : command(intent.path, intent.body, actor.user.id, current.options.etag);
    const savedIntent = retry ? current.pending!.intent : intent;
    const isCurrent = () =>
      alive.current &&
      latest.current.session?.access_token === actor.access_token;
    lock.current = true;
    setBusy(true);
    setError("");
    setConflict(null);
    current.store.save(current.options.scope, {
      operation: op,
      intent: savedIntent,
    });
    try {
      const result = await sendCommand<T>(op, actor);
      if (!isCurrent()) return;
      latest.current.store.save(current.options.scope, null);
      latest.current.options.refresh();
      return result;
    } catch (e) {
      if (!isCurrent()) return;
      setError(errorMessage(e));
      cooldown.hold(e);
      if (e instanceof ApiError && e.status === 401)
        invalidate(actor.access_token);
      else if (e instanceof ApiError && e.status < 500 && e.status !== 429) {
        latest.current.store.save(current.options.scope, null);
        if (
          [409, 412, 428].includes(e.status) &&
          current.options.reconfirm !== false
        )
          setConflict({ actorId: actor.user.id, intent: savedIntent });
        latest.current.options.refresh();
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const canConfirm =
    options.ready &&
    (!visibleConflict || options.canRun?.(visibleConflict.intent) !== false);
  return {
    run,
    pending,
    conflict: visibleConflict,
    error,
    busy,
    waiting: cooldown.waiting,
    blocked:
      busy ||
      cooldown.waiting ||
      !options.ready ||
      Boolean(pending) ||
      Boolean(visibleConflict),
    canConfirm,
    cancel: () => {
      setConflict(null);
      setError("");
    },
  };
}
export function CommandFeedback<T>({
  action,
  retryLabel = "重試原操作",
}: {
  action: ReturnType<typeof useCommand<T>>;
  retryLabel?: string;
}) {
  return (
    <>
      {action.error && (
        <p role="alert">
          {action.error}
          {action.conflict && "；已重新讀取工單，請確認目前內容後再操作。"}
        </p>
      )}
      {action.pending && (
        <div className="api-command">
          <p>
            原操作已保留：{action.pending.intent.label}
            。重試使用原本的內容與識別，不建立第二次操作。
          </p>
          <button
            className="button secondary"
            disabled={action.busy || action.waiting}
            onClick={() => {
              if (action.pending) void action.run(action.pending.intent, true);
            }}
          >
            {retryLabel}
          </button>
        </div>
      )}
      {action.conflict && (
        <div className="api-command">
          <p>待重新確認：{action.conflict.intent.label}</p>
          <button
            className="button primary"
            disabled={action.busy || action.waiting || !action.canConfirm}
            onClick={() => {
              if (action.conflict) void action.run(action.conflict.intent);
            }}
          >
            確認目前版本並重試
          </button>
          <button onClick={action.cancel}>取消這次操作</button>
        </div>
      )}
    </>
  );
}
