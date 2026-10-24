import { useSyncExternalStore } from "react";

// 日夜主題：<html data-theme="day|night">。day＝像素皮膚、night＝原版設計系統。
// index.html 的 inline script 會在 render 前先設好屬性；這裡負責執行期讀寫與訂閱。
export type Theme = "day" | "night";
export const THEME_KEY = "binsoon-theme";
// 手機網址列顏色，須等於各主題頁首底色：day ＝ tokens.css --px-card，night ＝ tokens.css --chrome。
// index.html 的 inline script 有一份相同的值（CSS 未載入前就要設定），改色時兩處同步。
export const THEME_COLORS: Record<Theme, string> = { day: "#ffffff", night: "#232826" };
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "night" ? "night" : "day";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
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
