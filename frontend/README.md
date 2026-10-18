# BinSoon 地圖與 A／B flow 展示

React＋TypeScript＋Vite，Leaflet 管理操作與標記，MapLibre 渲染 OpenFreeMap 底圖。前端使用已提交的靜態資料快照，可獨立部署，無需後端、資料庫或金鑰。

## Clone 後在本機查看

先安裝 Git、Node.js 24（含 npm）；建議所有組員統一使用 Node 24。`package.json` 的支援範圍為 `^22.12.0 || >=24.0.0`。可用 `node --version`、`npm --version` 確認環境。前端獨立運行，不需 Docker、後端、資料庫、Vercel 帳號或 `.env`；底圖需要網路及瀏覽器 WebGL 支援。

### 第一次下載與 build

直接從原儲存庫的 `main` 下載：

```sh
git clone --branch main https://github.com/mrwenwei/BinSoon.git
cd BinSoon/frontend
npm ci
npm run build
npm run preview
```

開啟 [本機預覽](http://127.0.0.1:4173/)（以終端機顯示的 Local URL 為準）。終端機需保持執行，按 `Ctrl+C` 停止。開發／build 都在 `frontend/` 執行，不在 repo 根目錄執行 npm。

### 已下載專案，更新到最新 main

先保存／處理 `git status --short` 顯示的本機改動，再從儲存庫根目錄執行：

```sh
git switch main
git pull --ff-only origin main
cd frontend
npm ci
npm run build
npm run preview
```

若 `--ff-only` 提示分支分歧，先保留本機 commit 並請組員協助處理分支，不使用重設或強制推送。`npm ci` 依已提交的 `package-lock.json` 安裝依賴；每次拉取更新後重新執行即可。不需 clone fork，也不需切到功能分支。

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

## 常見本機問題

| 情況 | 處理方式 |
| --- | --- |
| `npm` 找不到、Node 版本不支援或 `EBADENGINE` | 安裝／切換到 Node 24，重新開啟終端機，再確認 `node --version` 與 `npm --version`。 |
| `ENOENT`、找不到 `package.json` | 確認目前目錄為 `BinSoon/frontend`。 |
| `npm ci` 下載失敗 | 確認可連到 npm registry 與網路代理設定後重試；保留已提交的 lockfile。 |
| 5173／4173 連接埠被占用 | 使用終端機顯示的下一個 Local URL，或指定 `npm run dev -- --port 5175`／`npm run preview -- --port 4175`。 |
| 雙擊 `dist/index.html` 是空白頁 | 改以 `npm run preview` 啟動 HTTP 預覽，再打開 Local URL。 |
| 更新後仍看到舊畫面 | 停止預覽、重新執行 `npm run build`，再執行 `npm run preview` 並重新整理瀏覽器。 |
| 地圖空白或字型載入失敗 | 底圖／字型需要外網，地圖需要 WebGL；檢查連線及瀏覽器硬體加速。清單和來源資料仍可查閱。 |

一般 build 不需要下載 Playwright 瀏覽器；只有執行下方 E2E 測試時才需要。手機版可先用瀏覽器開發者工具模擬；另一支手機不能連到這台電腦的 `127.0.0.1` 網址。

## A flow 1018 操作

預設大安區 47 筆公布桶位置，保留全市 811 筆位置紀錄與來源精度。P1–P9 已更新為找桶 → 詳情 → 導航 → 回報 → 審核 → 會員／兌換。

- 地圖提供最近三個可用示意桶、步行估算，以及餓了／還能裝／新設篩選。新設 30 天、撤除保留 7 天以固定的示意天數展示，並非原始資料的設置日期。撤除桶不能回報，滿桶／未知桶可改導其他可用桶。
- 站內導航顯示示意折線與轉彎提示，可「模擬目的桶吃飽」改導及「模擬抵達」。起點固定大安森林公園；時間為直線距離 × 1.3／每分鐘 75 公尺估算，未取得 GPS 或實際路網，不可作為實際通行指引。
- 桌面導航及回報入口提供本機生成的 QR Code；回報另有「在電腦體驗示範回報」。手機直接顯示表單。手機掃碼需可連線的部署網址，不能連另一台電腦的 localhost；帳本不會跨裝置同步。
- 回報共五類，需內建示意照片、32 公尺定位情境及登入；選「其他」需文字。78 公尺或定位失敗不能送出。認養身分依 B flow 核准關係自動判定；仍可選同事件第一位／後續回報者示範情境。相同問題僅在未結案期間阻擋重複，結案後再次發生可新增事件。
- 「台北通登入（示範）」或虛構手機 0912345678，驗證碼固定 **123456**。不傳簡訊、不保存手機號碼、不啟用相機或真實定位。登入返回原頁並保留記憶體草稿；重新整理不保存未送出草稿。
- 送出後看審核結果，可切換審核中／處理中／通過／不實。確認屬實一般 +1、認養者 +2；同事件後續回報者 +0；待確認不能使用。通過或不實為最終結果，只結算一次。累積不實三次暫停本機帳號回報資格。
- 新版會員帳本從累積／可用各 **63 點**、48 次示意屬實回報起始。六級門檻 0／10／50／150／500／1000；會員等級依累積點數。兌換只扣可用點數，不降級。
- 獎品頁有全部／超商券／大獎分類。7-11 50 元券需 30 點、全家 50 元券需 50 點、日本機票 1000 點、iPhone Duo 3000 點；面額、成本及庫存皆為假資料。確認時檢查點數與庫存並儲存示意序號，不能用於真實商店。
- 帳號、按讚、案件與兌換保存在 `binsoon-a-flow-1018-v2` localStorage；舊 v1 集章資料保持原樣，不讀寫、不混用。舊 `#stamps` 改顯示會員中心，舊掃碼入口改接回報。儲存不可用時會提示。
- B flow 已加入投票、認養與快捷通報；D flow 入口仍只顯示範圍提示。已移除小車、車上垃圾、遛狗及桶印章 UI。原始 CSV、後端與資料庫保持不變，地圖維持沒有 150m 圈線。

完整規格見 [A_FLOW.md](../docs/A_FLOW.md)，來源差異見 [1018 盤點](../docs/A_FLOW_1018_GAP_ANALYSIS.md)。本版本在 `feat/frontend-v0` 開發，尚未合併時請使用 `git switch --track origin/feat/frontend-v0`（已有該分支則 `git switch feat/frontend-v0`）取得新版；上方 main 安裝／建置方法同樣適用。

## B flow 1018 操作

從「這裡需要桶」、會員中心「認養電子雞」或桶詳情認養入口開始；也可使用 `#nearby`、`#vote`、`#vote-progress`、`#adopt`。

- P10 在選定位置周圍300m搜尋全市既有桶，場所與提案不算桶，滿桶／未知仍算桶，示意移除桶不算。距離為直線；預設起點固定，並非GPS。
- P11 可點地圖、拖曳＋標記或輸入經緯度；棕框緯度25.012–25.048、經度121.525–121.570只是大安區展示矩形，不是精準行政區界。150m內有桶只提示，50m內有提案需確認不同需求才新增；每台北曆月最多3點，提案自帶支持票，不提供提案編輯／刪除。
- 每提案每人一票，累積期間可改票／撤票。門檻為60人且支持率至少60%（示意），支持47／反對3應是50/60、94%。人數足但支持不足送里長確認；達標或里長確認後結束該輪投票。
- 三個初始提案為示意：信義路可體驗一般投票；和平東路支持後剛好60%達標；市民大道反對後可體驗需里長確認。和平東路是歷史的本人提案，不占本月額度。從「展示控制」可調整其他市民示意票數，讓自行新增提案也能演示達標；並推進評估、會勘及命名，未通過需填原因。這些數字不代表真實投票，也不建立多帳號。
- 示範設置只在B呈現成果卡，不改681/130筆資料、不連後端；命名與認養者公開名稱分開。分享或複製連結不會把本機新增資料同步給其他裝置。
- P14／P15 選既有、未被認養的桶，填認養身分、公開名稱、店家選填介紹及通知設定。待審沒有加倍；以展示控制核准後才取得認養權益。可以認養多桶，一桶同時一名認養者；已有其他示意認養者或已移除的桶不能申請。
- 可撤回待審、結束認養及重新申請；歷史保留，重申仍需核准，不承諾3個工作天。三種通知可全部關閉，通知與月報是站內示意。認養不需自己清運。展示控制「移除此桶」只改本機展示，立即停止認養權益與新回報。
- P16「一鍵通報」是共用回報入口，仍須示意照片、距桶50m內及登入；已結束或未核准者改用一般回報。屬實首報一般+1、認養+2，送出時保存資格；後報0，首報不實不遞補。三次不實只停回報，仍可投票／提案／認養。
- B 的提案、認養、通知設定及移除情境存於 `binsoon-b-flow-1018-v1`，與A的v2帳本分開；A原帳本可讀入，既有點數／兌換保留。登出及重整不清除資料；不同瀏覽器／裝置沒有雲端同步。尚無真實登入、照片、定位、LINE、評分或派工。

完整規格見 [B_FLOW.md](../docs/B_FLOW.md)，驗證紀錄見 [B_FLOW_VALIDATION.md](../docs/B_FLOW_VALIDATION.md)。

## 驗證

另開終端機，在 `frontend/` 執行：

```sh
npm run typecheck
npm run data:check
npm run build
npx playwright install chromium
npm run test:e2e
```

桌面 Chromium 與 Pixel 7 尺寸測試涵蓋原始資料／十二區／來源區分、找桶／按讚、登入返回與回報草稿、拍照／距離驗證、審核及發點去重、三次不實停權、150 點升級、兌換不降級與重新整理保留、導航改導、舊帳本隔離，以及底圖失敗／無效儲存恢復。B flow另驗證投票雙門檻、月界線與額度、認養審批／退出／移除、命名、A/B獎勵接合及事件重開。另檢查 320px、768px 畫面無水平溢出並保存各頁截圖。手機為瀏覽器模擬，尚非實體手機驗證；真實外部登入、相機、定位、派工與兌換不在展示範圍。

## 資料與調整位置

- `src/data/locations.json`：811 筆快照，原始資料在 `../backend/data/`；更新 CSV 後於 repo 完整 checkout 執行 `npm run data:generate`，再執行 `data:check`。一般 Vercel build 不需存取 backend。
- `scripts/generate-data.mjs`：以 BOM-aware CSV parser 辨識欄位，驗證筆數、座標、十二區及追溯欄位，保留原始精度。後兩個 CSV 檔名與內容對調，只有真正的 130 筆場所資料可進入快照。
- `src/components/`：共用角色、位置詳情與 A／B flow 各頁；`src/data/binDemo.ts`、`demoStore.ts`、`reports.ts`、`rewards.ts`、`participation.ts`：獨立的示意資料、投票／認養規則與本機帳本；`src/map/`：Leaflet／MapLibre 與位置標記；`src/App.tsx`：篩選與頁面；`src/styles.css`：視覺及 RWD。

681 筆公布桶位置＋130 筆場所代表點稱為 **811 筆位置紀錄**。代表點並非個別桶，reported_count 是周邊統計，不展開、不混入缺口分析。所有資料均為公開資料快照，沒有即時桶況與現勘保證；部分來源座標相同或相近，縮小時標記會重疊，可放大或從清單選取每一筆。

## Vercel

Import `mrwenwei/BinSoon`，Framework 選 Vite，Root Directory 設 `frontend`，Build Command `npm run build`，Output Directory `dist`。Node 選 24.x。不需環境變數。Production Branch 使用 `main`；功能分支 PR 可另外產生 Preview deployment。是否能建立部署取決於 repo 的 Vercel 存取權限，本機 build 不需要 Vercel。

底圖及 Google Fonts 需要外網；瀏覽器需支援 WebGL。失敗時位置清單仍可查閱，字型有系統 fallback。MapLibre 引擎較大，build 可能提示 chunk 大於 500 kB，手機初次載入時間依網路而異。

[共用專案背景](../docs/PROJECT_CONTEXT.md) · [V0 與 PM 規格來源](../docs/FRONTEND_V0.md) · [Issue #1](https://github.com/mrwenwei/BinSoon/issues/1)
