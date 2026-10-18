import { kindLabel, type LocationRecord } from "../data/locations";
import { Mascot } from "./Mascot";
export function LocationDetails({
  location,
  onClose,
}: {
  location: LocationRecord;
  onClose: () => void;
}) {
  return (
    <section className="details" aria-label="位置詳情">
      <button className="close" onClick={onClose} aria-label="關閉位置詳情">
        ×
      </button>
      <div className="eyebrow">
        <Mascot kind={location.kind} /> {kindLabel[location.kind]} ·{" "}
        {location.district}
      </div>
      <h2>{location.label}</h2>
      <p className="precision">
        {location.kind === "bin"
          ? "依公布座標標示，實際位置仍請現場確認。"
          : "此為場所代表點，並非個別清潔箱位置。周邊統計不代表桶的實際座標。"}
      </p>
      {location.kind === "place" && (
        <p>來源統計：周邊 {location.reported_count} 處清潔箱</p>
      )}
      <dl>
        <dt>備註</dt>
        <dd>{location.note || "來源未提供備註"}</dd>
        <dt>經度 / 緯度</dt>
        <dd className="coordinates">
          {location.longitude} / {location.latitude}
        </dd>
      </dl>
      <details>
        <summary>來源與位置精度</summary>
        <p>
          {location.source_file} · 原始列 {location.source_row}
        </p>
        <p>
          {location.source_type}
          <br />
          {location.location_precision}
        </p>
      </details>
    </section>
  );
}
