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
export function Compartments({ items }: { items?: BinStatus[] }) {
  if (!items?.length) return null;
  return (
    <section className="api-compartments" aria-label="各類桶槽">
      <h3>同一點位的獨立桶槽</h3>
      {items.map((item) => (
        <div key={item.waste_type}>
          <p>
            {wasteName(item.waste_type)}：
            {item.fill_level_pct == null
              ? "滿度未知"
              : `${item.fill_level_pct}%`}{" "}
            ·{" "}
            {item.is_usable
              ? "可使用"
              : item.operational_status === "repair"
                ? "維修中"
                : "目前不可用"}
          </p>
          <small>
            {classificationName(item.classification_source)} ·{" "}
            {item.reading_source_type || "讀值來源未知"}
          </small>
        </div>
      ))}
      <p className="tiny">分類為展示假設，未經現場盤點；兩槽仍是同一個位置。</p>
    </section>
  );
}
