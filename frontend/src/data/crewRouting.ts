import type { LocationRecord } from "./locations";
import { demoOrigin } from "./binDemo";

export type CrewVehicle = "scooter" | "car";
export const vehicleLabels: Record<CrewVehicle, string> = {
  scooter: "機車",
  car: "汽車",
};
export const routingEndpoint =
  import.meta.env?.VITE_VALHALLA_URL ||
  "https://valhalla1.openstreetmap.de/route";
export interface RouteStep {
  instruction: string;
  meters: number;
}
export interface CrewRoute {
  geometry: [number, number][];
  meters: number;
  seconds: number;
  legs: { meters: number; seconds: number; steps: RouteStep[] }[];
}

function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

// Valhalla's JSON response uses six decimal places, unlike Google's polyline5.
function decodeShape(encoded: string): [number, number][] {
  let index = 0,
    lat = 0,
    lon = 0;
  const points: [number, number][] = [];
  function delta() {
    let value = 0,
      shift = 0,
      part = 0;
    do {
      if (index >= encoded.length || shift > 25)
        throw new Error("無法讀取道路路線。");
      part = encoded.charCodeAt(index++) - 63;
      if (part < 0 || part > 63) throw new Error("無法讀取道路路線。");
      value |= (part & 31) << shift;
      shift += 5;
    } while (part >= 32);
    return value & 1 ? ~(value >>> 1) : value >>> 1;
  }
  while (index < encoded.length) {
    lat += delta();
    lon += delta();
    if (!validCoordinate(lat / 1e6, lon / 1e6))
      throw new Error("路線座標無效。");
    points.push([lat / 1e6, lon / 1e6]);
  }
  if (points.length < 2) throw new Error("路線缺少道路座標。");
  return points;
}

// Maneuver enum is defined by Valhalla's route API. Unsupported instructions
// retain the provider's text instead of guessing a turn or translating roads.
const turns: Record<number, string> = {
  1: "出發",
  2: "向右出發",
  3: "向左出發",
  4: "抵達目的地",
  5: "目的地在右側",
  6: "目的地在左側",
  7: "道路接續",
  8: "繼續直行",
  9: "靠右前行",
  10: "右轉",
  11: "向右急轉",
  12: "向右迴轉",
  13: "向左迴轉",
  14: "向左急轉",
  15: "左轉",
  16: "靠左前行",
  17: "直行進入匝道",
  18: "向右進入匝道",
  19: "向左進入匝道",
  20: "從右側出口駛出",
  21: "從左側出口駛出",
  22: "保持直行",
  23: "保持靠右",
  24: "保持靠左",
  25: "匯入道路",
  26: "進入圓環",
  27: "駛出圓環",
  28: "進入渡輪",
  29: "離開渡輪",
  37: "向右匯入",
  38: "向左匯入",
};
type JsonRecord = Record<string, unknown>;
function object(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("路線服務回傳格式無效。");
  return value as JsonRecord;
}
function nonnegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("路線距離或時間無效。");
  return value;
}
export function parseCrewRoute(
  payload: unknown,
  vehicle: CrewVehicle,
  stopCount: number,
): CrewRoute {
  const trip = object(object(payload).trip);
  if (
    trip.status !== 0 ||
    trip.units !== "kilometers" ||
    !Array.isArray(trip.legs) ||
    trip.legs.length !== stopCount ||
    !stopCount
  )
    throw new Error("無法取得所有站點的完整道路路線。");
  const summary = object(trip.summary);
  const geometry: [number, number][] = [];
  const legs = trip.legs.map((raw) => {
    const leg = object(raw),
      totals = object(leg.summary);
    if (
      typeof leg.shape !== "string" ||
      leg.shape.length > 1000000 ||
      !Array.isArray(leg.maneuvers) ||
      !leg.maneuvers.length
    )
      throw new Error("路線缺少道路或轉彎指引。");
    geometry.push(...decodeShape(leg.shape));
    const steps = leg.maneuvers.map((rawStep) => {
      const step = object(rawStep);
      if (
        step.travel_type !== (vehicle === "car" ? "car" : "motor_scooter") ||
        typeof step.instruction !== "string" ||
        !step.instruction.trim()
      )
        throw new Error("路線服務未提供所選車種的指引。");
      let turn = typeof step.type === "number" ? turns[step.type] : undefined;
      if (
        step.type === 1 &&
        typeof step.bearing_after === "number" &&
        Number.isFinite(step.bearing_after) &&
        step.bearing_after >= 0 &&
        step.bearing_after < 360
      ) {
        const direction = [
          "北",
          "東北",
          "東",
          "東南",
          "南",
          "西南",
          "西",
          "西北",
        ][Math.round(step.bearing_after / 45) % 8];
        turn = "向" + direction + "出發";
      }
      const streets = Array.isArray(step.street_names)
        ? step.street_names
            .filter((name): name is string => typeof name === "string")
            .join("／")
        : "";
      const exit =
        step.type === 26 && typeof step.roundabout_exit_count === "number"
          ? "，由第 " + step.roundabout_exit_count + " 個出口離開"
          : "";
      return {
        instruction: turn
          ? turn +
            exit +
            (streets && ![4, 5, 6].includes(Number(step.type))
              ? "，進入" + streets
              : "")
          : step.instruction,
        meters: nonnegative(step.length) * 1000,
      };
    });
    return {
      meters: nonnegative(totals.length) * 1000,
      seconds: nonnegative(totals.time),
      steps,
    };
  });
  return {
    geometry,
    legs,
    meters: nonnegative(summary.length) * 1000,
    seconds: nonnegative(summary.time),
  };
}

export async function requestCrewRoute(
  vehicle: CrewVehicle,
  stops: LocationRecord[],
  signal: AbortSignal,
): Promise<CrewRoute> {
  if (
    !stops.length ||
    stops.some(
      (stop) =>
        stop.kind !== "bin" || !validCoordinate(stop.latitude, stop.longitude),
    )
  )
    throw new Error("沒有可規劃的有效桶位。");
  const costing = vehicle === "car" ? "auto" : "motor_scooter";
  const response = await fetch(routingEndpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": "BinSoon-local-demo",
    },
    body: JSON.stringify({
      locations: [
        { lat: demoOrigin[0], lon: demoOrigin[1], type: "break" },
        ...stops.map((stop) => ({
          lat: stop.latitude,
          lon: stop.longitude,
          type: "break",
        })),
      ],
      costing,
      costing_options: {
        [costing]:
          vehicle === "scooter"
            ? { top_speed: 60, exclude_highways: true, exclude_ferries: true }
            : { exclude_ferries: true },
      },
      units: "kilometers",
      language: "en-US",
      directions_type: "instructions",
    }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "路線服務忙碌，請稍後重試。"
        : "目前無法取得道路路線，請稍後重試。",
    );
  return parseCrewRoute(await response.json(), vehicle, stops.length);
}
