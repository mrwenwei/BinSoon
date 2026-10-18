# BinSoon

台北市智慧垃圾桶 MVP。後端統一使用 **Bin** 管理既有清潔箱與新增點，以同一個 ID 查詢目前滿度及歷史；proposed 標記保留待現勘意義。所有滿度目前是模擬資料，沒有實測感測器。

```text
backend/
├── app/
│   ├── api.py                 # Bin、歷史、清運與景點 API
│   ├── simulation_api.py      # 共用模擬控制
│   ├── models.py / schemas.py # 統一 Bin、目前狀態與歷史
│   ├── security.py            # Admin Bearer token
│   └── services/              # bins.py、simulation.py
├── alembic/                   # 含 0003 統一資料遷移
├── scripts/                   # 初始化、CSV、圖資與 HTTP 驗收
├── data/                      # 原始 CSV、十點分析與區界
├── tests/                     # 真實 PostGIS、遷移與並行測試
├── deploy/                    # Cloud Run／Build 設定與版本紀錄
└── docs/                      # 操作及部署手冊
```

本機啟動：

```sh
cd backend
if [ ! -f .env ]; then cp .env.example .env; fi
# 設定本機帳密與 ADMIN_TOKEN；舊 DEMO_ADMIN_TOKEN 仍相容。
docker compose up --build -d --wait
```

開啟 http://localhost:8000/docs 。主要 API：

- GET/POST `/api/v1/bins`
- GET `/api/v1/bins/{id}`、`/api/v1/bins/{id}/history`
- POST `/api/v1/bins/{id}/collect`
- GET `/api/v1/bins/collection-priorities`
- GET `/api/v1/simulation/status` 與管理用模擬控制

`GET /bins` 預設包含大安區既有與新增點；`bin_type=existing` 才是官方既有筆數（全市 681／大安區 47）。`district=all` 查全市，`format=geojson` 提供地圖資料。hotspots 全市 130／大安區 18，與 Bin 分開。

[目前進度](docs/PROGRESS.md)・[後端 README](backend/README.md)・[統一 Bin 操作與遷移手冊](backend/docs/BINS.md)・[專案背景](docs/PROJECT_CONTEXT.md)・[Agent 指引](AGENTS.md)

統一 Bin（0003）已於 2026-10-19 完成備份與協調切換，部署至 Cloud Run；部署驗收時 692 個 Bin 均可查目前滿度與歷史。線上：[Swagger](https://binsoon-api-887203439341.asia-east1.run.app/docs)、[部署紀錄](backend/docs/DEPLOYMENT_STATUS.md)。
