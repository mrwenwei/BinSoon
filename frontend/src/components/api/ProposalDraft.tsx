import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "./SessionContext";
type Draft = {
  name: string;
  reason: string;
  latitude: string;
  longitude: string;
};
const empty = (): Draft => ({
  name: "",
  reason: "",
  latitude: "",
  longitude: "",
});
const Context = createContext<{
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  clear: () => void;
} | null>(null);
export function ProposalDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(empty);
  const { session } = useSession();
  const actor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!session) return;
    if (actor.current && actor.current !== session.user.id) setDraft(empty());
    actor.current = session.user.id;
  }, [session?.user.id]);
  return (
    <Context.Provider
      value={{
        draft,
        update: (patch) => setDraft((old) => ({ ...old, ...patch })),
        clear: () => setDraft(empty()),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProposalDraft() {
  return useContext(Context)!;
}
