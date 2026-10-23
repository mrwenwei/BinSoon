import {
  query,
  request,
  type ApiLocation,
  type PageData,
  type Proposal,
} from "../../data/api";
import type { ProposalTally } from "../../map/browseMarkers";
import { useSession } from "./SessionContext";
import { useApi } from "./useApi";
import { LoadState } from "./LoadState";
import { VoteBallot, VoteHeader, useProposalShare } from "./VotePanel";

// 地圖抽屜裡的建議點（proposed）：標題列（問句＋地點名＋分享）＋投票面板。
// 以 Bin ID 找到對應提案後才顯示儀表與投票鈕；找不到提案時說明仍須現勘。
export function BinProposal({
  location,
  onTally,
}: {
  location: ApiLocation;
  onTally?: (tally: ProposalTally) => void;
}) {
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
  const name = lookup.data?.approved_name || location.label;
  const { share, sheet } = useProposalShare(location.id, name);
  return (
    <section
      className="api-bin-detail mx-bin mx-vote-panel"
      aria-label="設置點投票"
    >
      <VoteHeader name={name} onShare={() => void share()} />
      {lookup.data ? (
        <VoteBallot
          key={lookup.data.id}
          id={lookup.data.id}
          binId={location.id}
          onShare={() => void share()}
          onTally={onTally}
        />
      ) : (
        <>
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
      {sheet}
    </section>
  );
}
