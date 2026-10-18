# BinSoon 專案背景與架構

## 1. 產品目標與目前範圍

BinSoon（台北丟垃圾變順）是台北市智慧垃圾桶黑客松 MVP。先以大安區作為主要分析與展示範圍，資料設計與 API 應能支援台北市十二行政區。

目前已完成資料初始化、基本讀取、候選點新增與空間距離查詢。前端位於 `frontend/`，使用 React＋TypeScript＋Vite、Leaflet＋MapLibre 展示 811 筆位置紀錄（681 筆公布桶位置＋130 筆場所代表點），支援十二行政區篩選。前端已加入 [A flow 展示](A_FLOW.md)：找桶、桶詳情、示範登入、回報與集章／兌換。讀取原始 CSV 產生的靜態快照，未串接後端 API；新增桶況及互動皆為標示清楚的示意資料，不提供即時桶況。未實作 IoT、模擬感測器、推薦演算法、裝置管理、收運排程或自動選址。

「候選點」表示需要人工現勘的提案，不表示已核准設置或已有真實清潔箱。距離較遠也不等於已證明有設置需求；本階段不提供此類推論。

## 2. 儲存庫與執行位置

儲存庫：`git@github.com:mrwenwei/BinSoon.git`。

後端全部位於 `backend/`，前端位於 `frontend/`。後端 Docker build context、掛載路徑、pytest 工作目錄與 importer 預設資料目錄都以 `backend/` 為基準。

從根目錄使用 Compose 時需同時指定檔案及環境檔：

```sh
docker compose -f backend/compose.yaml --env-file backend/.env up --build
```

建議直接 `cd backend` 後執行文件中的指令。Compose 專案名稱固定為 `trashbin_soon`，保留原開發環境的容器／volume 命名與資料相容性。

## 3. 原始資料與檔名異常

所有 CSV 使用 UTF-8-SIG。以下是目前磁碟上檔案的**實際內容**，不是最初需求對檔名的描述：

| backend/data/ 下的檔名 | 實際內容 | 全市／大安區 | 用途 |
| --- | --- | --- | --- |
| existing_bins_all_taipei.csv | 個別清潔箱獨立點位，含 id、address、status、source_type、source_row、location_precision | 681／47 | trash_bins |
| daan_hotspot_gap_screening.csv | 景點商圈聚合代表點，含 id、name、reported_count、source_type、source_row、location_precision | 130／18 | hotspots |
| hotspots_all_taipei.csv | 大安區缺口分析，含 hotspot_id、nearest_listed_bin_m、listed_bins_within_300m、review_priority、proposal_status、caveat | 18／18 | 分析參考，不匯入 |

後兩份 CSV 檔名與原需求預期對調。`scripts/import_data.py` 先檢查預期景點檔的 schema；發現 screening 欄位時才檢查替代來源，發出警告並載入真正聚合資料。原檔未修改，實際檔名記在 `source_file`。

若未來將檔名修正回正常狀態，importer 會直接讀 `hotspots_all_taipei.csv`。不可為了湊滿筆數將 18 筆 screening 或 reported_count 展開成垃圾桶。資料集改版須明確更新筆數驗證與測試，而非移除品質檢查。

## 4. 資料模型

三張表共用欄位：

| 欄位 | 型態與意義 |
| --- | --- |
| id | UUID primary key；匯入資料沿用 CSV ID，人工候選點產生新 UUID |
| district | 行政區名稱，建立索引 |
| location | geography(Point,4326)，GiST index |
| source_type | 原始來源種類；候選點為 manual_candidate |
| source_row | 原始資料列號，候選點可為 null |
| source_file | 實際來源檔名，人工候選點為 null |
| note | 來源備註或人工說明 |
| created_at / updated_at | timezone-aware timestamp，UTC |

### trash_bins

表示真實既有清潔箱，額外保存 address、status、location_precision。資料來源必須是 `city_bin_inventory`，目前只接受 status=existing。`(source_type, source_row)` 有唯一約束。

### hotspots

表示景點／商圈聚合資料，額外保存 name、reported_count、location_precision。資料來源必須是 `scenic_commercial_aggregate`。reported_count 為非負整數，表示周邊清潔箱的統計數量。代表點不是個別清潔箱位置。`(source_type, source_row)` 有唯一約束。

### candidate_locations

表示人工建立的候選新增點，額外保存 name、status。預設 status 為 `needs_field_validation`。不由 CSV 自動建立，也不混入 trash_bins。

`nearest_bin_distance_m` 是 API 動態查詢結果，未儲存在 candidate_locations，因此清潔箱資料更新後距離會反映最新狀態。

## 5. 匯入流程與冪等性

執行方式（backend 工作目錄）：

```sh
python -m scripts.import_data
# 可指定另一份同格式資料目錄
python -m scripts.import_data --data-dir /path/to/data
```

1. 以 UTF-8-SIG 讀取並辨識兩組正式來源。
2. 驗證總數 681／130、大安區 47／18、行政區、座標有限值與範圍、UUID、來源種類、來源列唯一性、status、reported_count。
3. 兩組來源都驗證後，於同一個資料庫 transaction 中 upsert。
4. 以 `(source_type, source_row)` 作衝突鍵，更新來源資料與 updated_at，保留既有 ID 與 created_at。
5. 發生錯誤整批 rollback；不自動刪除來源不再出現的資料；不建立候選點。

冪等性指重跑不增加重複紀錄，並非每次執行所有欄位都完全不變：updated_at 會更新。來源列號若因新版 CSV 重排而改變，需先規劃穩定識別策略或資料遷移，不可直接當成一般更新。

## 6. API 契約

| Method | Path | 用途 |
| --- | --- | --- |
| GET | /health | 查詢資料庫可用性，正常回傳 status=ok，連線錯誤為 503 |
| GET | /api/v1/bins | 列出指定行政區既有清潔箱 |
| GET | /api/v1/hotspots | 列出指定行政區景點聚合資料 |
| GET | /api/v1/candidates | 列出指定行政區候選點與最近清潔箱距離 |
| POST | /api/v1/candidates | 建立人工候選點，成功為 201 |
| GET | /docs | Swagger UI |
| GET | /openapi.json | OpenAPI schema |

三個 GET 列表都接受 district query，預設大安區，限定台北市十二區。回傳 JSON 陣列，依 UUID 排序；目前無分頁。

POST 範例：

```json
{
  "name": "待現勘候選點",
  "district": "大安區",
  "longitude": 121.543,
  "latitude": 25.026,
  "note": "需現場確認"
}
```

name 不可空白，最長 200 字；note 最長 5000 字；額外欄位拒絕；district 可省略，預設大安區。longitude 範圍 -180～180，latitude 範圍 -90～90，不接受 NaN／Infinity。無效請求回傳 422。

目前只驗證全球座標範圍與合法行政區文字，未驗證座標是否落在台北市或所填行政區邊界內，因為目前沒有行政區界多邊形資料。

API 的 longitude／latitude 是 numeric，不回傳 WKB、WKT 或字串座標。source_*、精度描述、備註、UTC 時間也隨對應 schema 回傳。

## 7. 空間查詢語意

候選點建立與列表會執行 `MIN(ST_Distance(candidate_locations.location, trash_bins.location))`，以 geography 計算公尺距離。候選點雖依行政區篩選，距離搜尋涵蓋全市所有既有清潔箱，避免行政區邊界造成失真。

不使用 screening CSV 的 nearest_listed_bin_m 作為 API 距離，不以角度或未投影 geometry 距離充當公尺。無清潔箱時回傳 null。

目前資料量約 681 個清潔箱，採全體最小距離計算；GiST index 已建立，但不應宣稱目前 MIN/ST_Distance 查詢一定利用 GiST 做 nearest-neighbor acceleration。若未來資料量變大，需以實際 query plan 與精度要求評估優化。

## 8. 程式責任分工

| 檔案 | 責任 |
| --- | --- |
| backend/app/config.py | Pydantic Settings、環境變數、SQLAlchemy URL，密碼使用 SecretStr |
| backend/app/database.py | Engine、Session dependency、Declarative Base，連線設定 UTC |
| backend/app/models.py | 三張資料表與共用欄位 |
| backend/app/schemas.py | 請求驗證、回應契約、十二行政區定義 |
| backend/app/api.py | 列表與建立候選點、ST_X/ST_Y、ST_Distance |
| backend/app/main.py | FastAPI app、路由掛載、health |
| backend/alembic/env.py | Migration connection 與 application metadata，排除 extension-owned tables |
| backend/alembic/versions/0001_initial.py | PostGIS extension、三張表、索引與約束 |
| backend/scripts/import_data.py | CSV 品質驗證、檔案辨識與 transaction upsert |
| backend/tests/ | 真實 PostGIS 整合測試與驗證測試 |

Migration 必須是可追溯 revision。未來 schema 修改新增 migration；不在 API 啟動時用 SQLAlchemy create_all 偷改 schema。Docker 開發啟動流程會先跑 Alembic 再匯入。

## 9. 環境與開發限制

必要環境變數：POSTGRES_USER、POSTGRES_PASSWORD、POSTGRES_DB。可設定 POSTGRES_HOST、POSTGRES_PORT。主機執行時 host 預設 localhost；Compose API 內部固定連到 db:5432。

`.env.example` 只有本機範例，`.env` 不提交。資料庫與 API 僅綁定 127.0.0.1 的主機連接埠。Docker 時區與 DB 連線時區為 UTC。

PostGIS 映像使用 PostgreSQL 16 / PostGIS 3.4、linux/amd64；Apple Silicon 需要 Docker 模擬支援。Python runtime 為 3.12，依賴由 requirements.lock 固定。Compose 掛載 app、scripts、alembic、tests，以及唯讀 data；API 程式改動後需重啟服務，容器啟動未使用 uvicorn --reload。

本階段尚無登入／權限、分頁、更新／刪除端點。Cloud Run 部署流程見第 11 節。若未來開放對外存取，需先依實際部署需求補足這些能力，不要將本機 Docker 設定直接當成正式環境設計。

## 10. 驗證與已知警告

在 backend/ 執行：

```sh
docker compose up --build -d --wait
docker compose exec api alembic check
docker compose exec api python -m scripts.import_data
docker compose exec api pytest -q
```

目前測試 13 項，涵蓋資料筆數、重複匯入、來源追溯、地理 SRID、健康檢查、Swagger／OpenAPI、行政區查詢、數值座標、UTC 時間、候選點建立與列表、零距離與一般距離、無清潔箱情境及無效輸入。

各測試透過同一連線的外層 transaction 與 Session savepoint 隔離，API commit 不會永久保存測試新增點，測試結束 rollback。仍需使用開發／測試資料庫。

目前預期看見 CSV 檔名對調警告；測試套件另可能顯示 Starlette 對 httpx TestClient 的棄用提醒。兩者目前不影響測試通過。不可為了清除警告而隱藏資料異常或不經驗證升級套件。

驗收條件：Docker 啟動成功、migration 可執行且模型一致、匯入 681／130、預設大安區 47／18、重跑不重複、POST 後 GET 找得到候選點、座標與最近距離正確、pytest 全部通過。

## 11. Cloud Run 部署

部署架構與操作見 [CLOUD_RUN.md](CLOUD_RUN.md)。API 映像只啟動 HTTP；Compose 在啟動前執行 `scripts.initialize_db`，Cloud Run 使用獨立初始化 Job。初始化入口以 advisory lock 序列化 migration 與匯入。DB pool 上限每 instance 2 條連線，連線與 pool 等待均有 timeout。

## 12. 前端地圖與 A flow 展示

前端獨立啟動／建置，見 [frontend/README.md](../frontend/README.md)。初版地圖驗收見 [FRONTEND_V0.md](FRONTEND_V0.md)，使用者後續確認的 A flow 範圍及驗證見 [A_FLOW.md](A_FLOW.md)。10/20 初步展示、10/24 正式 Demo。

地圖以 Leaflet 顯示自製擬人像素標記及選取位置的 150m 直線參考圈，MapLibre 透過官方 Leaflet adapter 顯示 OpenFreeMap Liberty 底圖；保留 OpenFreeMap、OpenMapTiles、OpenStreetMap 與 Leaflet 署名。需要網路及 WebGL，底圖失敗時顯示提示，靜態位置清單仍可使用。

資料快照保留 source_type、source_row、source_file、location_precision，不載入 18 筆缺口分析，不展開 reported_count。前端圈線只為位置討論用途，不表示步行距離、服務範圍或缺桶判定。原始資料日期與實際設置狀態未經本次現勘確認。

A flow 預設大安區公布桶位置（47 筆），仍可切換全市及場所資料。示意距離以固定大安森林公園起點計算直線距離，不是使用者定位。帳號、按讚、回報、印章、兌換券保留於本瀏覽器；無真實簡訊、相機、定位或派工。回報點數維持待確認，不參與兌換；桶況、收受類型與認養者皆屬展示設定。
