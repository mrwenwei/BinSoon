# BinSoon：Agent 開發指引

本文件適用整個儲存庫。開始工作前先閱讀 `docs/PROJECT_CONTEXT.md`，後端任務再閱讀 `backend/README.md` 與對應程式。以實際程式與原始 CSV 欄位驗證假設，勿只根據檔名推斷資料語意。

## 儲存庫邊界

- `backend/` 包含後端程式、資料、migration、測試、Docker 設定、環境變數範例與 `backend/docs/` 部署文件。
- `frontend/` 是 React＋TypeScript＋Vite 地圖 V0，獨立開發與建置；前端工作另讀 `frontend/AGENTS.md`。
- `docs/PROJECT_CONTEXT.md` 保存領域定義、資料限制、架構與驗收條件。
- 後端指令的工作目錄為 `backend/`。若從根目錄執行 Compose，使用 `docker compose -f backend/compose.yaml --env-file backend/.env ...`。

## 必須維持的領域規則

1. 使用者已要求既有與新增點統一為 `Bin / bins`，以 `bin_type=existing/proposed` 區分；新增點不是另一套 Candidate 模型。proposed 仍須現勘，不冒充已設置；hotspots 為景點代表點，不是 Bin。
2. 景點 `reported_count` 是周邊清潔箱數量，不代表個別清潔箱位置，不能展開成清潔箱。
3. 缺口分析只作參考，不得自動匯入候選點或當成已存在的清潔箱。
4. 本批 CSV 的兩個檔名與內容對調，詳見專案背景。不得刪除來源追溯欄位或默默改寫原始資料。
5. 所有空間點使用 PostGIS `Geography(Point,4326)`，順序為 longitude、latitude。API 使用 JSON numeric 經緯度，距離為公尺。
6. 最近清潔箱距離使用 `ST_Distance`，對全市 `bins` 中 `bin_type=existing` 計算；不以景點或候選點代替清潔箱。沒有既有清潔箱時回傳 null。
7. 保留 `source_type`、`source_row`、`source_file`。CSV 以 UTF-8-SIG 讀取，匯入保持 idempotent 與 transaction 原子性。
8. 時間使用 timezone-aware UTC，資料庫使用 timestamptz。
9. 帳密只能從環境變數取得，禁止提交 `.env`、金鑰、token 或真實憑證。

## 技術與變更規範

- Python 3.12、FastAPI、PostgreSQL 16 + PostGIS、SQLAlchemy 2.0、Alembic、Pydantic v2、psycopg 3、Docker Compose、pytest。
- Schema 變更須新增 Alembic revision，不以 `create_all()` 取代 migration，不改寫已部署的 revision。
- `requirements.lock` 固定 Docker 使用的依賴；更新 `pyproject.toml` 時同步檢查鎖定版本。
- 請求驗證放在 Pydantic schemas，資料存取使用 SQLAlchemy；SQL 參數不得用使用者輸入字串拼接。
- 座標必須驗證範圍與有限值。行政區支援十二區，GET 預設大安區。
- 使用統一 `/bins` 列表、POST、單點、歷史與清運；舊 `/candidates` 為 deprecated 相容入口。GET /bins 已改為包含新增點，官方筆數需 bin_type=existing；所有 POST 需 Admin。一般點位更新、刪除仍需明確需求。
- 已核准所有既有與新增 Bin 共用模擬狀態與歷史，控制在 /simulation，詳見 `backend/docs/BINS.md`；不自行擴充 IoT 硬體通訊、選址最佳化演算法、前端、Redis、Kafka、Celery 或微服務。
- 修改契約、資料假設或啟動流程時同步更新文件。

## 標準驗證流程

在 `backend/` 執行：

```sh
# 首次先從 .env.example 建立 .env，已有 .env 時不要覆寫
docker compose up --build -d --wait
docker compose exec api alembic upgrade head
docker compose exec api alembic check
docker compose exec api python -m scripts.import_data
docker compose exec api pytest -q
```

基本驗收：bin_type=existing 篩選全市 681 筆、大安區 47 筆；景點全市 130／大安區 18；總 Bin 數包含新增點。重複匯入不重複，POST Bin 後同 ID 可查目前滿度及歷史；proposed 不增加 existing 筆數；reset 保留舊歷史，距離與座標正確。

測試使用真實 PostGIS，各測試有外層 transaction 並於結束 rollback，仍應使用本機開發或獨立測試資料庫。不得擅自對正式資料庫測試、清空資料或執行 `docker compose down -v`。

Compose 專案名稱固定為 `trashbin_soon`，以沿用初版開發環境的資料卷。未來若更名，須規劃資料卷遷移，避免誤以為資料消失。

完成工作時回報改動、已執行的測試、尚未驗證的部分與資料限制。推送時保留遠端歷史，不 force push。

## Cloud Run

部署操作先讀 `backend/docs/CLOUD_RUN.md`。Cloud Run API 容器依 PORT 啟動，不在冷啟動時執行 migration／匯入；使用獨立初始化 Job。Secret Manager 保存 DB 密碼，.gcloudignore 與 .dockerignore 排除本機 .env。付費資源建立需先確定專案、Billing 與規格，不能把文件中的預設名稱當成已建立的資源。

使用者自行部署的逐步操作手冊為 `backend/docs/MANUAL_DEPLOYMENT.md`；更動部署流程時，需同步檢查手冊、腳本與環境設定範例的一致性。

0003 將已部署的兩套點位與讀值表整併；上雲端需先備份並協調 schema／程式切換，不可假設可無停機部署或直接降回 0002。2026-10-19 已以備份與維護窗口完成雲端切換，詳見部署紀錄。
