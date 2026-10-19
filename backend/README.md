# BinSoon Backend

Python 3.12、FastAPI、SQLAlchemy 2、PostgreSQL 16 / PostGIS、Alembic。

所有清潔箱和新增點統一為 **Bin**。資料來源及現勘狀態仍保留：`bin_type=existing` 為既有清潔箱，`proposed` 為新增待現勘點。所有 Bin 使用相同 ID、狀態及歷史 API。景點／商圈 `hotspots` 不是 bin。

## A／B／D 後端（2026-10-19 已部署）

本分支已提供登入、私有照片、地圖、回報／事件／工單、查證發點、會員／兌換、提案／投票／命名、認養、站內通知及成果統計。前端仍使用靜態快照與 localStorage，未修改也尚未串接。

- [實作順序、資料模型與驗收](docs/BACKEND_ROADMAP.md)
- [完整 API 契約、Request／Response、權限及前端欄位對照](docs/API_CONTRACT.md)
- [前端串接指南：可複製範例、畫面呼叫順序及錯誤處理](docs/FRONTEND_INTEGRATION.md)
- [API Reference：全部 endpoint 參數、DTO 必填／nullable／預設／enum](docs/API_REFERENCE.md)
- [API 全覽與舊入口整理：保留、維運與淘汰建議](docs/API_INVENTORY.md)
- [初始化、A→D 手動驗收、HTTP smoke 及 Cloud Run 準備](docs/PRODUCT_OPERATIONS.md)

本機與雲端 migration head 均為 0005；線上 revision 為 binsoon-api-00006-n96。展示登入程式預設關閉；既有 BinSoon 雲端展示環境已明確啟用並初始化三個角色與獎品，沒有初始贈點。CSV 初始化不會自動建立帳號。連線、測試與資源見 [部署紀錄](docs/DEPLOYMENT_STATUS.md)。

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
- 下表既有 POST 維持 Admin Bearer token；新增產品 API 使用個人 session／角色，詳見契約。

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

`/candidates` GET／POST 已移除（404）；市民新增點用 `/proposals`，維運直接建桶用POST `/bins`，建議點讀 `/bins?bin_type=proposed`。舊 `/demo/*` 亦已移除；讀取用 `/bins/*`，控制用 `/simulation/*`。目前契約為68 paths／70 operations。

完整操作與回應範例：[BINS.md](docs/BINS.md)。

## 資料與限制

- `existing_bins_all_taipei.csv`：681 筆既有清潔箱，大安區 47 筆；以 Bin.bin_type=existing 匯入。
- `daan_hotspot_gap_screening.csv`：實際為 130 筆景點聚合，大安區 18 筆；匯入 hotspots。
- `hotspots_all_taipei.csv`：實際為 18 筆缺口分析，不自動匯入。
- 後兩檔名對調，匯入器檢查欄位、警告並保留實際來源檔名。UTF-8-SIG 讀取，兩組資料同一 transaction upsert，保留 UUID、source_type/source_row/source_file，不刪除來源消失的資料。
- 所有 Bin 的滿度目前都是 simulated，包含真實既有清潔箱；沒有實測資料。預設容量 120 公升也是模擬設定，估計公升數不能當成實測垃圾量。
- 十點原始座標與排名不變，第 4、7 點屬中正區並保留警告。新增點須現勘，不代表已實際設置。維運直接建桶未檢查行政區邊界；市民提案用官方大安區多邊形驗證。
- 座標為 Geography(Point,4326)，UTC timestamptz。距離使用PostGIS ST_Distance；提案前周邊檢查用 `/map/availability`，包含已設置新增桶，不將場所當桶。

## 測試與遷移

```sh
docker compose exec api alembic upgrade head
docker compose exec api alembic check
docker compose exec api python -m scripts.import_data
docker compose exec api pytest -q
```

測試使用本機真實 PostGIS，外層 transaction rollback；產品／遷移／並行測試使用獨立 schema 並於結束清除該 schema，避免本機已有展示帳號影響測試。不得對雲端正式資料庫跑 pytest。新增圖片、multipart 與 GCS 依賴已同步固定於 requirements.lock。

**0003 已整併舊資料表，需新舊程式協調切換，不支援直接回滾到舊 schema。** 所有原始 UUID、追溯欄位、候選點與歷史讀值會保留；UUID 衝突或多個舊時鐘會停止遷移。備份後於維護窗口遷移，再啟動新 API。2026-10-19 已完成備份與維護切換並部署 0003；後續 schema 不相容變更仍不可當作無停機升級。

架構與領域定義：[PROJECT_CONTEXT.md](../docs/PROJECT_CONTEXT.md)。部署文件：[CLOUD_RUN.md](docs/CLOUD_RUN.md)、[MANUAL_DEPLOYMENT.md](docs/MANUAL_DEPLOYMENT.md)、[DEPLOYMENT_STATUS.md](docs/DEPLOYMENT_STATUS.md)。
