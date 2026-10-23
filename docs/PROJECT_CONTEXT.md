# BinSoon 專案背景與架構

2026-10-22 固定展示點位：預設市民／清潔隊本機展示使用 CSV 衍生的 681 個既有桶、130 個場所代表點與 10 個既有模型建議點快照，保留 UUID、經緯度、來源與待現勘語意；本機提案繼續疊加。地圖列表、桶詳情及最近同種類可用桶不再等待位置 API，正式後端模式仍走原 API。我的 BinU 及認領 BinU 表單移除通知設定（不清除已存偏好）；清潔隊榮譽榜月份改為最近 36 個月選單，修正 iOS 欄位溢出。底圖／道路路線仍需外部服務，桶況仍非實測。

2026-10-22 M5 認領頁依參考稿重排：同列返回／標題與桶位、橫向吉祥物卡、獨立薄荷加倍橫條、命名欄、通知框與全寬按鈕。沿用 DS token 與現有預覽／確認流程、五桶上限及私人命名；不虛構其他認領人數。

2026-10-22 桶詳情與導航統一優先採用所選 waste_type 的 compartment，避免頂層 status 與雙槽資訊不同步時誤用另一槽。兩種類均沿用 80% 滿桶門檻及同種類替代桶導航。地圖測試同步篩選展開操作與手機隱藏重複狀態文字的版面。

2026-10-22 市民展示桶況移除刻意無讀值的情境，每個 API Bin 的一般垃圾與回收槽均產生穩定數值；保留既有數值分配與本機清運歸零。維修／撤除／待設置限制及正式後端 unknown 語意維持，數值仍為前端展示假設，非感測實測。

2026-10-22 第二輪 UI：手機 sheet 改為較短初始高度；投票地圖移除建立／搜尋入口，選點只留票數、狀態、進度與投票。完成頁採 V1 四階段、LINE 分享及地圖／紀錄入口；V2 隱藏分頁控制但自動讀完所有投票。U1／U2／U3 精簡，U2 本機獎勵按參考稿提供咖啡 3、購物金 5、周邊 10、機票及手機各 10000 點，保留既有庫存、帳本與歷史兌換成本；不修改後端。清潔員工單移除狀態列、結案只留下一張單；路線固定完成樣本減為三筆，市民歷史完成案件不混入當日路線，新增完成仍保留；站點操作靠右，月份欄位限制手機寬度。驗證與限制見 [M flow](M_FLOW.md) 最新段落。

2026-10-22 M1–M4 更新：手機地圖單列搜尋／種類／篩選、較矮底部分頁與 SVG 圖示、滿版桶詳情及獨立認領 CTA、全寬導航回報按鈕。回報用自動距離 banner 取代分享位置，照片後可複選問題並移除說明欄，成功頁只留摘要及獎勵進度。仍使用本機位置情境；各問題沿用單問題 API 與獨立命令，不新增 GPS 或後端契約。限定 5 項 UI／重試測試通過，詳見 [M flow](M_FLOW.md)。

2026-10-22 使用者要求精簡 App 文案：目前市民、清潔員及管理頁移除模擬／假資料說明、DEMO 標籤與新生成照片的展示浮水印；操作規則、提案待現勘語意、原始來源欄位與本機／後端隔離維持。此要求取代先前要求介面反覆明示模擬的規格；資料仍有下述展示限制，未新增真實 GPS、相機或 IoT 能力。已儲存的照片與帳本不重置。

2026-10-22 手機 M1：搜尋、篩選與提醒移回底部 sheet，桌面仍在頂部。地圖尺寸更新改為逐幀且只處理實際變化、手機繪圖資源設上限、視野內掛載標記，重載前主動釋放；WebGL 不可用時改用輕量底圖。排查證據、替代圖磚政策及實機限制見 [手機地圖穩定性](MOBILE_MAP_STABILITY.md)。

2026-10-21 BinU 修正：前端統一稱 BinU。M5 認領頁新增吉祥物 hero、私人命名與單一可選的吃飽了（80% 以上）通知，移除市民本機認領身份選單；原後端契約保留。建議點投票加入穩定示範基礎票，保留個人投票；V2 移除建立／我的提案入口。歷史回報呈現阿順、阿安、阿清，展示登入僅阿順。DEMO 照片顯示垃圾桶造型。私人桶名、點數、兌換及原始資料不重置。

2026-10-21 B／C 更新：依使用者追加要求完成 V1–V2、U1–U4、S1–S4；L1／G1 不新增。市民首頁改為我的功能卡，U3 感謝處理清潔員並同步 S4，U4 回報走 M4；S3 共用既有道路地圖，下方加入桶數進度與已完成桶。市民本機回報與清潔員本機派工現在共享事件結算與完成關聯，取代下方「帳本不互相影響」的舊描述；不授予真實後端角色、不寫雲端。詳見 [B／C flow](BC_FLOW.md)。

2026-10-21 M flow：市民主導覽改為手機底部三分頁「地圖／要桶投票／我的」、桌面頂部；Demo 身份切換取代漢堡，先走既有一鍵登入再到角色首頁。建議點獨立投票地圖，手機模擬拍照後加入本機 AI 判讀 loading 與可修正預選，導航地圖／面板新增滿桶同種類替代桶確認改導。完整範圍及模擬限制見 [M flow](M_FLOW.md)，本節優先於下方歷史導覽描述。

2026-10-21 清潔隊管理入口整合：選單只保留「清潔員管理入口」`#crew`，獨立一鍵模擬身份與本機假資料；P18 派工清單、P19 限手機到場處理及生成 DEMO 假照片結案、P20 步行／機車／汽車固定模擬路線。無真實相機、相簿、GPS、派工 API 或外部導航。清潔員模擬身份不授予後端角色，市民帳本不受影響。舊後端 staff／admin 工具保留直連，移出公開選單。詳見前端 README。 畫面參考 P18／P19／P20 版面配置，UI 沿用既有 design system：深色 panel／chrome、薄荷選中、青綠 CTA、橘色僅警示，字體／間距／圓角使用現有 token。

2026-10-21 使用者修正市民認領命名規則：每位認領者均可為自己的 BinU自由命名，不限第一位、無須審核或公開，私人桶名只顯示於自己的介面；每人有效及待審認領合計至多 5 個。預設市民本機展示已採此流程，新認領立即在本機啟用，預建 3 個生活化私人桶名，保留原 Bin ID、位置及來源。原提案人公開命名／單一公開認養者為舊後端契約，尚未遷移或部署；不可將下方歷史規格當作新市民流程。

2026-10-21 市民導航新增步行／機車／汽車 Valhalla 道路路線示意，移除直角折線及 QR code。普通及認養快捷回報新增桌面阻擋；手機只模擬成功流程，須明示分享模擬座標、通過 50 公尺檢查再模擬現場拍照，無相簿上傳、真實相機或 GPS 呼叫。後端契約與清潔隊流程維持，詳見 [前端 README](../frontend/README.md)。


2026-10-21 支持設置點成功後導向 P12 投票完成頁，顯示最新票數與設置流程；上方返回原點位／提案，底部只有回到地圖。重新整理僅讀提案，不重複投票；反對、撤票及失敗留在原頁。本機展示與後端模式界線維持，見 [前端 README](../frontend/README.md)。


2026-10-21 建議設置點與要桶投票整合：地圖選取待設置 Bin，原面板直接顯示支持／反對及票數，取代未設置點的模擬桶況／清運資訊。預設本機模式為已載入、尚無關聯的建議 Bin 推導零票展示提案，保留 Bin ID 與原始來源；投票與原本機帳本共用，不寫後端，不代表通過或設置。後端模式只連結既有提案，無關聯時顯示說明。見 [前端 README](../frontend/README.md)。


2026-10-21 市民側欄精簡為找垃圾桶／要桶投票／會員中心；回報、等級、獎品及通知入口收進會員中心，認養由地圖桶詳情「待認養」進入。後台入口及角色權限維持。

2026-10-21 會員中心首頁保留等級、升級進度、徽章與集點說明；底部回報、點數明細、兌換及通知拆至共用導覽的獨立分頁。「點數台帳」更名「點數歷史紀錄」，新增 `#point-history` 每頁 20 筆查詢；資料來源及本機展示界線維持。見 [前端 README](../frontend/README.md)。

2026-10-21 使用者確認預設市民端改為本機展示：API 點位搭配穩定的空／半滿／滿桶百分比；詳情移除滿度清運歷史與公布位置區塊；市民免密碼展示登入，會員、回報、提案、投票、認養及兌換均用獨立本機帳本，不寫後端。UI 統一稱「BinU」。清潔隊／管理員及後端契約維持原模式；舊段落為歷史範圍。見 [驗證與限制](FRONTEND_CITIZEN_DEMO_VALIDATION.md) 與 [前端 README](../frontend/README.md)。


2026-10-20 清潔隊工單新增一鍵預填模擬查證結果／原因、DEMO 完成照及現況照。只產生輸入，既有送出、ETag／原命令重試與後端結算條件維持；未到場、非本人或撤桶限制不變。見 [驗證紀錄](FRONTEND_STAFF_DEMO_VALIDATION.md)。

2026-10-20 依使用者要求，正式 API 回報與認養快捷通報新增明示模擬輸入工具：產生 DEMO 浮水印 PNG、一鍵使用所選桶 API 座標、過遠與定位失敗情境。送出仍走後端媒體及回報流程，說明自動附模擬標記；不自動查證或發點。操作見 [前端 README](../frontend/README.md)，範圍與限制見 [驗證紀錄](FRONTEND_REPORT_DEMO_VALIDATION.md)。

2026-10-20 #18–#20 已接有效認養快捷通報與台北月報、分頁未讀站內通知與 typed target、管理員獨立 lifecycle 版本確認撤桶。後端投影停止認養／回報與工單操作，路線重讀排除撤桶，保留歷史與既有結算；詳見 [驗證紀錄](FRONTEND_FINAL_FLOWS_VALIDATION.md)。未部署或寫入雲端驗收資料。

2026-10-20 #15–#17 前端已接管理員提案合法階段審查、原提案人命名與管理員審核、認養申請／管理員審核／本人偏好與撤回結束。權益及公開名稱只讀後端，最新 ETag 與原命令重試跨角色隔離；未部署或寫雲端驗收資料。見 [驗證紀錄](FRONTEND_STEWARDSHIP_VALIDATION.md)。

2026-10-20 #12–#14 前端已接會員帳本／獎品兌換及 DEMO 展示券、公開／隊員台北曆月成果、選點查周邊／提案／投票與個人列表。業務數值及關票狀態只讀後端，未知命令保留原 key；未部署或建立雲端驗收資料。詳見 [串接驗證](FRONTEND_ENGAGEMENT_VALIDATION.md)。

2026-10-19 前端串接更新：GitHub #6–#10 將正式首頁切換為後端 API，已接地圖／桶詳情／歷史、角色 session、市民照片回報、隊員接單／到場／逐筆查證、各類現場完工／待修繕／無需處理、獨立管理員示範清空、市民感謝及會員摘要／台帳。尚未串接的操作顯示未開放；舊 A／B／D 本機展示保留於開發測試入口，不匯入其 localStorage。下方先前「前端尚未串接」段落為歷史狀態；現況與限制見 [前端 README](../frontend/README.md) 及 [串接驗證](FRONTEND_API_INTEGRATION_VALIDATION.md)。

2026-10-19 #11 已接隊員道路站點：正式 #staff/route 依後端起點、有序桶位及各張工單產生既有 Valhalla 機車／汽車指引，前景重讀並於站點或工單變動失效；驗證與限制見 [道路指引](CREW_ROUTING.md)。

前端已配合雙種類 API：同點位的 general／recycling 各自查桶況與歷史，導航／回報／工單／成果標示種類，照片草稿與待重試按讚不跨槽；舊未分類歷史保留 null。位置 UUID 與公布筆數不變。驗證使用 API 攔截，未新增雲端驗收資料。

PM 提供的 PRD、Web flow、手機 App flow 與新增 User flow，統一由 [產品需求與使用者流程](PRODUCT_REQUIREMENTS.md) 提供入口。該頁記錄產品規劃來源；目前已完成能力以本文件及各flow驗證紀錄為準，已確認的實作契約見[A flow](A_FLOW.md)、[B flow](B_FLOW.md)及[D flow](D_FLOW.md)規格，實際驗證紀錄與規格一併記錄展示範圍。

[B flow 規格](B_FLOW.md) 已於2026-10-18完成使用者確認，範圍為 P10–P16 前端本機展示，已加入投票、認養、快捷通報與展示控制。A flow 認養資格與回報事件週期已同步調整；驗證結果見 [B flow 驗證紀錄](B_FLOW_VALIDATION.md)。

[D flow規格](D_FLOW.md)已於2026-10-19經四輪確認並完成前端本機實作，驗證見 [D flow 驗證紀錄](D_FLOW_VALIDATION.md)；決策歷程見[整合討論](D_FLOW_OPEN_QUESTIONS.md)。同一frontend新增獨立清潔隊工作台，與市民介面共用事件、工單及結算。正式產品以桶內IoT測距聯網回傳後台更新App，本次只用明示示範回傳。清空即更新容量；滿桶須新清空回傳、到場查證及完成照齊備才自動結案，非滿桶依各自工作證據。查證屬實即一次發點，與事件結案分開；排名按完成件數，前三名加給只展示，讚不列排名。A／B接合調整已實作並註明於各規格，目前程式仍無硬體接收能力。P20依使用者追加需求支援機車／汽車道路指引，透過公開 Valhalla 路線服務計算；固定展示起點、無即時GPS／路況或排程最佳化，詳見 [清潔隊道路路線](CREW_ROUTING.md)。

## 1. 產品目標與目前範圍

BinSoon（台北丟垃圾變順）是台北市智慧垃圾桶黑客松 MVP。先以大安區作為主要分析與展示範圍，資料設計與 API 應能支援台北市十二行政區。

目前已完成資料初始化、基本讀取、候選點新增與空間距離查詢。前端位於 `frontend/`，使用 React＋TypeScript＋Vite、Leaflet＋MapLibre 展示 811 筆位置紀錄（681 筆公布桶位置＋130 筆場所代表點），支援十二行政區篩選。前端已加入 [A flow 展示](A_FLOW.md)：找桶、桶詳情、示範登入、導航、回報審核與會員／獎品兌換（1018 版本於 `feat/frontend-v0`）。讀取原始 CSV 產生的靜態快照，未串接後端 API；新增桶況及互動皆為標示清楚的示意資料，不提供即時桶況。D 工作台提供明示的單次清空回傳按鈕；未實作真實 IoT、連續感測器模擬、推薦演算法、裝置管理、正式收運排程或自動選址。

「候選點」表示需要人工現勘的提案，不表示已核准設置或已有真實清潔箱。距離較遠也不等於已證明有設置需求；本階段不提供此類推論。

## 2. 儲存庫與執行位置

儲存庫：`git@github.com:mrwenwei/BinSoon.git`。

後端全部位於 `backend/`，前端位於 `frontend/`。後端 Docker build context、掛載路徑、pytest 工作目錄與 importer 預設資料目錄都以 `backend/` 為基準。

從根目錄使用 Compose 時需同時指定檔案及環境檔：

```sh
docker compose -f backend/compose.yaml --env-file backend/.env up --build
```

建議直接 `cd backend` 後執行文件中的指令。Compose 專案名稱固定為 `trashbin_soon`，保留原開發環境的容器／volume 命名與資料相容性。
## 產品與範圍

台北市智慧垃圾桶 MVP，地圖預設大安區，資料支援十二行政區。後端已有資料初始化、點位查詢、新增 Bin、滿度／清運歷史及可重現模擬。前端 A／B／D 為獨立本機展示，尚未串接後端；無 IoT 硬體通訊、選址最佳化或正式派工。

2026-10-19 使用者確認後端擴充並完成實作與Cloud Run部署：新增身分／媒體、回報／事件／工單、會員／點數兌換、提案／投票／認養、通知／成果與統計，migration head=0006、線上revision=binsoon-api-00008-v7k。frontend未修改，pytest只在本機；雲端已驗證三角色、私有GCS及明示回報到結案閉環。完整範圍見 [後端計畫](../backend/docs/BACKEND_ROADMAP.md)，前端請讀 [串接指南](../backend/docs/FRONTEND_INTEGRATION.md)、[逐項API參考](../backend/docs/API_REFERENCE.md) 與 [API 契約](../backend/docs/API_CONTRACT.md)。部署紀錄見 [DEPLOYMENT_STATUS](../backend/docs/DEPLOYMENT_STATUS.md)。既有與新增 Bin 繼續使用同一 ID；市民提案關聯 proposed Bin，不表示已實際設置。新功能需由前端負責人另行串接。

使用者最新要求：新增的 candidate 等同 Bin，統一模型與查詢。這不表示已實際設置；`bin_type=proposed`、`placement_status=proposed`、`feasibility_status=pending_review` 保留其待現勘意義。Hotspot 仍不是 bin。

## 目錄與環境

後端程式、資料、測試、migration、部署腳本與部署文件都在 backend/。frontend/ 已包含 React／TypeScript／Vite 的 A／B／D 展示。後端命令於 backend/ 執行；根目錄 Compose 需 `docker compose -f backend/compose.yaml --env-file backend/.env ...`。

Compose 專案固定 trashbin_soon，沿用 postgres_data volume。Python 3.12、FastAPI、SQLAlchemy 2、Pydantic v2、psycopg 3、PostgreSQL 16/PostGIS、Alembic、pytest；requirements.lock 固定依賴。

## 原始 CSV 與來源

| 檔案 | 實際內容 | 全市／大安區 | 處理 |
| --- | --- | --- | --- |
| backend/data/existing_bins_all_taipei.csv | 獨立清潔箱點位 | 681／47 | bins，bin_type=existing |
| backend/data/daan_hotspot_gap_screening.csv | 景點商圈聚合代表點 | 130／18 | hotspots |
| backend/data/hotspots_all_taipei.csv | 缺口分析參考 | 18／18 | 不自動匯入 |

後兩檔名與內容對調。匯入器檢查 schema，發出警告後載入真正聚合資料，原始 CSV 不改寫。景點 reported_count 是周邊清潔箱數量，不能展開成獨立點。缺口分析不能被當作真實新增點位。

UTF-8-SIG 讀取，驗證 UUID、來源唯一性、行政區、座標有限值、非負 reported_count、全市與大安區筆數；新版資料需明確調整驗證，不移除檢查。以 (source_type,source_row) upsert，保留 ID、created_at，updated_at 更新；兩組資料同一 transaction。沒有自動刪除，來源列號重排需先規劃識別策略。

十個模型推薦點另保存在 daan_phase1_10bins.json，UUID 與 external_id 穩定，source_type=model_recommendation。分數不是實測人流或垃圾量。第 4、7 點依保存的官方圖資位於中正區，座標與排名保留並警告；十點均需現勘。圖資來源、SHA256、授權與轉換見 backend/data/BOUNDARIES.md。

## 資料模型

- **Bin / bins**：所有既有及新增點，使用單一 UUID。bin_type 區分 existing/proposed；保留 name、address、status、placement_status、feasibility_status、推薦資訊及來源欄位。
- **Hotspot / hotspots**：景點聚合代表點，name、reported_count、location_precision。
- **BinState / bin_states**：每(bin_id,waste_type)一筆，general／recycling各自滿度、模擬容量、速度、觀測／清運時間；附classification_source，不更改Bin來源。
- **BinReading / bin_readings**：所有 Bin 的 measurement／collection／reset 事件；bin_id、waste_type、分類來源、滿度、UTC時間、source_type、generation；舊讀值種類為null。
- **SimulationClock / simulation_clocks**：全體共用持久化時鐘、seed、倍率與 generation。
- **SimulationAdvance / simulation_advances**：request UUID、generation、時長與完成時間，處理重試去重。

沒有額外 registry、Candidate Model 或 Demo 專用讀值表。所有位置為 Geography(Point,4326)，GiST 索引；經度在前，API 經緯度為 numeric。所有時間為 timezone-aware UTC / timestamptz。

## API 與行為

主要使用 /api/v1/bins：列表、POST 新增、/{id} 詳情、/{id}/history、/{id}/collect、/collection-priorities。列表預設大安區，包含 existing/proposed；district=all 查全市，bin_type 篩選類型，format=geojson 取得 FeatureCollection。單一 ID 可查任一 Bin 的目前使用量及歷史。

原 /candidates GET／POST 已依使用者授權移除，回404；同時清除專用DTO與距離投影helper，不動bins資料或來源欄位。市民新增點用POST /proposals，維運直接建立用POST /bins，讀建議點用 /bins?bin_type=proposed。提案前用 /map/availability 檢查周邊已設置桶（含後續installed新增桶）；Hotspot不是Bin。

舊 /demo/* 在新版本移除，控制集中 /api/v1/simulation/{status,seed,advance,pause,resume,reset}。既有 POST 維持共享 Admin Bearer token；未設定時 503、未授權時 401。ADMIN_TOKEN 支援舊 DEMO_ADMIN_TOKEN fallback。新增產品API採可撤銷session及citizen/staff/admin權限；管理API亦可接受維運token，不能用共享token冒充市民／隊員。帳密與 token 不提交 Git。

新增資料位於 app/modules：User／AuthSession、MediaAsset、Incident／Report／WorkOrder／Evidence／Completion、PointEntry／Reward／Redemption、Proposal／Vote／ProposalReview、Adoption、Notification／CompletionLike／WorkAction／Idempotency。舊Bin／狀態／歷史仍是同一套資料；產品寫入以資料庫advisory transaction lock序列化，部分唯一索引及首報FK再保證完整性。查證結算與工單完成分開，reset不影響會員台帳或工單。

請求驗證在 Pydantic：十二行政區、有限座標與全球範圍、非空白 name 等。舊POST Bin一般新增點尚未用多邊形驗證歸屬，推薦 seed 有區界檢查；新市民提案必須位於保存的官方大安區圖資內，不使用前端示範矩形當行政邊界。

## 狀態、歷史與模擬

CSV 匯入／POST Bin 同一 transaction 初始化缺少的狀態及歷史，不重設現有讀值。新增 Bin 從加入時的模擬時間開始，不補造過去資料。有效 ID 無讀值時 current_usage=null、history=[]；未知 ID 為 404。GET 沒有寫入或時間推進副作用。

目前所有滿度都是 simulated，包括既有清潔箱。新一般槽120公升／回收槽80公升、回收速率倍率0.65及基礎速率、時段／週末倍率與 noise 都是假設，estimated_used_liters 為估算。未來 iot_sensor 讀值可沿用查詢格式，硬體 ingestion 尚未實作；模擬只更新 source_type=simulated 的狀態。

固定 seed=42，統一手動 advance，不靠前端 timer，也沒有每個 Bin 無限背景迴圈。分鐘級 BLAKE2 noise 可重現，拆分推進結果相同，滿度限制 0～100。資料庫 advisory transaction lock 序列化 seed、建立、推進、清運與 reset；request ID 防重試重算，generation 拒絕 reset 前未完成的舊請求。

Reset 歸零並回復初始時鐘，generation +1；保留歷史，新增 reset 事件。歷史可篩選 UTC 時間、generation、source_type，使用 limit/offset 分頁。優先程度 >=90 critical、>=80 high、>=50 medium、其餘 low，非市府標準；到 90% 的估計以基礎速率外推，零速率 null。

## 遷移、部署與測試

0001、0002 已部署，不能改寫。0003 複製並合併 trash_bins/candidate_locations 到 bins，轉換狀態／歷史 FK 與欄位名，保留 UUID、來源、原始資訊、讀值與歷史 ID。UUID 衝突或多時鐘停止，不默默重新識別。舊表複製後移除，這是需協調切換的 schema 變更，downgrade 不會嘗試丟棄新歷史。

0003 已於 2026-10-19 完成雲端備份、維護與切換，正式 revision binsoon-api-00004-lql。第一次跨越破壞 schema 相容性的 revision 仍需備份、維護及停止舊寫入，不能直接當作無停機滾動升級。API 依 PORT 啟動且冷啟動不 migration/import；雲端使用獨立初始化 Job，Compose 啟動前初始化。migration/import 各自提交，不宣稱整體原子。

測試使用本機真實 PostGIS。一般測試外層 transaction rollback；獨立 schema 驗證完整 migration、UUID 衝突與真正並行。不得對正式 DB 跑 pytest。基本數量以 existing 篩選仍為全市 681／大安區 47，hotspots 130／18，總 Bin 數包含新點而增加。

操作與範例見 [統一 Bin 手冊](../backend/docs/BINS.md)、[後端 README](../backend/README.md)；已部署的歷史版本見 [DEPLOYMENT_STATUS.md](../backend/docs/DEPLOYMENT_STATUS.md)。

目前完成項目、驗證與待辦整理見 [PROGRESS.md](PROGRESS.md)。

## 本輪雙種類變更（已部署 Cloud Run）

依使用者要求所有現有／新增／推薦／提案Bin先配置general與recycling兩槽；CSV無分類證據，均明示demo_assumption。0006將舊State及舊業務案件標為legacy_assumed_general並保留數值，舊Reading保持null種類／legacy_unclassified，不複製。一般／回收各自歷史、滿度、速率、清運及事件工單；地圖／導航按選定種類判可用，省略種類預設general。認養與提案仍為點位，會員依實際查證台帳計算。

本機與雲端head=0006，正式revision=binsoon-api-00008-v7k。0006複合主鍵及雙槽數量不支援舊程式直接讀寫，部署需備份／維護／初始化Job／新程式協調切換，不可單純回滾舊映像。細節見 [WASTE_STREAMS](../backend/docs/WASTE_STREAMS.md)。

### 本機 API 連線（2026-10-21）

本機 Vite dev／preview 在 loopback 網址使用同源 `/api/v1` 代理至公開 `VITE_API_BASE_URL`（未設定則沿用 Cloud Run）。修正 5180 預覽埠不在後端 CORS allowlist，導致 API 回 200 但瀏覽器顯示連線失敗的問題。正式網域仍直接使用公開 API URL；未變更後端 CORS、資料或市民展示隔離。一般靜態檔案伺服器須自行提供同樣代理。

2026-10-23 預約小車：新增市民 `#van` 與清潔員 `#crew/van`，四分頁入口；全流程使用獨立 localStorage 假資料，不呼叫 API。台北日期明日起七天可預約，早／晚班各可預約一站，支援修改、取消與分享；前一天 20:00 公布後停止修改。固定五個展示停靠點以十人為開站門檻，不足者併入最近展示開站點。清潔員可選日期／班別、逐站導航、到站倒數及完成收運。地圖、距離、路線順序與人數基礎皆為展示假設，無真實 GPS、道路服務、收運派遣或後端資料；收運進度僅保留目前頁面，預約存於同瀏覽器並跨分頁同步。不修改既有 Bin／CSV／歷史。

2026-10-23 小車地圖依使用者修正，兩端共用既有 LocationMap 與底圖來源；站點座標與路線保持本機展示資料，僅圖磚連外，不呼叫後端或道路規劃 API。詳見 [預約小車](VAN_FLOW.md)。

2026-10-23 清潔隊小車導航依使用者追加要求改走既有 Valhalla 汽車（auto）道路服務，每站重新取得前站至本站路線、距離及時間；失敗可重試且不以直線替代。預約及站點仍為本機資料，不打 BinSoon 後端。此段優先於上文小車不呼叫道路服務描述，細節見 [小車流程](VAN_FLOW.md)。
