// 市民步行導航的逐步轉彎指示。Valhalla 的 maneuver 以「在這裡做某個動作、接著走 length」
// 表示；導航要的是「往前 120 公尺後右轉」，所以每一列＝一段直行＋下一個動作。
// 動作文字沿用 crewRouting 已翻成中文的 instruction（Valhalla 不提供中文敘述，
// 請求仍用 en-US，由前端依 maneuver 類型與街名組成中文）。
import type { CrewRoute } from "./crewRouting";
import { cumulativeMeters } from "./routeGeometry";

export type TurnKind = "straight" | "left" | "right" | "uturn" | "arrive";
export interface NavStep {
  /** 例如「沿信義路往前 120 公尺後右轉，進入新生南路」。 */
  text: string;
  /** 只有動作：「右轉，進入新生南路」。 */
  action: string;
  kind: TurnKind;
  /** 這一列從路線第幾公尺開始、在第幾公尺做動作。 */
  startMeters: number;
  endMeters: number;
}

const RIGHT = [9, 10, 11, 18, 20, 23, 37];
const LEFT = [14, 15, 16, 19, 21, 24, 38];
const UTURN = [12, 13];
const ARRIVE = [4, 5, 6];
export function turnKind(type: number | undefined): TurnKind {
  if (type === undefined) return "straight";
  if (ARRIVE.includes(type)) return "arrive";
  if (RIGHT.includes(type)) return "right";
  if (LEFT.includes(type)) return "left";
  if (UTURN.includes(type)) return "uturn";
  return "straight";
}

export function distanceText(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} 公里`;
  const rounded =
    meters >= 100 ? Math.round(meters / 10) * 10 : Math.round(meters);
  return `${Math.max(1, rounded)} 公尺`;
}

const arriveText = (type: number | undefined) =>
  type === 5
    ? "抵達目的桶，目的桶在右側"
    : type === 6
      ? "抵達目的桶，目的桶在左側"
      : "抵達目的桶";

export function buildNavSteps(route: CrewRoute): NavStep[] {
  const flat = route.legs.flatMap((leg) => leg.steps);
  if (!flat.length) return [];
  const cum = cumulativeMeters(route.geometry);
  const total = cum[cum.length - 1] || route.meters;
  // 每個 maneuver 的起點公尺數：優先用 begin_shape_index；缺少時依各段長度比例換算。
  const lengthSum = flat.reduce((sum, step) => sum + step.meters, 0);
  const scale = lengthSum > 0 ? total / lengthSum : 1;
  let walkedLength = 0;
  const starts = flat.map((step) => {
    const fromLengths = walkedLength * scale;
    walkedLength += step.meters;
    const index = step.beginIndex;
    return index !== undefined && index < cum.length ? cum[index] : fromLengths;
  });
  const endsWithArrival = ARRIVE.includes(flat[flat.length - 1].type ?? -1);
  const rows: NavStep[] = [];
  const segments = endsWithArrival ? flat.length - 1 : flat.length;
  for (let k = 0; k < segments; k++) {
    const next = flat[k + 1];
    const endMeters = next ? Math.max(starts[k + 1], starts[k]) : total;
    const nextType = next?.type;
    const kind = next ? turnKind(nextType) : "arrive";
    const action =
      !next || kind === "arrive" ? arriveText(nextType) : next.instruction;
    const street = flat[k].streets ? `沿${flat[k].streets}` : "";
    rows.push({
      text: `${street}往前 ${distanceText(flat[k].meters)}後${action}`,
      action,
      kind,
      startMeters: Math.min(starts[k], total),
      endMeters: Math.min(endMeters, total),
    });
  }
  const last = flat[flat.length - 1];
  rows.push({
    text: arriveText(endsWithArrival ? last.type : undefined),
    action: arriveText(endsWithArrival ? last.type : undefined),
    kind: "arrive",
    startMeters: total,
    endMeters: total,
  });
  return rows;
}

/** 走了 walked 公尺時正在執行哪一列（抵達前不會落在最後的抵達列）。 */
export function activeStep(steps: NavStep[], walked: number): number {
  let index = 0;
  for (let k = 0; k < steps.length - 1; k++)
    if (steps[k].startMeters <= walked) index = k;
  return index;
}
