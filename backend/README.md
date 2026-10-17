# 台北市智慧垃圾桶 MVP

Python 3.12、FastAPI、PostgreSQL 16 / PostGIS、SQLAlchemy 2、Alembic、Pydantic v2、psycopg 3。支援台北市十二行政區，查詢預設大安區。此階段提供資料初始化、列表查詢、候選點建立與最近清潔箱距離。

## 本機 Docker 開發環境

安裝 Docker Desktop（含 Compose），在 `backend/` 目錄執行（從儲存庫根目錄先執行 `cd backend`）：

```sh
cp .env.example .env
# 編輯 .env，設定本機資料庫帳密
docker compose up --build
```

服務會等待資料庫就緒，自動執行 `alembic upgrade head` 與 CSV importer，再啟動 API。首次啟動需下載映像；Apple Silicon 使用 amd64 PostGIS 映像的模擬支援。API 綁定本機 8000，資料庫綁定本機 5432；可透過 `.env` 的 POSTGRES_PORT 調整主機資料庫連接埠。

- Swagger：<http://localhost:8000/docs>
- OpenAPI：<http://localhost:8000/openapi.json>
- 健康檢查：<http://localhost:8000/health>（資料庫無法連線回傳 503）

`requirements.lock` 固定已測試的 Python 依賴版本，Docker 建置直接使用此檔。

資料庫帳密僅從環境變數／本機 `.env` 讀取；`.env` 不進版控或映像。請替換範例密碼。資料保存在 named volume，`docker compose down` 保留資料。

```sh
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.import_data
docker compose exec api pytest -q
```

測試使用真實 PostGIS，每個測試在外層 transaction 內執行，結束 rollback，候選點不會留下。建議使用獨立開發／測試資料庫，請勿對正式資料庫執行測試。

如需在主機執行 Python：

```sh
uv venv --python 3.12
source .venv/bin/activate
uv pip install -r requirements.lock
uv pip install --no-deps -e '.[test]'
docker compose up -d db
alembic upgrade head
python -m scripts.import_data
uvicorn app.main:app --reload
pytest -q
```

## 資料來源與品質

CSV 一律以 UTF-8-SIG 讀取，使用原有 UUID、`source_type`、`source_row`，另存 `source_file` 追溯實際匯入檔名。以 `(source_type, source_row)` 唯一鍵 upsert，重複執行會更新來源內容與 `updated_at`，保留既有 ID 與 `created_at`，不重複新增，不刪除來源消失的紀錄。兩份資料先驗證後於同一 transaction 匯入，失敗時整批 rollback。

**本次提供的兩個檔名與內容對調：**

| 實際檔案 | 實際內容 | 處理方式 |
| --- | --- | --- |
| existing_bins_all_taipei.csv | 681 筆獨立清潔箱，大安區 47 筆 | 匯入 trash_bins |
| daan_hotspot_gap_screening.csv | 130 筆全市景點聚合，大安區 18 筆 | 經欄位辨識，警告後匯入 hotspots |
| hotspots_all_taipei.csv | 18 筆大安區缺口分析，包含 proposal_status | 不匯入、不建立候選點 |

原檔保持不變。匯入器支援日後將檔名修正回預期名稱；正常情況直接從 `hotspots_all_taipei.csv` 匯入，僅在偵測到 screening schema 時使用上述替代來源。驗證全市 681/130 與大安區 47/18 筆數、來源唯一性、台北市行政區、有限值座標及非負 reported_count；資料集更新時需明確調整筆數驗證。

景點的 `reported_count` 是周邊清潔箱總數，**不展開成清潔箱座標**。景點只保存代表點與原始精度描述，缺口分析不被視為真實新增點位。候選點只由 API 人工建立，狀態為 `needs_field_validation`。

## API

```sh
curl 'http://localhost:8000/api/v1/bins'
curl 'http://localhost:8000/api/v1/hotspots?district=信義區'
curl 'http://localhost:8000/api/v1/candidates?district=大安區'
curl -X POST 'http://localhost:8000/api/v1/candidates' \
  -H 'Content-Type: application/json' \
  -d '{"name":"待現勘候選點","district":"大安區","longitude":121.543,"latitude":25.026,"note":"需現場確認"}'
```

GET 三個端點皆接受 `district`（台北市十二行政區之一，預設大安區），回傳 JSON 陣列，經緯度為 numeric。POST 成功回傳 201，無效參數回傳 422；座標必須為有限數值，經度 -180～180、緯度 -90～90。行政區為人工提供，尚未以行政區界多邊形驗證座標歸屬。

三張表的座標都是 `geography(Point,4326)` 並建立 GiST 空間索引。候選點回傳 `nearest_bin_distance_m`，透過 PostGIS `ST_Distance(geography, geography)`，以公尺計算到**全市現有清潔箱**的最短距離；無清潔箱時為 null。距離於每次 GET/POST 即時計算，不使用 CSV 缺口分析中預先計算的距離，不將景點納入清潔箱距離計算。時間欄位使用 PostgreSQL timestamptz，Docker 資料庫設定 UTC。

本階段按指定四個端點提供讀取與候選點建立，未加入更新、刪除、IoT、感測器模擬、推薦演算法或前端。


Agent 開發規範見 [AGENTS.md](../AGENTS.md)，完整領域與架構背景見 [PROJECT_CONTEXT.md](../docs/PROJECT_CONTEXT.md)。
