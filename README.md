# BinSoon

台北丟垃圾變順。台北市智慧垃圾桶黑客松 MVP，目前以大安區為主要分析範圍，資料庫支援全台北市。

此儲存庫採 monorepo 結構：後端位於 `backend/`，未來前端將放在 `frontend/`（目前尚未建立）。

## 快速啟動

需先安裝 Docker Desktop 與 Docker Compose。

```sh
cd backend
cp .env.example .env
# 編輯 .env 設定本機資料庫帳密
docker compose up --build
```

啟動時依序等待 PostgreSQL / PostGIS 就緒、執行 Alembic migration、匯入 CSV，再啟動 API。

- Swagger：<http://localhost:8000/docs>
- 健康檢查：<http://localhost:8000/health>
- 測試：在 `backend/` 執行 `docker compose exec api pytest -q`

## 專案導覽

```text
BinSoon/
├── AGENTS.md                 # Agent 開發規範與閱讀入口
├── README.md                 # 專案入口
├── docs/
│   └── PROJECT_CONTEXT.md    # 詳細領域、資料語意、架構與驗收條件
└── backend/
    ├── README.md            # 後端啟動、API 與資料操作
    ├── app/                 # FastAPI、設定、模型、schemas、API
    ├── alembic/             # Migration
    ├── scripts/             # CSV 匯入 CLI
    ├── tests/               # PostGIS 整合測試
    ├── data/                # 原始 CSV
    ├── compose.yaml
    ├── Dockerfile
    ├── pyproject.toml
    ├── requirements.lock
    └── .env.example
```

開發前請閱讀 [AGENTS.md](AGENTS.md) 與 [專案詳細背景](docs/PROJECT_CONTEXT.md)。後端操作詳見 [backend/README.md](backend/README.md)。

目前範圍為資料初始化、清潔箱／景點／候選點查詢、候選點建立與最近清潔箱距離。未實作 IoT、模擬感測器、推薦演算法或前端。

Cloud Run 部署架構、建立 GCP 專案與詳細操作見 [部署指南](docs/CLOUD_RUN.md)。
