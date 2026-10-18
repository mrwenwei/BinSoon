export const reportTypes = [
  { id: "full", label: "滿了", points: 10, icon: "▤", hint: "小夥伴吃太飽了" },
  { id: "dirty", label: "很髒", points: 10, icon: "✳", hint: "需要清潔一下" },
  {
    id: "dumping",
    label: "桶旁有堆放",
    points: 30,
    icon: "▧",
    hint: "優先派工",
  },
  { id: "broken", label: "損壞", points: 10, icon: "⚒", hint: "小夥伴受傷了" },
  {
    id: "bags",
    label: "狗便袋用完了",
    points: 5,
    icon: "♧",
    hint: "補充遛狗好幫手",
  },
  {
    id: "other",
    label: "其他",
    points: 0,
    icon: "＋",
    hint: "寫下你看到的狀況",
  },
] as const;
export type ReportType = (typeof reportTypes)[number]["id"];
export interface DemoReport {
  id: string;
  locationId: string;
  type: ReportType;
  description: string;
  createdAt: string;
}
export interface ReportDraft {
  type: ReportType | null;
  description: string;
  photo: boolean;
  proximity: "unchecked" | "near" | "far" | "denied";
}
export const emptyDraft: ReportDraft = {
  type: null,
  description: "",
  photo: false,
  proximity: "unchecked",
};
export function reportInfo(type: ReportType) {
  return reportTypes.find((item) => item.id === type)!;
}
export function pendingPoints(reports: DemoReport[]) {
  return reports.reduce(
    (sum, report) => sum + reportInfo(report.type).points,
    0,
  );
}
