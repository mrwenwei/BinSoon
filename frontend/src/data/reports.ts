import type { WasteType } from "./binState";
export const reportTypes = [
  { id: "full", label: "滿了", points: 1, icon: "▤", hint: "小夥伴吃太飽了" },
  { id: "dirty", label: "很髒", points: 1, icon: "✳", hint: "需要清潔一下" },
  {
    id: "dumping",
    label: "桶旁有堆放",
    points: 1,
    icon: "▧",
    hint: "優先派工",
  },
  { id: "broken", label: "損壞", points: 1, icon: "⚒", hint: "小夥伴受傷了" },
  {
    id: "other",
    label: "其他",
    points: 1,
    icon: "＋",
    hint: "寫下你看到的狀況",
  },
] as const;
export type ReportType = (typeof reportTypes)[number]["id"];
export type ReportStatus = "pending" | "processing" | "approved" | "rejected";
export const reportStatusLabels: Record<ReportStatus, string> = {
  pending: "審核中",
  processing: "清潔員處理中",
  approved: "審核通過",
  rejected: "判定不實",
};
export interface DemoReport {
  id: string;
  locationId: string;
  type: ReportType;
  // 回報的是哪一槽；舊紀錄沒有這欄時視為一般垃圾。
  wasteType?: WasteType;
  description: string;
  createdAt: string;
  status: ReportStatus;
  adopter: boolean;
  firstReporter: boolean;
  acceptedAt?: string;
  reviewedAt?: string;
  eventId?: string;
  quick?: boolean;
  photo?: boolean;
  reporter?: "member" | "fixture";
  rejectionReason?: string;
}
export interface ReportDraft {
  type: ReportType | null;
  wasteType: WasteType;
  description: string;
  photo: boolean;
  proximity: "unchecked" | "near" | "far" | "denied";
  adopter: boolean;
  firstReporter: boolean;
}
export const emptyDraft: ReportDraft = {
  type: null,
  wasteType: "general",
  description: "",
  photo: false,
  proximity: "unchecked",
  adopter: false,
  firstReporter: true,
};
export function reportInfo(type: ReportType) {
  return reportTypes.find((item) => item.id === type)!;
}
export function reportAward(
  report: Pick<DemoReport, "adopter" | "firstReporter">,
) {
  return report.firstReporter ? (report.adopter ? 2 : 1) : 0;
}
export function pendingPoints(reports: DemoReport[]) {
  return reports
    .filter(
      (report) =>
        (report.status === "pending" || report.status === "processing") &&
        report.reporter !== "fixture",
    )
    .reduce((sum, report) => sum + reportAward(report), 0);
}
export function reportIsFinal(report: DemoReport) {
  return report.status === "approved" || report.status === "rejected";
}
export function formatDemoTime(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
