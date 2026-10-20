# #18–#20 快捷回報、站內通知與撤桶驗證

日期：2026-10-20（Asia/Taipei）。接續 `f78f0e2`，僅修改前端與文件；遵循 implement／TDD，使用先前同意的 Playwright「使用者操作畫面＋攔截 HTTP API」邊界。未部署、未建立雲端驗收案件或寫雲端資料。

## 流程與資料來源

- #18：`#adopt/<adoption.id>` 讀本人認養與 `monthly-summary?month=YYYY-MM`；呈現 Asia/Taipei、部分月份、送出／查證／發點數與後端零值。僅 active 可從 `#quick-report/<adoption.id>` 上傳 purpose=report 照片、確認現場座標並 POST `/reports`，送出 `quick:true` 及所選種類。不同認養期間、槽與普通回報不共用草稿；同帳號重登入沿用原命令與照片。每次成功返回後清除草稿；同事件回傳既有 report.id 就導向該 ID，新事件重新選照上傳。後端保存提交時認養與首報資格，前端只呈現 pending／awarded，沒有補倍、遞補或追扣運算。
- #19：`#notifications` 與隊員／管理員專用入口讀 `/me/notifications?unread_only&limit&offset`。標已讀 POST `{}`，未知結果保留原 key；`read_at` 只讀後端，再重讀列表。target 的 report／work_order／proposal／adoption UUID 分別進入原案件路由，工單仍經隊員守門；管理員的認養通知進審核入口。不存在或無權限顯示後端錯誤，不猜替代 ID。僅站內通知，不代表 LINE／系統推播已送出。
- #20：`#admin/bins` 或管理員桶詳情連結進 `#admin/bins/<bin.id>`，GET lifecycle 的獨立 ETag，原因必填並先預覽影響，再 POST `{action:"remove",reason}`。未知結果重送原命令；版本衝突重新讀取並要求明確確認，若已撤除則不允許再發新的撤除。沒有通用任意更新、刪除或 restore。
- 地圖把 `include_removed` 交由後端決定近七日或全部撤除紀錄，保留撤除標記。BinView、nearest-usable、availability、認養、工單及 route-stops 維持各自讀取後端；無前端搬移資料、清除歷史、追扣點數或自動 completed。撤桶後既有工單顯示 blocked，站點變更清除道路指引。
- 讀取沿用前景每 10 秒更新、背景停止、離頁 abort 與 session／月份 identity 隔離；不讀舊 localStorage 當作 API fallback。Session 仍為分頁記憶體，重新整理會失去未確認命令；應先讀案件確認結果。

## 驗證證據

- 紅燈：新增月報／快捷通報、通知匣與 lifecycle 操作的 UI 驗收先失敗，再實作至通過。
- `api-quick-report.spec.ts`：有效與 pending／withdrawn／ended；權限拒絕重讀認養和 BinView；三次不實的後端 suspended 投影停止回報但保留認養管理；原命令跨失效重登入；同事件既有 ID、新事件新照片；隊員查證後市民顯示首報 2、後報 0、事後核准 1、結束保留 2；月報部分月份、零值與舊月份晚回不覆寫。
- `api-notifications.spec.ts`：分頁／未讀與空匣、命令中斷與 401 原 key/body 重送、四種 target 與不同 UUID、隊員守門及管理員認養目的地、404、背景／離頁停止與舊身份晚回不能填入。
- `api-lifecycle.spec.ts`：管理員獨立 ETag／原因／確認／原命令重送；市民及隊員不能讀管理操作；另一分頁撤桶後舊 ETag 被拒絕；地圖／導航／未完成工單；多分頁認養狀態與偏好停止、路線排除站點及舊道路清除；availability 重查不沿用已撤桶、不帶 UI 篩選。
- `api-final-visual.spec.ts`：桌面、Pixel 7 與 320px 的月報、快捷通報、通知與撤除確認截圖、水平溢出檢查與鍵盤操作。使用原設計 tokens／共用元件，底圖署名保留。
- 已完成 Standards／Spec 雙軸覆核，修正撤桶入口的觸控目標，以及通用通知入口的管理員認養導向；複核後 Standards 0、Spec 0 個剩餘問題。

本次執行結果：

| 指令／檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm run data:check` | 通過：811 = 681 桶位置＋130 場所代表點，大安區 47＋18，十二區 |
| `npm run build` | 通過，保留既有 bundle 大小提醒 |
| `npm run test:e2e` | 全部 328 項執行；327 通過、1 項舊命名測試定位歧義失敗（8 分鐘） |
| `npx playwright test tests/api-governance.spec.ts --grep 'owner requests, admin returns' --workers=1` | 限定主標題 `level:1` 後桌面／手機 2 項皆通過（6.5 秒）；未修改產品行為 |
| `git diff --check`、文件相對連結 | 通過 |

328 個不同案例已全部取得通過結果，含本批新增 48 個桌面／手機案例；完整套件是在舊定位斷言修正前載入，修正後僅重跑受影響案例，沒有宣稱完整套件曾單次 328 全綠。另有前述 TDD／針對性命令的通過紀錄。桌面 1440px、Pixel 7 412px 與 320px 截圖已人工檢視並保留在本機 `.scratch/final-flows-visual/`，不提交暫存圖。

## 未驗證與資料限制

測試回傳符合實際後端 DTO 的本機 fixture，驗證前端請求、權限守門、競態與顯示；上述點數／撤桶副作用由 fixture 模擬後端既有契約，並非本次重新執行後端資料庫邏輯的證據。沒有對雲端跑 pytest 或建立案件／造票／贈點／重設模擬；未測真實角色帳密、GCS 上傳、實體手機 GPS／相機、真實道路服務或瀏覽器背景節流。

所有滿度仍 simulated、兩槽分類含展示假設；proposed 未現勘不當作已設置，demo 設置及 demo 身份來源仍明示。照片與現場距離由後端再次驗證；手動座標不是防偽 GPS。CSV 檔名對調與來源／精度限制不變，681 桶位置＋130 場所代表點的快照只作資料驗證，非即時服務數量。既有 MapLibre／Leaflet 快速換頁時偶有 getZoom teardown 訊息，沒有在本批擴充第三方底圖生命週期；Vite 主 bundle 大小提醒仍存在。
