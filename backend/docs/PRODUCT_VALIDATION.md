# A／B／D後端驗證紀錄

## 本輪雙種類0006（已部署 Cloud Run）

- Python3.12＋本機真實PostGIS完整回歸：**81 passed／67 warnings／638.35秒**。執行開始後補入的兩個新案例另驗：四連線跨種類事件／首報（1 passed／8.78秒），舊evidence快照重播（包含在下方容器3項中）。目前共83個不同測試案例均已實際通過。
- 最終Docker補驗：舊evidence快照重播、最新OpenAPI快照、general零速率／滿度邊界 **3 passed／4 warnings／57.40秒**。前兩種重點測試與遷移／Bin API先行22項亦通過（128.95秒）。
- 0006在本機upgrade成功，host及Docker的alembic check均無新差異；CSV重入維持681個existing位置及130個場所，缺少的回收槽初始化後不再重複建立。
- 本機Compose已重新build且API／DB healthy；首次啟動曾停在Created，停止並重建API後恢復。測試使用本機Python與獨立schema完成，不對正式Cloud SQL執行。
- 兩支交付的唯讀HTTP腳本均通過；實際HTTP另驗證兩個compartments、recycling current_usage／view／history與官方點位數不變。
- 68 paths／70 operations／88 schemas快照同步；15份改動Markdown的130個本機連結、14個JSON範例有效，另5組完整API JSON範例通過實際Pydantic模型驗證。shell語法及git diff格式檢查通過。
- 新涵蓋：兩槽各自容量／速度／可重現、滿度邊界及reset，單槽清運、不混歷史、一般已滿回收可導航、修繕隔離、兩個滿桶事件與首報、清空只完成對應工單、種類統計／成果、舊未分類歷史ID保留、分類假設及舊冪等重播。
- 原始CSV、Bin UUID／座標／來源及歷史不改寫；兩種類配置是展示假設，不代表官方清冊證實有兩個實體桶。未修改frontend／本機.env；本輪程式、測試與部署紀錄一併提交；已部署Cloud Run 0006／binsoon-api-00008-v7k，線上驗收見部署紀錄。

本輪雲端實際驗收：692個點位／原滿度與693筆舊歷史逐筆保留，新增692筆回收reset；三角色、CORS、私有GCS及線上OpenAPI一致性通過。未操作advance／reset／collect，詳細見 [部署紀錄](DEPLOYMENT_STATUS.md)。

模型、API及升級限制見 [雙種類文件](WASTE_STREAMS.md)。以下為先前單種類版本的歷史驗證紀錄。

2026-10-19。pytest僅使用本機開發PostGIS及獨立測試schema，未對Cloud SQL執行pytest。後續依使用者要求已部署Cloud Run並完成明示HTTP展示驗收，frontend未修改；部署／GCS結果見 [部署紀錄](DEPLOYMENT_STATUS.md) 最新章節。

## 測試結果

- Docker內最新完整 `docker compose exec -T api pytest -q`：**74 passed，187.11秒**（本輪移除candidates後）。
- 本輪第一次重跑為72 passed／2 failed：本機已初始化展示帳號，seed按設計不覆寫密碼，原測試卻假設空白帳號／節流表。已將test_product的DB fixture改用獨立schema，未修改本機既有帳密、清空開發資料或改動登入API；修正後完整74項通過。
- 包含既有36項回歸、新產品API31項、獨立連線並行5項、部署腳本1項、真實HTTP驗收1項。
- 先前獨立Python 3.12環境完整73項亦通過（157.02秒）；後補固定投票情境另測通過，並已納入上述Docker完整74項。
- `alembic upgrade head` 成功，head=0005；`alembic check` 無新差異。
- Docker掛載曾停滯，先改由本機Python連同一本機PostGIS驗證；停止／重建API容器後已恢復，`docker compose up --build -d --wait` 成功且API／DB健康。原DB volume保留，新增media_data。
- OpenAPI匯出69個路徑；66個文件中明列的單一operation與實際規格比對無缺漏（其餘為表內合列的既有入口）。快照與實際OpenAPI的契約測試通過。
- 新API 422使用ApiError，舊API仍是HTTPValidationError；必要的Idempotency-Key／If-Match已列入Swagger，登入密碼標記writeOnly/password。
- Python語法、部署shell語法、依賴鎖定與git diff格式檢查通過。

標準驗證已實際執行：Compose build／健康檢查、alembic upgrade head、alembic check、CSV重入（681／130）與容器完整pytest。測試只有既有CSV檔名警告及Starlette/httpx棄用提醒，未隱藏。

最後補上圖片buffer釋放後，照片私有存取、GCS adapter及真實HTTP閉環三項容器測試再次通過（6.81秒）。API重啟後執行 `check_product_demo http://127.0.0.1:8000` 唯讀驗收通過，Compose API／DB皆healthy。11份改動Markdown的85個本機連結、9組JSON範例及git diff格式檢查通過；frontend與本機.env沒有改動。

## 實際涵蓋

| 領域 | 驗證內容 |
| --- | --- |
| 原有API | 681／47桶、130／18場所、來源／UUID／歷史保留、CSV重入、GeoJSON、模擬determinism、0..100、並行advance／seed及舊權限。 |
| 身分 | 登入、token雜湊、期限、登出撤銷、關閉展示登入、節流、角色及責任區。 |
| 照片 | 真實JPEG上傳、EXIF移除、無效／過大檔案、他人不可讀、短效URL及登出後本機票證失效；GCS adapter以mock測呼叫契約。 |
| 地圖 | 地圖／詳情同桶況、無GET寫入、全市與大安筆數、滿桶仍算位置存在、nearest排除不可用桶、座標驗證、811筆批次查詢<=6 SQL。 |
| 回報／工單 | 五種問題、事件內去重、多市民合併、首報與後報、到場前不可查證、拒絕不遞補、兩種清空／照片順序、維修、無需處理、區外未分派及結案後新事件。 |
| 點數／兌換 | 查證立即結算、認養送出快照+2、後報0、三次不實僅停回報、贈點明列且重跑不重發、餘額與庫存原子扣除。 |
| 提案 | 建立同一Bin ID、官方區界拒絕、台北月額度、60／60%邊界、改票／撤票／同票no-op、達標鎖定、審查設置及命名歷史；固定虛構投票CLI可重跑且不影響會員點數。 |
| 認養／通知 | 待審不保留名額、核准／結束、偏好、月報、撤除阻擋、門檻通知一次及已讀一次；不虛構seed市民獎勵。 |
| 成果 | 完成及按讚各一次、月統計、下一站排除完成／修繕／待感測、simulation reset與裸collect不會成為工單完成證據。 |
| 真並行 | 獨立連線／commit：四市民只有一事件及首報、同key重播、四人搶一庫存、四案只成功三案、同案查證只入帳一次。 |
| 真HTTP | 在獨立schema啟動實際uvicorn，以交付的check_product_demo執行唯讀及寫入完整閉環；不是只用TestClient。 |
| 部署腳本 | fake gcloud驗證JSON CORS分隔符與Secret reference；新登入密碼reference不混用舊維運token別名，無真實雲端操作。 |

## 新增／修改檔案範圍

- `app/modules/`：路由、schema、ORM、共用交易、身分、照片、回報／工單、會員兌換、提案／認養及讀取投影。
- `app/main.py`、`config.py`、`models.py`、`services/simulation.py`：接入新模組，保留舊回應，補觀測時間／序列及滿桶通知。
- `alembic/versions/0004_product.py`、`0005_product_integrity.py`；舊revision不改寫。
- `scripts/seed_product_demo.py`、`seed_product_votes.py`、`check_product_demo.py`、`product_maintenance.py`、`export_openapi.py`。
- `tests/test_product*.py`及舊migration測試的最新head升級路徑。
- pyproject／requirements.lock、Compose／環境範例、部署腳本／範例、媒體排除設定。
- API契約／OpenAPI快照／操作／計畫／驗證文件及既有進度／部署入口。

## 尚未驗證／限制

- 真實GCS上傳／下載／IAM簽名、匿名讀取拒絕、Cloud Run新版100%流量、三角色登入／登出、CORS及回報到結案閉環皆已驗證；明示驗收資料保留，詳見部署紀錄。未做正式流量壓力測試。
- 台北通、簡訊、LINE、IoT ingestion／硬體、正式核銷／薪資不在範圍。
- 尚未進行frontend串接、實體手機或真實地點現勘；新增點不等於已實際設置。
- 產品寫入採全域advisory交易鎖，適用展示負載，未作正式高併發壓力驗證。
- 既有CSV檔名對調警告及Starlette/httpx棄用提醒保留，未隱藏或藉機升級既有框架。

## 本輪API清理驗證

- 移除GET／POST `/candidates`、CandidateRead及專用helper；不新增migration，Alembic head仍0005，check無差異。
- 最新契約為68 paths／70 operations／87 schemas；上方69路徑描述為前次部署歷史。
- 匿名及帶管理token請求已移除路由皆404，OpenAPI也無路由與DTO；新增Bin仍能以同UUID查狀態／歷史，existing數量不變。
- `check_deployment`預設唯讀模式改驗證舊路由404；明確寫入旗標改為 `--create-bin`。在獨立PostGIS schema啟動真實uvicorn，實測唯讀、直接POST Bin及原A→D→A閉環均通過。
- 已實際執行Compose build／健康、migration upgrade／check、CSV upsert（681／130）、完整pytest（74 passed／61 warnings／187.11秒）；另外本機執行兩支唯讀HTTP驗收程式均通過。
- API全覽逐項比對OpenAPI70個操作一致；16份Markdown的125個本機連結、13個JSON範例及87個DTO anchors檢查通過。前端與.env未提交；Cloud Run驗收另見最新部署紀錄。
