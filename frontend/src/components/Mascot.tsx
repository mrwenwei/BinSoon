import type { LocationKind } from "../data/locations";
import type { BinState } from "../data/binState";
import { mascotSvg } from "./mascotSvg";
export function Mascot({
  kind = "bin",
  state,
}: {
  kind?: LocationKind;
  state?: BinState;
}) {
  return (
    <span
      className="mascot"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: mascotSvg(kind, state) }}
    />
  );
}
