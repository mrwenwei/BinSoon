import snapshot from "./locations.json" with { type: "json" };
export type LocationKind = "bin" | "place";
export interface LocationRecord {
  id: string;
  kind: LocationKind;
  district: string;
  label: string;
  address: string | null;
  longitude: number;
  latitude: number;
  note: string;
  source_type: string;
  source_row: number | null;
  source_file: string | null;
  location_precision: "point_as_published" | "representative_point_only" | null;
  reported_count: number | null;
  bin_status?: import("./api").BinStatus | null;
  compartments?: import("./api").BinStatus[];
}
export const locations = snapshot as LocationRecord[];
export const districts = [
  "中正區",
  "大同區",
  "中山區",
  "松山區",
  "大安區",
  "萬華區",
  "信義區",
  "士林區",
  "北投區",
  "內湖區",
  "南港區",
  "文山區",
] as const;
export const kindLabel: Record<LocationKind, string> = {
  bin: "公布桶位置",
  place: "場所代表點",
};
export function filterLocations(district: string, kind: "all" | LocationKind) {
  return locations.filter(
    (p) =>
      (district === "all" || p.district === district) &&
      (kind === "all" || p.kind === kind),
  );
}
