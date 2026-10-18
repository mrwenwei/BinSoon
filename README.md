# BinSoon

台北丟垃圾變順。台北市智慧垃圾桶黑客松 MVP，目前以大安區為主要分析範圍，資料庫支援全台北市。

此儲存庫採 monorepo 結構：後端位於 `backend/`，前端位於 `frontend/`（React＋TypeScript＋Vite 地圖與 A flow 展示）。

## 產品需求與流程文件

PM 提供的 **PRD、Web flow、手機 App flow 與新增 User flow** 統一收錄於 [產品需求與使用者流程](docs/PRODUCT_REQUIREMENTS.md)，供所有可存取本儲存庫的讀者查閱。外部文件仍受 Claude 分享權限限制，目前尚未驗證匿名存取。

## 前端地圖與 A flow 展示

組員請先安裝 Git、Node.js 24（含 npm），從 `main` 取得前端：

```sh
git clone --branch main https://github.com/mrwenwei/BinSoon.git
cd BinSoon/frontend
npm ci
npm run build
npm run preview
```

開啟 [本機預覽](http://127.0.0.1:4173/)（以終端機輸出的 Local URL 為準），保持終端機執行，按 `Ctrl+C` 停止。請透過此網址查看，不要直接雙擊 `dist/index.html`。只看前端不需 Docker、後端、資料庫、帳號或 `.env`。

已下載專案的組員，先保存／處理本機改動，再從儲存庫根目錄更新：

```sh
git switch main
git pull --ff-only origin main
cd frontend
npm ci
npm run build
npm run preview
```

開發時在 `frontend/` 執行 `npm run dev`，預設 [開發網址](http://127.0.0.1:5173/) 支援修改後自動更新。Node 版本、常見錯誤與完整操作見 [前端 README](frontend/README.md)。

前端以靜態快照展示 681 筆公布桶位置＋130 筆場所代表點，合稱 811 筆位置紀錄。可篩選台北十二區、查看地圖位置與來源精度，無需後端、Docker、資料庫、Vercel 帳號或 `.env`；底圖需要網路與 WebGL。

已完成 A flow 展示：桶詳情、模擬登入、回報、掃碼集章與點數兌換，支援桌面及手機。新增資料明確標示為示意並儲存於本瀏覽器；不連接真實感測器、登入或派工。完整範圍見 [A flow 規格](docs/A_FLOW.md)。

詳細開發、驗證與 Vercel Root Directory 設定見 [frontend/README.md](frontend/README.md)；目前需求見 [A flow 規格](docs/A_FLOW.md)，初版來源見 [前端 V0 規格（歷史）](docs/FRONTEND_V0.md)。

## 後端快速啟動

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
├── frontend/                 # React＋TypeScript＋Vite，獨立 build／預覽
│   ├── README.md             # 組員本機操作與示範流程
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── package-lock.json
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

目前範圍為資料初始化、清潔箱／景點／候選點查詢、候選點建立與最近清潔箱距離。未實作 IoT、模擬感測器、推薦演算法。

Cloud Run 部署架構、建立 GCP 專案與詳細操作見 [部署指南](docs/CLOUD_RUN.md)。

已部署的公開 API 與資源版本見 [部署紀錄](docs/DEPLOYMENT_STATUS.md)。

下次自行更新部署，請依 [手動部署操作手冊](docs/MANUAL_DEPLOYMENT.md) 逐步執行，包含腳本與完全手動兩種方式。
