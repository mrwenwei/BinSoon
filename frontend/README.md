# BinSoon 地圖 V0

React＋TypeScript＋Vite，Leaflet 管理操作、標記與 150m 圈，MapLibre 渲染 OpenFreeMap 底圖。前端使用已提交的靜態資料快照，可獨立部署，無需後端、資料庫或金鑰。

## 開發與驗證

使用 Node.js 22.12+（建議 Node 24 LTS）。

```sh
cd frontend
npm ci
npm run dev
# http://localhost:5173
npm run typecheck
npm run data:check
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run preview` 預覽 dist。桌面 Chromium 與 Pixel 7 尺寸的測試涵蓋全市／十二區／類型篩選、標記及清單點選、精度／來源、150m 圈、關閉詳情、縮放、水平溢出與底圖失敗提示；手機為瀏覽器模擬，尚非實體手機驗證。

## 資料與調整位置

- `src/data/locations.json`：811 筆快照，原始資料在 `../backend/data/`；更新 CSV 後於 repo 完整 checkout 執行 `npm run data:generate`，再執行 `data:check`。一般 Vercel build 不需存取 backend。
- `scripts/generate-data.mjs`：以 BOM-aware CSV parser 辨識欄位，驗證筆數、座標、十二區及追溯欄位，保留原始精度。後兩個 CSV 檔名與內容對調，只有真正的 130 筆場所資料可進入快照。
- `src/components/`：共用角色及位置詳情；`src/map/`：Leaflet／MapLibre、標記、150m 圈；`src/App.tsx`：篩選與頁面；`src/styles.css`：視覺及 RWD。

681 筆公布桶位置＋130 筆場所代表點稱為 **811 筆位置紀錄**。代表點並非個別桶，reported_count 是周邊統計，不展開、不混入缺口分析。所有資料均為公開資料快照，沒有即時桶況與現勘保證；部分來源座標相同或相近，縮小時標記會重疊，可放大或從清單選取每一筆；150m 僅為直線參考距離。

## Vercel

Import `mrwenwei/BinSoon`，Framework 選 Vite，Root Directory 設 `frontend`，Build Command `npm run build`，Output Directory `dist`。Node 選 24.x。不需環境變數。選 `feat/frontend-v0` 做初次展示部署；PR 的 Preview deployment 用於本週持續討論，不需合併 main。

底圖及 Google Fonts 需要外網；瀏覽器需支援 WebGL。失敗時位置清單仍可查閱，字型有系統 fallback。MapLibre 引擎較大，build 可能提示 chunk 大於 500 kB，手機初次載入時間依網路而異。

[共用專案背景](../docs/PROJECT_CONTEXT.md) · [V0 與 PM 規格來源](../docs/FRONTEND_V0.md) · [Issue #1](https://github.com/mrwenwei/BinSoon/issues/1)
