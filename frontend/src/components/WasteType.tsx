import { WASTE_ICON_ATTRS, WASTE_ICON_ELEMENTS } from "./Icon";
import { wasteLabels, wasteTypes, type WasteType } from "../data/binState";

// 一般垃圾與資源回收只用圖示和文字區分，不另外加顏色（顏色只表示桶況）。
// 圖示＝Lucide trash-2／recycle（資料在 Icon.tsx，地圖血條共用），顏色 currentColor。
export function WasteIcon({ type }: { type: WasteType }) {
  return (
    <span className="waste-icon" aria-hidden="true">
      <svg
        viewBox={WASTE_ICON_ATTRS.viewBox}
        fill={WASTE_ICON_ATTRS.fill}
        stroke={WASTE_ICON_ATTRS.stroke}
        strokeWidth={WASTE_ICON_ATTRS["stroke-width"]}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {WASTE_ICON_ELEMENTS[type].map(([tag, attrs]) =>
          tag === "line" ? (
            <line key={JSON.stringify(attrs)} {...attrs} />
          ) : (
            <path key={attrs.d} d={attrs.d} />
          ),
        )}
      </svg>
    </span>
  );
}

// 選用：legend 換題目文字；iconOnly＝純圖示（兩格 44×44 相連，題目與每格文字
// 只給輔助科技，桌面另有 title 提示），給地圖標題列用。預設樣式不變。
export function WastePicker({
  value,
  onChange,
  name,
  disabled,
  legend = "回報哪一桶？",
  iconOnly = false,
}: {
  value: WasteType;
  onChange: (value: WasteType) => void;
  name: string;
  disabled?: boolean;
  legend?: string;
  iconOnly?: boolean;
}) {
  return (
    <fieldset
      className={`waste-picker${iconOnly ? " icon-only" : ""}`}
      disabled={disabled}
    >
      <legend className={iconOnly ? "visually-hidden" : undefined}>
        {legend}
      </legend>
      <div className="segmented">
        {wasteTypes.map((type) => (
          <label key={type} title={iconOnly ? wasteLabels[type] : undefined}>
            <input
              type="radio"
              name={name}
              value={type}
              checked={value === type}
              onChange={() => onChange(type)}
            />
            <WasteIcon type={type} />
            {iconOnly ? (
              <span className="visually-hidden">{wasteLabels[type]}</span>
            ) : (
              wasteLabels[type]
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// 工單與回報標示是哪一槽（後端依 waste_type 分開工單）。
export function WasteTag({ type }: { type: WasteType }) {
  return (
    <span className="waste-tag">
      <WasteIcon type={type} />
      {wasteLabels[type]}
    </span>
  );
}
