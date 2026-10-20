import type { WasteType } from "./binState";
export type { WasteType };
export type WasteMetadata = {
  waste_type: WasteType;
  classification_source: string;
};
export type WasteControls = {
  wasteType: WasteType;
  onWasteChange: (value: WasteType) => void;
};
export function isWasteType(value: unknown): value is WasteType {
  return value === "general" || value === "recycling";
}
export function wasteName(value: string | null | undefined): string {
  return value === "general"
    ? "一般垃圾"
    : value === "recycling"
      ? "資源回收"
      : value === null || value === "legacy_unknown"
        ? "舊未分類"
        : "種類未提供";
}
export function classificationName(value: string | undefined): string {
  return (
    (
      {
        demo_assumption: "展示分類假設",
        legacy_assumed_general: "舊狀態假設為一般垃圾",
        legacy_unclassified: "舊讀值未分類",
      } as Record<string, string>
    )[value || ""] || (value ? "其他分類依據" : "分類依據未提供")
  );
}
export function wasteHref(path: string, waste: WasteType): string {
  const [route, search] = path.replace(/^#/, "").split("?");
  const params = new URLSearchParams(search);
  params.set("waste_type", waste);
  return `#${route}?${params}`;
}
