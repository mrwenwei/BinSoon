import { wasteLabels, wasteTypes, type WasteType } from "../data/binState";

// 一般垃圾與資源回收只用圖示和文字區分，不另外加顏色（顏色只表示桶況）。
export function WasteIcon({ type }: { type: WasteType }) {
  return (
    <span className="waste-icon" aria-hidden="true">
      {type === "general" ? (
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
        >
          <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" />
        </svg>
      ) : (
        "♻"
      )}
    </span>
  );
}

export function WastePicker({
  value,
  onChange,
  name,
  disabled,
}: {
  value: WasteType;
  onChange: (value: WasteType) => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="waste-picker" disabled={disabled}>
      <legend>回報哪一桶？</legend>
      <div className="segmented">
        {wasteTypes.map((type) => (
          <label key={type}>
            <input
              type="radio"
              name={name}
              value={type}
              checked={value === type}
              onChange={() => onChange(type)}
            />
            <WasteIcon type={type} />
            {wasteLabels[type]}
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
