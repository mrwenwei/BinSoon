# 前端 API 串接驗證：第 1–5 票

第 1–3 票紀錄（第 4 票見文末）：日期 2026-10-19，範圍為 GitHub #6、#7、#8，起始基準 38b67b8，分支 feat/frontend-v0。後端契約、資料庫 migration 與雲端部署未修改。

## 交付範圍

- 正式首頁由 API 讀地圖全部分頁、最近可用桶、桶詳情、全部模擬輪次歷史；支援來源／行政區／搜尋／桶況及待現勘點。步行路線仍為固定起點示意，目的地可用性讀 is_usable。
- 三角色以 demo session 登入，GET /me 確認角色；記憶體保存 token，不寫 localStorage／sessionStorage。跨分頁身份獨立；登出／過期不再呈現個人快取，舊請求不能回填。
- 市民選真實照片、提供位置，上傳 media 後送 reports；回報成功及重複案均以 report.id 導向，獨立保存 bin/event/work_order ID。短效私照 URL 到期重取。
- 送出時建立命令，斷線／401 後同帳號重登入保留原 key/body/ETag；409/412/428 重讀後再次確認，不自動重送業務命令。
- 隊員依責任區查工單、接單、到場、逐筆查證。每步最新 ETag；市民查看後端會員摘要、點數台帳與獨立工單進度，不自行判首報或發點。
- 完工、示範清空、讚、道路站點、成果、兌換、提案、認養與通知等後續流程尚未開放；沒有把歷史展示帳本匯入 API。

## 驗證方法

新測試在 Playwright 瀏覽器／HTTP 邊界攔截 API；覆蓋多頁地圖／歷史、搜尋競爭、未知／不可用／待現勘／場所精度、登入／角色／限流／到期／登出、照片格式／距離拒絕、斷線與重登入原命令重送、工單 ETag 衝突重讀再確認、跨分頁查證結算。

歷史 86 項測試改由開發專用 tests/legacy/index.html 執行；原 App 與元件保留，正式 production build 不包含該入口。歷史回歸不能代表未串接功能已上線。

## 執行結果

- typecheck：通過。
- data:check：通過，811 筆原始位置紀錄＝681 桶＋130 場所，大安區 47＋18，十二區；快照及原始 CSV 未改。
- build：通過；保留既有 MapLibre 大型 bundle 提示。正式主程式不包含 localStorage 或舊展示帳本字串。
- 針對性桌面／Pixel 7 回報、工單及版面測試：14 項通過。
- 初次完整 test:e2e：118 項通過（3.7 分鐘），包含 32 項 API 測試與 86 項歷史展示回歸。Spec review 後新增 6 項邊界案例；擴充全套 124 項通過（3.2 分鐘）：38 項 API 流程＋86 項歷史展示回歸。
- Review 補強地圖／工單針對性驗證：桌面／手機合計 20 項通過。最後保留未成功重試的過期提示後，再跑 typecheck、build 與全部 38 項 API 測試，均通過（API 測試 42 秒）；延遲 GET 回應期間的過期提示也已驗證。
- 視覺：已檢視桌面 1440px 與手機 320px 截圖，補修手機導覽高度；另以 768px／Pixel 7 驗證無水平溢出與頁首不重疊。完整及針對性測試已重建截圖，並複看修正後 320px 照片回報與桌面桶詳情。

## Standards

獨立 review 以 38b67b8...409d165 為基準，檢查 AGENTS.md、frontend/AGENTS.md、GLOSSARY.md 與專案背景。0 項必修規範問題；1 項可選的命令生命週期重複碼觀察。因回報／工單重試政策不同，目前保留各自流程，未先行抽象。

## Spec

獨立 review 比對 GitHub #6–#8 與後端契約，發現同身份更新失敗不應清空既有資料，以及結算邊界測試不足兩項 P2，均已修正並補驗。複查指出的重試中提示過早消失也已修正，並加入延遲回應驗證。過期快照不跨 query/session，授權失敗不保留私有投影；尚未成功刷新時不重新開放新的業務操作。最後複查確認沒有剩餘必修項。

Review 結果：Standards 0 項必修／1 項可選觀察；Spec 2 項原始 P2 與 1 項修正後 P2 均已處理，未留必修問題。

## 未驗證與限制

- Cloud Run 公開唯讀 smoke：GET 全市 map/locations 回 200，首 100 筆／total 811，GET 桶詳情回 200、reading_source_type=simulated、訪客 can_report=false；Access-Control-Allow-Origin 正確為 http://127.0.0.1:5173，並暴露 ETag 等版本標頭。這只核對公開回應與 CORS，不取代完整分頁／登入整合驗收。
- 未取得真實帳密，因此未用瀏覽器登入 Cloud Run、未上傳雲端照片或建立雲端案件。未對雲端資料庫執行 pytest、reset／清除或任何測試寫入。
- 未以實體手機驗證相機、GPS、signed URL／GCS 與網路斷線；目前是 Chromium 桌面／Pixel 7 模擬及 API 攔截驗證，不等於後端整合驗收。
- Session、草稿及待重試命令只存在本分頁記憶體，整頁重新整理後須重登入，未完成命令應先讀後端結果再決定下一步。換帳號不沿用他人的照片資產／命令。
- 所有滿度仍為 simulated；原始桶位未現勘、場所不是個別桶，proposed 尚待現勘。歷史模擬時間不與真實回報／查證時間混比。
- 未部署 Vercel、未建立資源或改雲端 CORS。非 5173 的 origin（包含 preview）需後端明確允許；密碼不可加入 VITE_*。

## 第 4 票：滿桶完工、管理員示範清空、市民感謝

2026-10-19，GitHub [#9](https://github.com/mrwenwei/BinSoon/issues/9)，基準 03f456d。前 1–3 票已正常推送至 origin/feat/frontend-v0；本票延續目前分支，不改後端契約、資料庫或部署。

- 隊員到場後選可解碼的 JPEG／PNG／WebP（5 MiB、2000 萬像素內），先上傳 purpose=completion 取得 media.id，再掛 evidence；此時不自行 finish。掛照、提交完成各為獨立命令，每步讀最新 ETag。
- 完成條件依後端 missing 顯示；全部查證與完成照具備才開放提交。照片先到、finish 後未清空為 waiting_sensor；清空先到容量可以歸零，但未 finish 或缺查證仍不可顯示完成紀錄。
- `#admin`／`#admin/work-orders/{work_order_id}` 為獨立管理員入口。市民、隊員不發管理 API 請求。先 GET 最新工單及 ETag，再明確勾選示範清空、送出 UUID reading_id；不使用共享 admin token、不呼叫 collect/reset。
- 只有後端 completed 才呈現 completion_id 與完成時間。私有工作照片沿用短效 /media/{id}/access URL；市民只讀有效成果摘要，未向市民公開工單私照。清空讀值的 observed_at／received_at 與歷史模擬時鐘分開顯示。
- 桶詳情按後端 can_like／liked_by_me／like_count 呈現最新 completion.id 的感謝。沒有成果不聲稱剛清乾淨；過期成果 409 重新讀取，須市民另按才對新成果送出，無本機累加或加點。
- 工單、清空、感謝共用記憶體命令保存；網路未知結果／401 重新登入同帳號保留原 key、body、ETag。409／412／428 重讀後另行確認，不自動重送；重新讀取失敗時保留過期提示且不開放確認。登出清除照片及命令，整頁重整後仍應先讀後端確認結果。
- 既有地圖清單、最近桶、詳情、歷史、導航與案件以重新進頁、前景刷新及輪詢讀取後端；容量與工單完成各依伺服器投影呈現。

本票針對性測試：20 項通過（桌面 Chromium＋Pixel 7），涵蓋兩種到達順序、尚未提交／缺查證、新回報加入阻擋完成、四種命令回應遺失重送、管理員版本衝突與讀取失敗、過期成果、角色隔離、admin／citizen 同身份重登入、無法解碼照片拒絕、鍵盤勾選與 320px 無水平溢出。桌面 1440px／手機 320px 管理員及隊員完成頁已檢視，截圖保存在本機 `.scratch/frontend-api-integration/`。

### Standards

獨立 reviewer 以 `git diff 03f456d...1af1a9d` 對照 AGENTS.md、frontend/AGENTS.md、GLOSSARY.md、專案背景及 smell baseline，未發現可操作的規範問題。共用 useCommand、LoadState 與 validatePhoto 為本票實際使用的重複邏輯整理；0 項必修、0 項可選發現。

### Spec

獨立 reviewer 核對 #9、後端 workflows／views／media 權限與 diff，未發現缺漏、範圍擴張或契約錯誤。完成狀態、缺少條件、容量及按讚權益均讀後端；0 項發現。自查另將「新回報加入」測試改為新增第二筆未查證回報，保留原已通過回報與證據，避免把已最終查證結果改回處理中。

Review 結果：Standards 0／Spec 0，兩軸均無待修問題。

本票完整驗證：typecheck、data:check（811＝681＋130）、build、Prettier 與 git diff --check 均通過。完整 test:e2e 共 **144 項通過（3.7 分鐘）**，包含 58 項 API 流程與 86 項歷史展示回歸；正式 build 不含 localStorage 或舊展示帳本字串。build 仍有既有 MapLibre 大型 bundle 提示。最後僅調整新回報測試資料後，全部 20 項完工流程測試再次通過（29.9 秒）。

限制同前：未取得真實帳密，未寫入雲端案件／照片／清空／感謝，未跑雲端 pytest、未建立資源或部署；GCS 私照、Cloud Run 實際角色操作與實體手機相機／GPS 尚未整合驗收。所有滿度仍 simulated。道路站點、非滿桶完工、修繕、成果統計等仍依後續票單開放。


## 第 5 票：非滿桶問題處理、待修繕與無需處理

2026-10-19，GitHub [#10](https://github.com/mrwenwei/BinSoon/issues/10)，基準 fd6c6d8。沿用 feat/frontend-v0，先快轉同步已合併的 main；原本機截圖保留。後端契約、資料庫與雲端部署未改。

- dirty／dumping／other 到場後可上傳完成照、掛 evidence、全部查證後明確 finish，不要求或偽造清空。
- broken 到場後可填最多 500 字原因送 defer-repair；顯示後端 repair、原因與未結案說明。修復後再掛完成照及 finish，每步用最新 ETag。桶況與維修限制重新讀取，其他 broken 事件仍存在時不自行恢復可用性。
- WorkPhoto 支援 completion／site，按工單與用途隔離照片草稿及 media.id。無需處理使用 site 照＋全部查證＋非空白原因，再獨立 dismiss；顯示後端 dismissed／原因／證據，沒有 completion_id 或本次可讚成果，不聲稱正常完工。
- 回報不實與現場工作分開：不實可以與工單仍到場、後續完成工作並存；不自行結算點數、關閉其他工單或改容量。市民案件、桶況、導航、最近桶與維修限制持續讀後端。
- defer-repair／dismiss 沿用原命令重試與同帳號重新登入；key、body、ETag 不變。409／412／428 重讀後明確確認；重讀失敗時保持操作關閉。照片證據、原因、責任區／所有權與到場條件均由後端再次驗證。

採用既有瀏覽器／HTTP 邊界 seam。已先確認原介面缺少非滿桶完成照、留待修繕、無需處理三個失敗案例，再逐段實作驗證。針對性桌面／Pixel 7 測試 20 項通過（28.3 秒）：各種非滿桶類型、修復後重讀、不實仍有工作、同桶其他工作保留、雙用途照片、重送、版本衝突／重讀失敗、角色／所有權／到場／空白原因、同帳號重登入。已檢視桌面 1440px 與手機 320px 的完整現場處理頁，無水平溢出、頁首不重疊，截圖在本機 .scratch/frontend-api-integration/work-resolution-*.png。

### Standards

獨立 reviewer 以 `git diff fd6c6d8...c3feec7` 檢查 AGENTS.md、frontend/AGENTS.md、GLOSSARY.md、專案背景與 smell baseline。查證、不實、待修繕、完成、無需處理語意各自獨立；WorkPhoto／ReasonAction 的共用範圍合理。未發現可操作的規範問題或 baseline smell。

### Spec

獨立 reviewer 核對 #10 與後端 work_command／requirements／可用性投影，未發現缺漏、範圍擴張或契約錯誤。非滿桶不造清空、修繕未自行解鎖、dismiss 使用 site／原因／全部查證且不冒充 completed。測試涵蓋權限、重送、衝突、同身份重登入與同桶其他工作。

Review 結果：Standards 0／Spec 0，兩軸均無待修問題。

本票完整驗證：typecheck、data:check（681 桶＋130 場所、十二區）、build、Prettier 與 git diff --check 均通過。完整 test:e2e **166 項通過（4.1 分鐘）**，包含 80 項 API 流程與 86 項歷史展示回歸。新增的 22 項（桌面／手機）全部通過，含最後補入的修復一張 broken 工單後、0% 桶仍受另一損壞事件限制而不可導航的案例。正式 build 不含 localStorage／舊展示帳本；保留既有 MapLibre 大型 bundle 提示。

未驗證：真實 Cloud Run 角色登入與操作、GCS 照片及實體手機相機／GPS。未取得或儲存帳密、未寫入雲端測試案件／證據／工單、未跑雲端 pytest、未清除／重設資料、未建立資源或部署。滿度仍 simulated；現場作業時間不與模擬歷史時鐘混用。


## 雙種類 API 調整與 rebase

2026-10-19，使用者要求 rebase 最新 origin/main 並適配一般垃圾／資源回收。已抓取遠端、無衝突 rebase 至 7481ba5，保留第 5 票兩個提交及本機 .scratch 截圖。未改雲端資源、schema 或後端程式；本輪程式 review 基準為 rebase 後的 c2e97e7。

- DTO 接入 waste_type、classification_source、compartments；TaskReading 與 Reading 的舊未分類種類可 null，與位置 source_type／讀值 simulated 分開。沒有補造第二個地圖點、分攤滿度或複製歷史。
- 找桶、最近桶、詳情、分頁歷史及導航把種類放入 query／cache identity；切換不保留另一槽快照。各類桶槽顯示各自滿度與可用性。歷史只查明確種類或 legacy_unknown，不混線；未分類不轉成 general。
- 深連結及 QR 保留種類；回報明確送 waste_type。記憶體照片草稿依 bin_id／種類隔離，同帳號重登入與未知結果重試不改原 body／key。路由切換以目前 hash 為準，避免快速操作套回舊路由。
- 隊員／市民清單可篩種類，工單、查證、完成、無需處理及清空證據標示各自種類與分類根據；不自行解除另一槽維修限制。管理員 demo-clear body 維持 reading_id，不接受 client 種類覆寫。
- 最新有效成果依 BinView 的所選種類讀取，感謝命令按種類隔離；一般槽未知結果不阻擋或改讚回收成果。點數與會員摘要仍讀原後端彙總，不乘二。
- 視覺：種類選單符合窄螢幕，已檢視桌面 1440px／手機 320px 桶詳情；另修正地圖提示的定位，避免浮到桶況區，測試檢查提示留在地圖內。截圖在 .scratch/frontend-api-integration/waste-compartments-*.png。

採用既有瀏覽器／HTTP seam，先確認缺選單、回報缺 waste_type、兩槽按讚命令互相阻擋、工單缺種類篩選等失敗，再逐段修正。新增 18 項桌面／Pixel 7 測試通過（14.6 秒）：95% 一般／20% 回收分別可用性、單一位置與完整分頁、種類深連結、回收回報重送與重登入、雙槽按讚重試、工單篩選／管理員單槽清空、null 舊歷史及分類來源、照片草稿、延遲讀取不沿用其他種類、清單及 320px 溢出。舊導航測試與一般回報 body 斷言更新為新契約。

### Standards

獨立 reviewer 以 `git diff c2e97e7...e134cec` 比對 AGENTS.md 新種類規則、frontend/AGENTS.md、GLOSSARY.md、專案背景與 smell baseline，未發現可操作問題。種類、查詢身份、草稿／待重試命令隔離與模組分工符合規範，未將雙槽展開成多個位置或複製歷史。

### Spec

獨立 reviewer 核對 WASTE_STREAMS.md、後端 schemas／投影與本輪 diff，未發現缺漏、範圍擴張或契約錯誤。回報及按讚命令不跨種類、清空依後端工單、舊 TaskReading 可 null，舊重播不冒充當前兩槽快照。

Review 結果：Standards 0／Spec 0，兩軸均無待修問題。

已再次檢視完整回歸產生的桌面／320px 手機截圖：選單、兩槽狀態、分類依據及歷史分區清楚，地圖提示留在地圖內，沒有水平溢出或頁首遮擋。Cloud Run 公開唯讀 smoke：map/locations?waste_type=recycling 回 200 且 compartments 為 general／recycling；同一 Bin 的兩種 view 均 200、各自回正確 waste_type，來源分別為 legacy_assumed_general／demo_assumption、讀值 simulated，訪客 can_report=false；legacy_unknown 歷史 200，waste_type=null、classification_source=legacy_unclassified。CORS 為 http://127.0.0.1:5173。未做授權或業務寫入。

完整驗證：typecheck、data:check（811＝681 桶＋130 場所，十二區）、build、Prettier 與 git diff --check 均通過。完整 test:e2e **184 項通過（4.5 分鐘）**，包含 98 項 API 流程與 86 項歷史展示回歸。新雙種類 18 項也在完整回歸中全數通過，含地圖提示位置檢查。build 保留既有 MapLibre 大型 bundle 提示。

最後 fetch 確認 origin/main 仍為 7481ba5；range-diff 確認原第 5 票 c3feec7／05d34d8 與 rebase 後 8bd846d／c2e97e7 內容等價。本機截圖保留；本輪未推送、未 force push 或合併 main。

限制：所有滿度仍 simulated，CSV 無桶槽分類／現勘證據。未取得真實帳密，未驗證 Cloud Run 角色完整操作、私有 GCS、實體手機相機／GPS／跨裝置 QR。未對雲端寫入案件、清空、按讚、重設模擬、執行 pytest 或部署；原始資料／歷史未改。未串接的道路站點、通知等仍依後續票單進行。

## 雙桶況詳情頁視覺整理

2026-10-19，依使用者指定的 emil-design-eng 調整桶詳情：縮小吉祥物，將一般垃圾／資源回收並排為可選取的狀態卡，顯示各自滿度、可用性、滿度條與目前選擇；未知滿度不畫成 0%。點擊或鍵盤 Enter 使用原種類切換流程，導航／回報仍保留 waste_type。分類與來源可展開，展示假設及 simulated 提示仍保留。

導航與回報集中於主要狀態下方；歷史、最近清運／感謝、位置來源與地圖改為獨立區塊。修正位置詳情沿用地圖浮層的高度上限與定位，讓座標／來源完整顯示，關閉鈕留在卡片內。動態僅用主操作按壓的 transform 回饋，鍵盤選取即時、支援 reduced-motion；沒有新增動畫套件。

擴充既有雙種類瀏覽器案例，驗證卡片鍵盤與指標選取、aria-pressed、對應種類的導航連結與 320px 無水平溢出。截圖使用攔截 API 資料（一般 95%、回收 20%），不代表雲端當前桶況；底圖依測試環境可用性顯示。調整前後桌面／手機截圖保留於 .scratch/frontend-api-integration/waste-compartments-*.png，preview 為首屏。

本輪驗證：typecheck、data:check、build、Prettier、git diff --check 通過；完整 test:e2e **184 項通過（4.5 分鐘）**。已檢視 1440px 桌面及 320px 手機模擬截圖。保留既有大型 bundle 與底圖供應端警告；未驗證實體手機與真實角色操作。未寫入雲端業務資料、未部署或推送。

## 第 6 票：後端站點與道路指引（GitHub #11）

依 `/staff/route-stops` 的 origin、有序 stops、waste_types 及 work_order_ids 建立正式 `#staff/route`。不查舊展示帳本、不自行派序／合併案件、不按市民可投垃圾條件過濾；全部／general／recycling 篩選送回後端。同桶每張工單皆有獨立連結，從工單可回清運路線。

將既有 Valhalla UI 與請求共用為 CrewRoutePlanner，舊展示只保留 adapter。起點改為必填並驗證有效座標；對外 payload 僅含公開起點、有序桶位、車種設定，不含 session、案件 UUID、照片或說明。路線標記稱「清運站點」，不冒充 CSV 公布來源；滿度未知，不造桶況。沿用兩車種成本、polyline6、中文轉彎與來源署名，無 GPS／即時路況／順序最佳化。

前景每 10 秒重讀，背景停止、離頁 abort；資料與角色 session 隔離，401 連回原入口登入，403 不借用管理員或市民權限。站點座標／順序／起點／工單集合／車種變更取消舊請求並移除結果，generated_at 單獨變更不清指引。重讀失敗仍可看先前站點與工單，但標為過期、停用計算並清道路；恢復後須手動規劃，不復活舊路線。路線服務失敗／429／20 秒逾時不畫直線替代。

先以 API 瀏覽器案例確認正式入口未開放，再實作首個有序合站與雙車種流程，接續驗證延遲回應、同桶工單變動、空站點、種類篩選、失敗與恢復、403／401／角色隔離、背景／離頁停止及跨隊員分頁實際 finish 後站點移除。新案例在桌面與手機皆已通過；既有道路指引回歸通過。已檢視桌面 1440px 與手機 320px 截圖 `.scratch/frontend-api-integration/api-route-*.png`，保留完整底圖署名及清單替代入口。測試採 HTTP 攔截，不代表真實 Cloud Run／Valhalla 整合或現場行駛驗收。

### Standards

獨立 reviewer 以 `git diff a6d455e...0affa7d` 核對 AGENTS.md、frontend/AGENTS.md、GLOSSARY.md、專案背景與 smell baseline，0 項硬違規、0 項需處理的 heuristic finding。站點順序、各工單 UUID、未知桶況、座標、session 隔離與來源署名均符合規範；共用介面未導入舊展示帳本。

### Spec

獨立 reviewer 比對 #11、RouteStops 契約與後端實作，0 項 actionable finding。起點與站序、雙種類合站及各工單入口、外傳座標限制、取消舊路線、失敗保留操作、前景重讀與身份失效均符合範圍。Review 結果：Standards 0／Spec 0，兩軸均無待修問題。

完整回歸首次揭露既有滿桶流程測試的導航斷言時序問題：點「導航過去」後仍等待桶詳情 H1，可能在 hash 切換完成前提前通過。實際頁面已為步行導航，目的桶是 H2。測試改為同時確認導航 URL、步行導航 H1 與正確目的桶 H2，保留 evidence→finish→demo-clear→like 的命令順序斷言；未修改產品流程。

補充 review：兩位 reviewer 核對 `0affa7d...f16c2c4`，確認導航斷言改為穩定的 URL／H1／H2，強化驗收且未放寬命令條件，Standards 0／Spec 0。修正後的原失敗案例在桌面／手機 2 項通過（14.5 秒），再完整執行 **200 項全部通過（5.1 分鐘）**：114 項 API 流程＋86 項歷史展示回歸，含新道路流程 16 項。

本輪 typecheck、data:check（681 桶＋130 場所、十二區）、build、Prettier 與 git diff --check 均通過。production build 未帶入舊展示帳本或測試密碼；保留既有大型 MapLibre bundle 提示與底圖供應端警告。已檢視 1440px 桌面／320px 手機，無水平溢出，底圖署名及工單清單可用。

限制：未取得真實帳密、未驗證 Cloud Run 授權路線／真實角色完整操作、實體手機、GPS 或現場車種通行限制；本輪 Valhalla 回應採攔截，沒有新做外部服務實測。滿度仍 simulated，CSV 無種類／現勘證據。未對雲端建立案件、上傳證據、清空、按讚、重設或跑 pytest，未建立資源或部署，原始資料與歷史未修改。

## 合併 main 設計系統（PR #22）

使用者要求推送並合併 #10／#11 時，fetch 發現 main 已前進至 e1a58c3（設計系統 #22）。以 merge 保留兩側提交歷史，解決 AppNav、桶詳情、回報、隊員、DTO 及測試重疊；未 force push。保留 main 深色 token、三態、StationCard、手機抽屜及自訂灰綠底圖，同時保留種類深連結、照片草稿／未知命令隔離、工單完成／待修繕／無需處理與後端道路站點。

StationCard 的各槽可直接選取，保留全站 n/2 可用視覺；所選種類仍控制導航／回報／歷史／感謝。回報改用 main 的 WastePicker；切換會重掛對應種類表單，瀏覽器測試以點擊後重新確認新 radio 的 checked 狀態，避免檢查已卸載的舊元素。照片草稿驗證維持不跨槽。一般需求不自動轉成回收，另提供明確回收導航選項。已檢視桌面及 320px 手機深色畫面並修正窄螢幕標籤／滿度與歷史排版。

2026-10-20 合併 review 修正：Standards 指出隊員／管理員 Compartment 仍用舊視覺，以及新增字級未用 token；Spec 指出替代導航被降為外框按鈕。已統一為 StationCard 與共用 API 三態／文案轉接、來源說明保留，字級改 token、替代導航恢復 teal 主按鈕。新增的三態卡使狀態文字同時出現在桶槽與所選操作區，既有流程測試改精確驗證所選槽狀態，保留原有滿度、權限、命令順序與結果斷言。
