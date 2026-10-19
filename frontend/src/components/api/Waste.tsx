import { type BinStatus } from "../../data/api";
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
}: {
  value: WasteType | "";
  onChange: (value: WasteType | "") => void;
  all?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="api-waste-select">
      垃圾種類
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
export function Compartments({
  items,
  selected,
  onSelect,
}: {
  items?: BinStatus[];
  selected?: WasteType;
  onSelect?: (value: WasteType) => void;
}) {
  if (!items?.length) return null;
  return (
    <section
      className={`api-compartments${onSelect ? " compartment-picker" : ""}`}
      aria-label="各類桶槽"
    >
      <h3>同一點位的獨立桶槽</h3>
      <div className="compartment-grid">
        {items.map((item) => {
          const content = (
            <>
              <span className="compartment-label">
                {wasteName(item.waste_type)}：
                <strong>
                  {item.fill_level_pct == null
                    ? "滿度未知"
                    : `${item.fill_level_pct}%`}
                </strong>
              </span>
              <span className="compartment-availability">
                {item.is_usable
                  ? "可使用"
                  : item.operational_status === "repair"
                    ? "維修中"
                    : "目前不可用"}
              </span>
              {item.fill_level_pct != null && (
                <meter
                  min="0"
                  max="100"
                  value={item.fill_level_pct}
                  aria-label={`${wasteName(item.waste_type)}滿度`}
                />
              )}
              {onSelect && (
                <span className="compartment-choice">
                  {selected === item.waste_type ? "✓ 目前選擇" : "選擇此種類 →"}
                </span>
              )}
            </>
          );
          return onSelect ? (
            <button
              key={item.waste_type}
              type="button"
              className="compartment-card"
              data-usable={item.is_usable}
              aria-pressed={selected === item.waste_type}
              aria-label={`選擇${wasteName(item.waste_type)}`}
              onClick={() => onSelect(item.waste_type)}
            >
              {content}
            </button>
          ) : (
            <div key={item.waste_type} className="compartment-card">
              {content}
            </div>
          );
        })}
      </div>
      <p className="tiny">分類為展示假設，未經現場盤點；兩槽仍是同一個位置。</p>
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
    </section>
  );
}
