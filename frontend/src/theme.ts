import { useSyncExternalStore } from "react";

// 日夜主題：<html data-theme="day|night">。day＝像素皮膚、night＝原版設計系統。
// index.html 的 inline script 會在 render 前先設好屬性；這裡負責執行期讀寫與訂閱。
export type Theme = "day" | "night";
export const THEME_KEY = "binsoon-theme";
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "night" ? "night" : "day";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* 無痕模式等情況讀寫失敗：只在本頁生效 */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "day" as Theme);
}
