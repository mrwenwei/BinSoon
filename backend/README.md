# BinSoon Backend

Python 3.12、FastAPI、SQLAlchemy 2、PostgreSQL 16 / PostGIS、Alembic。

所有清潔箱和新增點統一為 **Bin**。資料來源及現勘狀態仍保留：`bin_type=existing` 為既有清潔箱，`proposed` 為新增待現勘點。所有 Bin 使用相同 ID、狀態及歷史 API。景點／商圈 `hotspots` 不是 bin。

## 本機啟動

在 backend/ 執行：

```sh
if [ ! -f .env ]; then cp .env.example .env; fi
# 設定資料庫帳密與私密 ADMIN_TOKEN；既有 DEMO_ADMIN_TOKEN 仍可沿用。
docker compose up --build -d --wait
```

啟動會等資料庫就緒、執行 migration 與冪等 CSV 匯入，為所有 Bin 建立尚缺的模擬狀態及初始歷史，再啟動 API。既有狀態不會被重設，資料保存在 named volume；不要執行 down -v。

- Swagger：http://localhost:8000/docs
- 健康檢查：http://localhost:8000/health
- 所有 POST 需 Admin Bearer token，未設定時寫入關閉。

## API

| Method | 路徑 | 用途 |
| --- | --- | --- |
| GET | /api/v1/bins | 既有與新增 Bin，含目前滿度 |
| POST | /api/v1/bins | 新增 proposed Bin，立即具有初始狀態與歷史 |
| GET | /api/v1/bins/{id} | 依 ID 查點位與目前使用量 |
| GET | /api/v1/bins/{id}/history | 查滿度及清運歷史，支援時間、來源、generation、分頁 |
| POST | /api/v1/bins/{id}/collect | 模擬清運，滿度歸零並留下事件 |
| GET | /api/v1/bins/collection-priorities | 依滿度排序的優先清單 |
| GET | /api/v1/hotspots | 景點／商圈列表 |
| GET | /api/v1/simulation/status | 共用模擬時鐘 |
| POST | /api/v1/simulation/seed | 冪等匯入十個既有分析推薦點，初始化尚缺狀態 |
| POST | /api/v1/simulation/advance | 推進所有 Bin 的模擬時間 |
| POST | /api/v1/simulation/pause、resume、reset | 暫停、恢復、開始新一輪模擬 |

列表預設大安區；`district=all` 查全市，`bin_type=existing` 僅查既有清潔箱，`bin_type=proposed` 僅查新增點。`format=geojson` 取得 FeatureCollection，座標為 [longitude, latitude]。

```sh
curl 'http://localhost:8000/api/v1/bins'
curl 'http://localhost:8000/api/v1/bins?district=all&format=geojson'
curl 'http://localhost:8000/api/v1/bins?bin_type=existing'
curl 'http://localhost:8000/api/v1/bins/replace-with-bin-id/history?limit=100'
```

`/candidates` GET/POST 暫時保留原回應格式並標示 deprecated，實際讀寫同一張 bins；POST 現在也需 Admin token。舊 `/demo/*` 已移除；讀取改用 `/bins/*`，控制改用 `/simulation/*`。

完整操作與回應範例：[BINS.md](docs/BINS.md)。

## 資料與限制

- `existing_bins_all_taipei.csv`：681 筆既有清潔箱，大安區 47 筆；以 Bin.bin_type=existing 匯入。
- `daan_hotspot_gap_screening.csv`：實際為 130 筆景點聚合，大安區 18 筆；匯入 hotspots。
- `hotspots_all_taipei.csv`：實際為 18 筆缺口分析，不自動匯入。
- 後兩檔名對調，匯入器檢查欄位、警告並保留實際來源檔名。UTF-8-SIG 讀取，兩組資料同一 transaction upsert，保留 UUID、source_type/source_row/source_file，不刪除來源消失的資料。
- 所有 Bin 的滿度目前都是 simulated，包含真實既有清潔箱；沒有實測資料。預設容量 120 公升也是模擬設定，估計公升數不能當成實測垃圾量。
- 十點原始座標與排名不變，第 4、7 點屬中正區並保留警告。新增點須現勘，不代表已實際設置。一般人工點位尚未檢查行政區邊界。
- 座標為 Geography(Point,4326)，UTC timestamptz。舊 candidates 最近距離仍只對全市 existing Bin 計算 ST_Distance，無既有點時為 null。

## 測試與遷移

```sh
docker compose exec api alembic upgrade head
docker compose exec api alembic check
docker compose exec api python -m scripts.import_data
docker compose exec api pytest -q
```

測試使用本機真實 PostGIS，外層 transaction rollback；遷移／並行測試使用獨立 schema 並於結束清除該 schema。不得對雲端正式資料庫跑 pytest。requirements.lock 與依賴未變動。

**0003 已整併舊資料表，需新舊程式協調切換，不支援直接回滾到舊 schema。** 所有原始 UUID、追溯欄位、候選點與歷史讀值會保留；UUID 衝突或多個舊時鐘會停止遷移。備份後於維護窗口遷移，再啟動新 API。2026-10-19 已完成備份與維護切換並部署 0003；後續 schema 不相容變更仍不可當作無停機升級。

架構與領域定義：[PROJECT_CONTEXT.md](../docs/PROJECT_CONTEXT.md)。部署文件：[CLOUD_RUN.md](docs/CLOUD_RUN.md)、[MANUAL_DEPLOYMENT.md](docs/MANUAL_DEPLOYMENT.md)、[DEPLOYMENT_STATUS.md](docs/DEPLOYMENT_STATUS.md)。
