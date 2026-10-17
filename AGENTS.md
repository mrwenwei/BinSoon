# BinSoon：Agent 開發指引

本文件適用整個儲存庫。開始工作前先閱讀 `docs/PROJECT_CONTEXT.md`，後端任務再閱讀 `backend/README.md` 與對應程式。以實際程式與原始 CSV 欄位驗證假設，勿只根據檔名推斷資料語意。

## 儲存庫邊界

- `backend/` 包含後端程式、資料、migration、測試、Docker 設定與環境變數範例。
- `frontend/` 預留給後續前端，目前不存在；未有需求時不要建立前端或指定框架。
- `docs/PROJECT_CONTEXT.md` 保存領域定義、資料限制、架構與驗收條件。
- 後端指令的工作目錄為 `backend/`。若從根目錄執行 Compose，使用 `docker compose -f backend/compose.yaml --env-file backend/.env ...`。

## 必須維持的領域規則

1. `trash_bins` 是具有獨立座標的既有清潔箱；`hotspots` 是景點／商圈代表點；`candidate_locations` 是待現勘候選新增點，三者不能混用。
2. 景點 `reported_count` 是周邊清潔箱數量，不代表個別清潔箱位置，不能展開成清潔箱。
3. 缺口分析只作參考，不得自動匯入候選點或當成已存在的清潔箱。
4. 本批 CSV 的兩個檔名與內容對調，詳見專案背景。不得刪除來源追溯欄位或默默改寫原始資料。
5. 所有空間點使用 PostGIS `Geography(Point,4326)`，順序為 longitude、latitude。API 使用 JSON numeric 經緯度，距離為公尺。
6. 最近清潔箱距離使用 `ST_Distance`，對全市 `trash_bins` 計算；不以景點或候選點代替清潔箱。沒有既有清潔箱時回傳 null。
7. 保留 `source_type`、`source_row`、`source_file`。CSV 以 UTF-8-SIG 讀取，匯入保持 idempotent 與 transaction 原子性。
8. 時間使用 timezone-aware UTC，資料庫使用 timestamptz。
9. 帳密只能從環境變數取得，禁止提交 `.env`、金鑰、token 或真實憑證。

## 技術與變更規範

- Python 3.12、FastAPI、PostgreSQL 16 + PostGIS、SQLAlchemy 2.0、Alembic、Pydantic v2、psycopg 3、Docker Compose、pytest。
- Schema 變更須新增 Alembic revision，不以 `create_all()` 取代 migration，不改寫已部署的 revision。
- `requirements.lock` 固定 Docker 使用的依賴；更新 `pyproject.toml` 時同步檢查鎖定版本。
- 請求驗證放在 Pydantic schemas，資料存取使用 SQLAlchemy；SQL 參數不得用使用者輸入字串拼接。
- 座標必須驗證範圍與有限值。行政區支援十二區，GET 預設大安區。
- 目前只實作指定的 GET 列表與 POST 候選點；更新、刪除需有明確需求後再加。
- 不自行擴充 IoT、感測器模擬、推薦演算法、前端、Redis、Kafka、Celery 或微服務。
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

基本驗收：全市清潔箱 681 筆、景點 130 筆；預設大安區 bins 47 筆、hotspots 18 筆；重複匯入筆數不變；POST 候選點後 GET 可查到；候選點不增加清潔箱筆數；距離與座標驗證正確。

測試使用真實 PostGIS，各測試有外層 transaction 並於結束 rollback，仍應使用本機開發或獨立測試資料庫。不得擅自對正式資料庫測試、清空資料或執行 `docker compose down -v`。

Compose 專案名稱固定為 `trashbin_soon`，以沿用初版開發環境的資料卷。未來若更名，須規劃資料卷遷移，避免誤以為資料消失。

完成工作時回報改動、已執行的測試、尚未驗證的部分與資料限制。推送時保留遠端歷史，不 force push。
