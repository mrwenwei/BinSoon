import type { ReactNode } from "react";
import {
  stationState,
  usableCount,
  wasteLabels,
  type BinState,
  type WasteType,
} from "../data/binState";
import { stateVisual } from "./binVisual";
import { WasteIcon } from "./WasteType";

export type CardCompartment = {
  wasteType: WasteType;
  state: BinState;
  pct: number | null;
  // 列上的狀態文字（例如「餓了 · 62%」「維修中」「失聯」）。
  statusText: string;
};

function summaryFor(list: CardCompartment[], state: BinState) {
  if (list.length === 1)
    return state === "hungry"
      ? "餓了，還裝得下"
      : state === "full"
        ? "吃飽了"
        : "失聯，讀不到滿度";
  const usable = list.filter((c) => c.state === "hungry");
  if (usable.length === list.length) return "兩桶都還能丟";
  if (usable.length === 1) return `${wasteLabels[usable[0].wasteType]}還能丟`;
  if (list.every((c) => c.state === "full")) return "兩桶都吃飽了";
  if (list.every((c) => c.state === "offline")) return "兩桶都失聯";
  return "現在沒有桶能丟";
}

// 滿度條（餓了實心青綠、吃飽了橘色斜紋、失聯虛線空條）；地圖清單列也沿用。
export function FillBar({
  c,
  thick = false,
}: {
  c: CardCompartment;
  thick?: boolean;
}) {
  return (
    <span
      className={`fill-bar ${stateVisual[c.state].className}${thick ? " thick" : ""}`}
      aria-hidden="true"
    >
      {c.pct !== null && c.state !== "offline" && (
        <span style={{ width: `${Math.max(0, Math.min(100, c.pct))}%` }} />
      )}
    </span>
  );
}

// 設計系統 StationCard（兩桶一組，預設）與 SingleBinCard（只有一種桶時，備用）。
// 色帶：任一桶能丟就是青綠、沒有能丟的桶且有吃飽了就是橘色、全部失聯是灰色加虛線。
export function StationCard({
  title,
  subtitle,
  compartments,
  label = "AVAILABLE · 示意",
  note,
  stats,
  children,
  className = "",
  selectedWaste,
  onSelectWaste,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  compartments: CardCompartment[];
  label?: string;
  note?: ReactNode;
  stats?: { label: string; value: ReactNode }[];
  children?: ReactNode;
  className?: string;
  selectedWaste?: WasteType;
  onSelectWaste?: (type: WasteType) => void;
}) {
  const state = compartments.length
    ? stationState(compartments)
    : ("offline" as BinState);
  const single = compartments.length === 1;
  const visual = stateVisual[state];
  return (
    <section
      className={`station-card ${visual.className} ${single ? "single" : ""} ${className}`}
      aria-label="桶況"
    >
      {(title || subtitle) && (
        <header className="station-head">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      <div className="station-band">
        <div>
          <span className="band-label">
            {single ? "FILL LEVEL · 示意" : label}
          </span>
          <strong className="band-status">
            {summaryFor(compartments, state)}
          </strong>
        </div>
        {single ? (
          <span className="band-numeral xl">
            {compartments[0].pct ?? "—"}
            {compartments[0].pct !== null && <small>%</small>}
          </span>
        ) : (
          <span
            className="band-numeral"
            aria-label={`${usableCount(compartments)} 桶能丟，共 ${compartments.length} 桶`}
          >
            {usableCount(compartments)}
            <small>/{compartments.length}</small>
          </span>
        )}
      </div>
      {single ? (
        <FillBar c={compartments[0]} thick />
      ) : (
        state === "full" && (
          <span className="hazard-stripe" aria-hidden="true" />
        )
      )}
      {single ? (
        <>
          <p
            className={`single-status ${stateVisual[compartments[0].state].className}`}
          >
            <WasteIcon type={compartments[0].wasteType} />
            {wasteLabels[compartments[0].wasteType]}
            <span className="compartment-status">
              {compartments[0].statusText}
            </span>
          </p>
          {stats && (
            <dl className="station-stats">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      ) : (
        <ul className="compartments" aria-label="一般垃圾與資源回收">
          {compartments.map((c) => {
            const content = (
              <>
                <span className="compartment-name">
                  <WasteIcon type={c.wasteType} />
                  {wasteLabels[c.wasteType]}
                  <span className="compartment-status">{c.statusText}</span>
                  {/* 手機桶詳情藏了狀態字，吃飽了那一槽仍要寫出「吃飽了」（CSS 控制顯示）。 */}
                  {c.state === "full" && (
                    <span className="compartment-full-tag" aria-hidden="true">
                      吃飽了
                    </span>
                  )}
                </span>
                <span className="compartment-pct">
                  {c.pct ?? "—"}
                  {c.pct !== null && <small>%</small>}
                </span>
                <FillBar c={c} />
                {onSelectWaste && (
                  <span className="compartment-choice">
                    {selectedWaste === c.wasteType
                      ? "✓ 目前選擇"
                      : "選擇此種類 →"}
                  </span>
                )}
              </>
            );
            return (
              <li
                key={c.wasteType}
                className={`compartment ${stateVisual[c.state].className}${onSelectWaste ? " selectable" : ""}`}
              >
                {onSelectWaste ? (
                  <button
                    type="button"
                    className="compartment-select"
                    aria-label={`選擇${wasteLabels[c.wasteType]}`}
                    aria-pressed={selectedWaste === c.wasteType}
                    onClick={() => onSelectWaste(c.wasteType)}
                  >
                    {content}
                  </button>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!single && stats && (
        <dl className="station-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(note || children) && (
        <div className="station-foot">
          {note && <div className="station-note">{note}</div>}
          {children && <div className="station-actions">{children}</div>}
        </div>
      )}
    </section>
  );
}
