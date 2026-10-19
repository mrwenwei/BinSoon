# 前端 API 串接驗證：第 1–4 票

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

完整回歸與兩軸 review 結果於本票交付前補記。

限制同前：未取得真實帳密，未寫入雲端案件／照片／清空／感謝，未跑雲端 pytest、未建立資源或部署；GCS 私照、Cloud Run 實際角色操作與實體手機相機／GPS 尚未整合驗收。所有滿度仍 simulated。道路站點、非滿桶完工、修繕、成果統計等仍依後續票單開放。
