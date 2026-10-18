# BinSoon 地圖與 A flow 展示

React＋TypeScript＋Vite，Leaflet 管理操作與標記，MapLibre 渲染 OpenFreeMap 底圖。前端使用已提交的靜態資料快照，可獨立部署，無需後端、資料庫或金鑰。

## Clone 後在本機查看

先安裝 Git、Node.js 24 LTS（含 npm）。前端獨立運行，不需 Docker、後端、資料庫、Vercel 帳號或 `.env`；底圖需要網路及瀏覽器 WebGL 支援。

目前前端尚在 `feat/frontend-v0`，首次下載請指定分支：

```sh
git clone --branch feat/frontend-v0 https://github.com/mrwenwei/BinSoon.git
cd BinSoon/frontend
npm ci
```

若已經 clone，請在保留／處理本機既有改動後，於 repo 根目錄執行 `git fetch origin`、`git switch feat/frontend-v0`，再進入 `frontend` 執行 `npm ci`。前端合併回原 repo 的 main 後，新 clone 可省略 `--branch feat/frontend-v0`，其餘步驟相同；不需要 clone fork。

### 開發模式

在 `frontend/` 執行：

```sh
npm run dev
```

瀏覽器開啟 http://127.0.0.1:5173/。終端機需保持執行，修改程式會自動更新；按 `Ctrl+C` 停止。若連接埠被占用，請以終端機顯示的 Local URL 為準。

### 建置並預覽正式產物

在 `frontend/` 執行：

```sh
npm run build
npm run preview
```

`build` 會先檢查 TypeScript，再產生 `frontend/dist/`；`preview` 提供本機 HTTP 服務，預設開啟 http://127.0.0.1:4173/（以終端機輸出為準）。保持終端機執行，按 `Ctrl+C` 停止。請透過此網址查看，不要直接雙擊 `dist/index.html`。更新程式後需重新執行 `build`，才能預覽新的產物。

## A flow 操作

預設大安區 47 筆公布桶位置。搜尋／篩選後點選桶，查看示意桶況、飽足度、認養者，並可導航或按讚。全市 811 筆位置及來源精度查閱仍保留。

- 桌面回報入口提供真實 QR Code，以及「在電腦體驗示範回報」；手機直接顯示表單。本機網址不能跨裝置掃碼，需先部署至手機可連線的網址。QR Code 於本機產生，不使用外部 QR 服務。
- 回報選類型、拍內建示意圖、選擇 32 公尺定位情境，再登入送出。選「其他」時需補充文字；78 公尺／定位失敗時不能送出。
- 使用「台北通登入（示範）」或虛構手機 0912345678，驗證碼固定 **123456**。不傳簡訊、不保存手機號碼、不啟用相機、不讀取真實定位。
- 登入後返回原桶並保留當次回報草稿；重新整理前未送出的草稿不保存。送出紀錄、帳號、按讚、印章及兌換券保留在 localStorage。儲存不可用時提示當次操作可能無法保留。
- 回報點數保持待確認，不增加可用點數；同一桶／問題類型在此展示中只可回報一次。印章可由示範回報或桶詳情的示範掃碼取得，同桶不重複。
- 初始示意點數 230、7 個大安區印章；登入後用 200 點換 50 元示意券，經確認扣點至 30，本瀏覽器僅一次。示意序號無法在商店使用。
- 地圖距離以固定示意起點（大安森林公園）計算直線距離，不代表使用者位置或步行路線。導航只傳公開桶座標給 Google Maps。
- 小車、投票、認養等其他 flow 入口僅顯示範圍提示。後端、CSV、資料庫皆未修改。

完整規格見 [A_FLOW.md](../docs/A_FLOW.md)。

## 驗證

另開終端機，在 `frontend/` 執行：

```sh
npm run typecheck
npm run data:check
npm run build
npx playwright install chromium
npm run test:e2e
```

桌面 Chromium 與 Pixel 7 尺寸測試涵蓋原始資料／十二區／來源區分、找桶／按讚、登入返回與回報草稿、拍照／距離驗證、待確認點數、掃碼去重、兌換與重新整理保留，以及底圖失敗／無效儲存恢復。另檢查 320px、768px 畫面無水平溢出並保存各頁截圖。手機為瀏覽器模擬，尚非實體手機驗證；真實外部登入、相機、定位、派工與兌換不在展示範圍。

## 資料與調整位置

- `src/data/locations.json`：811 筆快照，原始資料在 `../backend/data/`；更新 CSV 後於 repo 完整 checkout 執行 `npm run data:generate`，再執行 `data:check`。一般 Vercel build 不需存取 backend。
- `scripts/generate-data.mjs`：以 BOM-aware CSV parser 辨識欄位，驗證筆數、座標、十二區及追溯欄位，保留原始精度。後兩個 CSV 檔名與內容對調，只有真正的 130 筆場所資料可進入快照。
- `src/components/`：共用角色、位置詳情與 A flow 各頁；`src/data/binDemo.ts`、`demoStore.ts`、`reports.ts`：獨立的示意資料與本機帳本；`src/map/`：Leaflet／MapLibre 與位置標記；`src/App.tsx`：篩選與頁面；`src/styles.css`：視覺及 RWD。

681 筆公布桶位置＋130 筆場所代表點稱為 **811 筆位置紀錄**。代表點並非個別桶，reported_count 是周邊統計，不展開、不混入缺口分析。所有資料均為公開資料快照，沒有即時桶況與現勘保證；部分來源座標相同或相近，縮小時標記會重疊，可放大或從清單選取每一筆。

## Vercel

Import `mrwenwei/BinSoon`，Framework 選 Vite，Root Directory 設 `frontend`，Build Command `npm run build`，Output Directory `dist`。Node 選 24.x。不需環境變數。選 `feat/frontend-v0` 做初次展示部署；PR 的 Preview deployment 用於本週持續討論，不需合併 main。

底圖及 Google Fonts 需要外網；瀏覽器需支援 WebGL。失敗時位置清單仍可查閱，字型有系統 fallback。MapLibre 引擎較大，build 可能提示 chunk 大於 500 kB，手機初次載入時間依網路而異。

[共用專案背景](../docs/PROJECT_CONTEXT.md) · [V0 與 PM 規格來源](../docs/FRONTEND_V0.md) · [Issue #1](https://github.com/mrwenwei/BinSoon/issues/1)
