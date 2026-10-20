# BinSoon 專案進度

更新日期：2026-10-20（Asia/Taipei）。線上數量與驗收結果以最近一次部署紀錄為基準，非即時統計。

## 前端 #15–#17

提案審查、命名與認養已串接既有後端，僅合法角色／階段操作；後端 ETag、確認與原命令重送控制衝突，pending 不提供認養權益。未部署，詳見 [專項驗證](FRONTEND_STEWARDSHIP_VALIDATION.md)。

## 前端 #12–#14

會員帳本／兌換展示券、公開／隊員月份成果與提案／投票已接後端，所有點數／票數／排名與關票由伺服器決定。採 API 攔截驗證，沒有部署或寫入雲端驗收資料；結果與限制見 [驗證紀錄](FRONTEND_ENGAGEMENT_VALIDATION.md)。

## 本輪雙種類（已部署 Cloud Run）

每Bin新增general／recycling獨立滿度、容量、速率、歷史與清運；回報／工單／成果／通知及地圖／導航同步按種類處理。新增0006，舊歷史保留未分類，舊State明示假設對應general。分類與規格都是展示假設，並非CSV新證據。完整API及影響範圍見 [雙種類文件](../backend/docs/WASTE_STREAMS.md)。已部署0006／binsoon-api-00008-v7k；本輪程式、測試與部署紀錄一併提交；部署時來源為工作樹快照。

## A／B／D後端新增（2026-10-19已部署）

- 已實作A／B／D持久化展示後端：身分／角色、照片、地圖讀取、回報／事件／工單、查證發點、會員／兌換、提案／投票／命名、認養、通知、按讚、路線站點及月統計。
- 新migration 0004／0005已在本機驗證；原0001–0003不改寫，既有API格式及UUID保留。
- 展示登入程式預設關閉；既有雲端展示環境已明確啟用三角色並seed獎品，無初始贈點／seed虛構待辦。照片本機用named volume，Cloud Run已配置私有GCS並驗證短效下載。seed不隨CSV／冷啟動執行。
- frontend完全未修改，仍是localStorage展示；真實台北通／SMS／LINE／IoT及正式派工不在本次範圍。
- 前端交接：[串接指南](../backend/docs/FRONTEND_INTEGRATION.md)、[完整API參考](../backend/docs/API_REFERENCE.md)、[API_CONTRACT](../backend/docs/API_CONTRACT.md)。驗證結果見[後端驗證紀錄](../backend/docs/PRODUCT_VALIDATION.md)。

## 已完成

- 後端集中在 backend/，包含程式、原始資料、migration、測試、部署腳本與操作文件；frontend/ 已合併 A／B／D 本機展示，尚未串接後端。
- 既有清潔箱與新增點統一為 Bin，原 UUID、座標、來源追溯、推薦分數與狀態保留；不再使用獨立 Candidate ORM／資料表。
- 支援 Bin 列表、新增、依 ID 查詢、滿度歷史、清運、優先順序及 GeoJSON；列表可篩行政區、existing/proposed 與推薦分組。
- 所有 Bin 共用目前滿度與歷史，新增當下即建立初始紀錄；有效 ID 無讀值回 null／空歷史，未知 ID 回 404。
- 統一後端模擬時鐘，支援 advance、pause、resume、reset；固定 seed、分鐘級可重現噪音、時段／週末倍率、0～100% 邊界與 request ID 去重。
- Reset 保留舊歷史，以 generation 區分輪次；GET 不會推進時間。模擬尚非自動隨牆鐘執行。
- 既有 POST 需 Admin Bearer token；支援既有 DEMO_ADMIN_TOKEN 設定，推薦 ADMIN_TOKEN。新產品API使用個人session與角色；本輪已移除GET／POST /candidates及專用DTO／helper，/demo路由亦已移除。API全覽為68 paths／70 operations；其餘舊資料／維運入口保留用途說明。
- Migration 0002 加入推薦資料與模擬；0003 完成統一 Bin 與歷史遷移。已部署 revision 不改寫，0003 不支援直接降回舊 schema。
- 已部署至 Cloud Run，資料儲存在獨立 Cloud SQL；容器冷啟動不會重新匯入或 reset。

## 最近部署

| 項目 | 結果 |
| --- | --- |
| GCP 專案／區域 | binsoon／asia-east1 |
| 正式 revision | binsoon-api-00008-v7k，100% 流量 |
| 資料庫 schema | Alembic 0006 |
| 部署驗收時 Bin | 692：既有 681、新增 11（十個推薦點及一筆既存驗收點） |
| 景點聚合 | 全市 130／大安區 18 |
| 既有清潔箱 | 全市 681／大安區 47，需 bin_type=existing 篩選 |
| 遷移前 Cloud SQL 備份 | 1792413961467，SUCCESSFUL |
| 初始化 execution | binsoon-api-initialize-2ndsb，成功 |
| 展示帳號 execution | binsoon-api-product-seed-2sgbz，成功；0初始贈點 |

0003切換曾採維護入口與資料保留比對；0006亦採維護／排空／備份／初始化Job／新版切流；不可直接回滾舊映像。本機83個不同測試案例分批實際通過，線上完成登入、GCS及明示回報／查證／結案驗收。完整映像digest、Cloud Build、來源快照與驗收證據見 [部署紀錄](../backend/docs/DEPLOYMENT_STATUS.md) 最新章節。

[Swagger](https://binsoon-api-887203439341.asia-east1.run.app/docs)・[全市 Bin](https://binsoon-api-887203439341.asia-east1.run.app/api/v1/bins?district=all)・[模擬狀態](https://binsoon-api-887203439341.asia-east1.run.app/api/v1/simulation/status)

## 已部署0003版本的歷史驗證

- 最近完整本機驗證：36 項 pytest 通過，使用真實 PostGIS；涵蓋資料遷移／保留、UUID 衝突、並行 seed／advance、重試去重、統一查詢與歷史、權限及維護入口。
- Alembic check 無差異，Python 語法、部署 shell 語法、文件相對連結及 git diff 檢查通過。
- 線上 HTTP 驗收通過：官方筆數、統一 ID 查詢、歷史、GeoJSON、優先清單、Admin 授權與冪等 seed；未對雲端資料庫跑 pytest。
- 已知提醒：CSV 檔名對調警告與 TestClient 的 httpx 棄用提醒仍存在，未隱藏或藉此升級依賴。

## 資料限制與尚未完成

- 所有滿度、容量、填滿速度與估計公升數都是 simulated，包含真實既有清潔箱；沒有實測感測器資料。
- 新增點以 proposed／pending_review 標記，仍需現勘，不代表已實際設置。十個推薦點的第 4、7 點依保存區界圖位於中正區，原始座標與排名保留並警告。
- 兩份 CSV 檔名與內容對調；原檔保留，以實際欄位辨識，缺口分析不自動變成 Bin。CSV 的更早上游來源與採集時間尚無完整證據。
- 一般人工新增點尚未依多邊形驗證行政區歸屬；推薦 seed 有區界檢查。
- 前端 A／B／D 尚未串接已部署新版後端。IoT ingestion／硬體通訊、正式清運派工及選址最佳化未實作。
- 本機連線 Cloud SQL 的操作方式已提供，採 Auth Proxy + localhost:5433；本次工作未代為安裝 Proxy 或驗證個人電腦的直接 DB 連線。

## 接續工作入口

後端與Cloud Run部署已完成；接下來由前端負責人依[串接指南](../backend/docs/FRONTEND_INTEGRATION.md)替換資料層。真實GCS及IAM已驗證，CORS目前允許localhost／127.0.0.1:5173；其他前端網域需另加入完整origin。

前端可直接串接 /api/v1/bins、/bins/{id}、/bins/{id}/history；地圖用 format=geojson。未來感測器讀值應標記 iot_sensor，沿用統一查詢並新增受驗證的 ingestion，不得讓模擬覆寫實測狀態。這些是後續範圍，尚未實作。

[架構與領域背景](PROJECT_CONTEXT.md)・[後端啟動](../backend/README.md)・[Bin API 操作](../backend/docs/BINS.md)・[部署與回復手冊](../backend/docs/MANUAL_DEPLOYMENT.md)
