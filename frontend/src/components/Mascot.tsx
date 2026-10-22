import type { LocationKind } from "../data/locations";
import type { BinState } from "../data/binState";
import { mascotSvg } from "./mascotSvg";
import { binBotSvg } from "../map/binBot";
export function Mascot({
  kind = "bin",
  state,
}: {
  kind?: LocationKind;
  state?: BinState;
}) {
  // 桶用最新的垃圾桶機器人（靜態表情；動態只在地圖標記 hover／選中時播放），
  // 場所代表點仍是 Bin友。
  const svg =
    kind === "bin"
      ? binBotSvg(state ?? "hungry", false)
      : mascotSvg(kind, state);
  return (
    <span
      className="mascot"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
