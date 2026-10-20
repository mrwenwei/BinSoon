import { stateLabels } from "../../data/binState";
import { StationCard, type CardCompartment } from "../StationCard";
import { apiBinState, apiCompartments, type BinStatus } from "../../data/api";
import {
  classificationName,
  wasteName,
  type WasteMetadata,
  type WasteType,
} from "../../data/waste";
export function WasteSelect({
  value,
  onChange,
  all = false,
  disabled = false,
  hideLabel = false,
}: {
  value: WasteType | "";
  onChange: (value: WasteType | "") => void;
  all?: boolean;
  disabled?: boolean;
  // 選用：標籤文字只給輔助科技（地圖篩選列空間不夠時用）。
  hideLabel?: boolean;
}) {
  return (
    <label className="api-waste-select">
      {hideLabel ? (
        <span className="visually-hidden">垃圾種類</span>
      ) : (
        "垃圾種類"
      )}
      <select
        aria-label="垃圾種類"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as WasteType | "")}
      >
        {all && <option value="">全部種類</option>}
        <option value="general">一般垃圾</option>
        <option value="recycling">資源回收</option>
      </select>
    </label>
  );
}
export function WasteInfo({
  value,
}: {
  value: Partial<
    Omit<WasteMetadata, "waste_type"> & { waste_type: WasteType | null }
  >;
}) {
  return (
    <p className="tiny">
      {wasteName(value.waste_type)} · 分類依據：
      {classificationName(value.classification_source)}
    </p>
  );
}
export function statusText(status: BinStatus | null) {
  return status?.operational_status === "removed"
    ? "已撤除"
    : status?.operational_status === "repair"
      ? "維修中"
      : status?.fill_level_pct == null
        ? stateLabels.offline
        : `${stateLabels[apiBinState(status)]} · ${status.fill_level_pct}%`;
}
export function compartmentCards(items: BinStatus[]): CardCompartment[] {
  return items.map((item) => ({
    wasteType: item.waste_type,
    state: apiBinState(item),
    pct: item.operational_status === "removed" ? null : item.fill_level_pct,
    statusText: statusText(item),
  }));
}
export function CompartmentSources({ items }: { items: BinStatus[] }) {
  return (
    <>
      <p className="tiny">
        {items.length > 1
          ? "分類為展示假設，未經現場盤點；兩槽仍是同一個位置。"
          : "後端未提供完整分槽資料，僅顯示已回傳種類；分類為展示假設，未經現場盤點。"}
      </p>
      <details className="compartment-sources">
        <summary>分類與讀值來源</summary>
        {items.map((item) => (
          <p key={item.waste_type}>
            {wasteName(item.waste_type)} ·{" "}
            {classificationName(item.classification_source)} ·{" "}
            {item.reading_source_type || "讀值來源未知"}
          </p>
        ))}
      </details>
    </>
  );
}
export function Compartments({ items }: { items?: BinStatus[] }) {
  if (!items?.length) return null;
  return (
    <section className="api-compartments" aria-label="各類桶槽">
      <h3>同一點位的獨立桶槽</h3>
      <StationCard
        compartments={compartmentCards(apiCompartments(items[0], items))}
      />
      <CompartmentSources items={items} />
    </section>
  );
}
