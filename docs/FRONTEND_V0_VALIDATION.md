# 地圖 V0 驗證紀錄

2026-10-18，功能分支 `feat/frontend-v0`，對應 [Issue #1](https://github.com/mrwenwei/BinSoon/issues/1)。

## 已通過

- `npm run build`：TypeScript 檢查與 Vite production build 通過。
- `npm run data:check`：原始 CSV 與快照完全一致；681 筆公布桶位置＋130 筆場所代表點＝811 筆位置紀錄；大安區 47＋18；完整十二區；來源類型、列、ID、精度、座標有限值與範圍驗證通過。
- `npm run test:e2e`：4 tests passed，桌面 Chromium 1440×1000、Pixel 7 模擬尺寸。各涵蓋十二行政區與類型篩選、標記／清單點選、精度、來源、150m 圈、關閉詳情、縮放、無水平溢出；另驗證外部底圖無法載入時清單仍可查閱。
- 桌面及手機截圖視覺檢查：底圖、標記、詳情、150m 圈、署名與 RWD 均有顯示。
- Standards／Spec 雙軸 review 無阻擋問題；已採納低優先建議，將共用角色 SVG 移出地圖模組。重建後 production bundle 與移動前相同。

## 限制與尚未驗證

- 尚未於實體手機或 Safari／Firefox 驗證。沒有修改 backend，未重跑 PostGIS 後端測試。
- 底圖需網路及 WebGL；外部 Liberty style 可能出現 missing sprite／null filter fallback 警告，測試中底圖可顯示，無 pageerror。MapLibre 引擎令主 bundle 約 1.76 MB（gzip 約 441 kB），Vite 有 chunk size 提示。
- 原始座標可能重複或相近，縮小時標記會重疊；可放大或使用清單選取，未改動座標。沒有現勘、即時桶況或步行距離。
- 登入、回報、投票、感測器與其他 A＋B 頁面留待後續。
- Vercel 已登入，但匯入 `mrwenwei/BinSoon` 功能分支時回報無法存取；可用 Git namespace 只有 PinYuanChen。尚未建立 Vercel 專案／預覽。需在 New Project 的 Adjust GitHub App Permissions／Add GitHub Scope 授權目標 repo；若需擁有者權限，請 mrwenwei 完成授權。完成後設定 Root Directory 為 `frontend`、Vite、Node 24.x，從 `feat/frontend-v0` 部署，無需合併 main。設定詳見 [前端 README](../frontend/README.md)。

> 範圍變更：本檔保留初版 V0 的歷史驗證結果；使用者後續已要求移除 150m 圈線與相關說明，目前行為以 A flow 文件及測試為準。
