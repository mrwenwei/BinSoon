import { apiBinState, type BinStatus } from "../../data/api";
import { stateVisual } from "../binVisual";
import { statusText } from "./Waste";
export const ORIGIN = { latitude: 25.033, longitude: 121.5358 };
export const ignoreSelect = () => {};
export const reasonLabels: Record<string, string> = {
  not_installed: "尚未設置",
  removed: "已撤除",
  repair: "維修中",
  full: "桶已滿",
  unknown: "桶況未知",
  login_required: "需登入",
  suspended: "回報資格暫停",
};
export function Status({ status }: { status: BinStatus | null }) {
  return (
    <span
      className={`status-pill ${stateVisual[apiBinState(status)].className}`}
    >
      {statusText(status)}
    </span>
  );
}
