# 歷史本機展示回歸入口

此 HTML 只供 Vite dev／Playwright 歷史回歸，未列入 production build。原 App 保留在此；原元件及純函式未刪除。現有 86 項測試改到這個入口執行，涵蓋尚未接 API 的 B／D／道路展示。

正式首頁是 src/main.tsx → src/App.tsx，完全不掛載展示 store；API 失敗不切回此入口。歷史回歸不代表新 API 流程已驗收。
