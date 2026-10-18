import { readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import assert from "node:assert/strict";

const districts = [
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
];
const dataDir = new URL("../../backend/data/", import.meta.url);
const read = async (file) =>
  parse(await readFile(new URL(file, dataDir), "utf8"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });
const binsFile = "existing_bins_all_taipei.csv";
let placesFile = "hotspots_all_taipei.csv";
let places = await read(placesFile);
if (!("source_type" in places[0]) && "hotspot_id" in places[0]) {
  placesFile = "daan_hotspot_gap_screening.csv";
  places = await read(placesFile);
  console.warn("注意：原始 CSV 檔名與內容對調，依實際欄位載入場所代表點。");
}
const bins = await read(binsFile);
assert.equal(bins.length, 681);
assert.equal(places.length, 130);
const ids = new Set();
const sources = new Set();
function normalize(rows, kind, source_file) {
  return rows.map((row) => {
    assert.equal(
      row.source_type,
      kind === "bin" ? "city_bin_inventory" : "scenic_commercial_aggregate",
    );
    assert.equal(
      row.location_precision,
      kind === "bin" ? "point_as_published" : "representative_point_only",
    );
    assert.ok(districts.includes(row.district));
    assert.ok(row.id && !ids.has(row.id));
    ids.add(row.id);
    const source_row = Number(row.source_row);
    assert.ok(Number.isInteger(source_row) && source_row >= 2);
    const sourceKey = `${row.source_type}:${source_row}`;
    assert.ok(!sources.has(sourceKey));
    sources.add(sourceKey);
    const longitude = Number(row.longitude),
      latitude = Number(row.latitude);
    assert.ok(
      row.longitude.trim() &&
        Number.isFinite(longitude) &&
        Math.abs(longitude) <= 180,
    );
    assert.ok(
      row.latitude.trim() &&
        Number.isFinite(latitude) &&
        Math.abs(latitude) <= 90,
    );
    if (kind === "bin") assert.equal(row.status, "existing");
    const reported_count = kind === "place" ? Number(row.reported_count) : null;
    if (kind === "place")
      assert.ok(
        row.reported_count.trim() &&
          Number.isInteger(reported_count) &&
          reported_count >= 0,
      );
    const label = kind === "bin" ? row.address : row.name;
    assert.ok(label?.trim());
    return {
      id: row.id,
      kind,
      district: row.district,
      label,
      address: row.address ?? null,
      longitude,
      latitude,
      note: row.note,
      source_type: row.source_type,
      source_row,
      source_file,
      location_precision: row.location_precision,
      reported_count,
    };
  });
}
const locations = [
  ...normalize(bins, "bin", binsFile),
  ...normalize(places, "place", placesFile),
];
assert.equal(
  locations.filter((p) => p.kind === "bin" && p.district === "大安區").length,
  47,
);
assert.equal(
  locations.filter((p) => p.kind === "place" && p.district === "大安區").length,
  18,
);
assert.equal(new Set(locations.map((p) => p.district)).size, 12);
const output = JSON.stringify(locations, null, 2) + "\n";
const target = new URL("../src/data/locations.json", import.meta.url);
if (process.argv.includes("--check"))
  assert.equal(
    await readFile(target, "utf8"),
    output,
    "資料快照與 CSV 不符，請執行 npm run data:generate",
  );
else await writeFile(target, output);
console.log(
  "驗證通過：811 筆位置紀錄 = 681 筆公布桶位置 + 130 筆場所代表點；大安區 47 + 18；12 行政區。",
);
