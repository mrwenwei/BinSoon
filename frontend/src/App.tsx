import { useCallback, useMemo, useState } from "react";
import {
  districts,
  filterLocations,
  kindLabel,
  type LocationKind,
  type LocationRecord,
} from "./data/locations";
import { LocationMap } from "./map/LocationMap";
import { Mascot } from "./components/Mascot";
import { LocationDetails } from "./components/LocationDetails";
export default function App() {
  const [district, setDistrict] = useState("all");
  const [kind, setKind] = useState<"all" | LocationKind>("all");
  const [selected, setSelected] = useState<LocationRecord | null>(null);
  const visible = useMemo(
    () => filterLocations(district, kind),
    [district, kind],
  );
  const select = useCallback(
    (location: LocationRecord) => setSelected(location),
    [],
  );
  function changeDistrict(value: string) {
    setDistrict(value);
    setSelected(null);
  }
  function changeKind(value: "all" | LocationKind) {
    setKind(value);
    setSelected(null);
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="BinSoon 首頁">
          <Mascot />
          <span>
            BinSoon<span className="brand-sub">台北丟垃圾變順</span>
          </span>
        </a>
        <span className="prototype">
          地圖 V0 <span>· 介面原型</span>
        </span>
        <a
          className="feedback"
          href="https://github.com/mrwenwei/BinSoon/issues/1"
          target="_blank"
          rel="noreferrer"
        >
          一起討論 ↗
        </a>
      </header>
      <main>
        <aside className="explorer" aria-label="位置探索">
          <div className="intro">
            <span className="eyebrow">TAIPEI / 城市小幫手</span>
            <h1>
              找個地方，
              <br />
              讓垃圾有家<span className="dot">.</span>
            </h1>
            <p>帶著小夥伴，探索台北的清潔箱位置。</p>
          </div>
          <div className="total">
            <strong>811</strong>
            <span>
              筆位置紀錄
              <br />
              <small>681 公布桶位置 ＋ 130 場所代表點</small>
            </span>
          </div>
          <div className="filters">
            <label htmlFor="district">選擇行政區</label>
            <select
              id="district"
              value={district}
              onChange={(e) => changeDistrict(e.target.value)}
            >
              <option value="all">全台北市 · 12 行政區</option>
              {districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <div className="tabs" role="group" aria-label="位置類型">
              {(["all", "bin", "place"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={kind === value}
                  onClick={() => changeKind(value)}
                >
                  {value === "all" ? "全部" : kindLabel[value]}
                </button>
              ))}
            </div>
          </div>
          <div className="results-heading" role="status">
            <strong>{district === "all" ? "全台北市" : district}</strong>
            <span>{visible.length} 筆位置紀錄</span>
          </div>
          <div className="location-list" aria-label="位置清單">
            {visible.length === 0 && (
              <p className="empty">這個行政區尚無此類資料。</p>
            )}
            {visible.map((location) => (
              <button
                className={`location-row ${selected?.id === location.id ? "active" : ""}`}
                key={location.id}
                onClick={() => select(location)}
                aria-pressed={selected?.id === location.id}
              >
                <Mascot kind={location.kind} />
                <span>
                  <strong>{location.label}</strong>
                  <small>
                    {location.district} · {kindLabel[location.kind]}
                  </small>
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <p className="data-note">
            公開資料快照 · 非即時桶況
            <br />
            場所代表點不代表個別清潔箱位置。
          </p>
        </aside>
        <section className="map-section" aria-label="地圖瀏覽">
          <LocationMap
            locations={visible}
            selected={selected}
            onSelect={select}
          />
          <div className="legend">
            <span>
              <Mascot />
              公布桶位置
            </span>
            <span>
              <Mascot kind="place" />
              場所代表點
            </span>
          </div>
          {selected && (
            <LocationDetails
              location={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </section>
      </main>
    </div>
  );
}
