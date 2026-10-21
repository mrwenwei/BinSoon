import {
  query,
  request,
  type ApiLocation,
  type PageData,
  type Proposal,
} from "../../data/api";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { ProposalDetail } from "./ProposalPages";

export function BinProposal({ location }: { location: ApiLocation }) {
  const { session } = useSession();
  const lookup = useApi(`bin-proposal/${location.id}`, async (signal) => {
    // Match by Bin ID across all pages; nearby coordinates are not identity.
    let offset = 0;
    while (true) {
      const result = await request<PageData<Proposal>>(
        query("/proposals", {
          district: location.district,
          limit: 100,
          offset,
        }),
        { signal, token: session?.access_token },
      );
      const item = result.data.items.find((p) => p.bin_id === location.id);
      if (item) return { ...result, data: item };
      offset += result.data.items.length;
      if (!result.data.items.length || offset >= result.data.page.total)
        return { ...result, data: null };
    }
  });
  return (
    <section className="api-bin-detail mx-bin" aria-label="設置點投票">
      <h1>{location.label}</h1>
      {lookup.data ? (
        <ProposalDetail
          key={lookup.data.id}
          id={lookup.data.id}
          embedded
          binId={location.id}
        />
      ) : (
        <>
          <p>{location.district} · 建議設置點／待現勘</p>
          <LoadState {...lookup} />
          {!lookup.loading && !lookup.error && (
            <p>此建議點尚無可投票提案，仍須現勘。</p>
          )}
        </>
      )}
      {session?.user.roles.includes("admin") && (
        <a className="button secondary" href={`#admin/bins/${location.id}`}>
          管理桶生命週期
        </a>
      )}
    </section>
  );
}
