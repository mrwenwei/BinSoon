import type { LocationKind } from "../data/locations";
import { mascotSvg } from "./mascotSvg";
export function Mascot({ kind = "bin" }: { kind?: LocationKind }) {
  return (
    <span
      className="mascot"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: mascotSvg(kind) }}
    />
  );
}
