# BinSoon Cloud Run 部署紀錄

首次部署日期：2026-10-18；最新統一 Bin 部署日期：2026-10-19（Asia/Taipei）。此文件只記錄資源名稱與版本，不保存密碼或 token。

## 線上入口

- API：https://binsoon-api-887203439341.asia-east1.run.app
- Swagger：https://binsoon-api-887203439341.asia-east1.run.app/docs
- Health：https://binsoon-api-887203439341.asia-east1.run.app/health
- 大安區全部 Bin：https://binsoon-api-887203439341.asia-east1.run.app/api/v1/bins
- 大安區既有清潔箱：https://binsoon-api-887203439341.asia-east1.run.app/api/v1/bins?bin_type=existing
- 大安區景點：https://binsoon-api-887203439341.asia-east1.run.app/api/v1/hotspots

HTTP 服務公開存取；目前統一 Bin 版本所有 POST 均需 Admin Bearer token。初版匿名 POST 的紀錄僅描述當時設定。

## 首次部署資源（最新版本見下方 0003 紀錄）

| 項目 | 設定 |
| --- | --- |
| GCP Project ID / Number | binsoon / 887203439341 |
| 區域 | asia-east1（台灣） |
| Cloud Run Service | binsoon-api |
| 初次 revision | binsoon-api-00001-6df，首次部署時為 100% 流量 |
| Cloud Run 設定 | 1 vCPU、512 MiB、min=0、max=2、concurrency=8、request timeout=60s |
| Cloud SQL | binsoon-db、PostgreSQL 16、Enterprise、db-f1-micro、10 GB SSD、ZONAL |
| Cloud SQL connection name | binsoon:asia-east1:binsoon-db |
| Database / user | binsoon / binsoon |
| Secret Manager | binsoon-db-password，部署固定使用 version 1 |
| Artifact Registry | asia-east1-docker.pkg.dev/binsoon/binsoon |
| API / Job 執行身分 | binsoon-api@binsoon.iam.gserviceaccount.com |
| Build 執行身分 | binsoon-build@binsoon.iam.gserviceaccount.com |
| 初始化 Job | binsoon-api-initialize |
| 首次成功初始化 execution | binsoon-api-initialize-k4hvk |
| Cloud Build ID | 17fcd598-cd6c-46f9-a871-df4d10967555 |
| 映像來源 commit / tag | 1beee29 |
| 部署映像 digest | sha256:a0b3d837243a898cbd99fb25f4bfb0a21e03f9d5fca0df3ea8e9c81c80976bee |

首次部署完整映像：

```text
asia-east1-docker.pkg.dev/binsoon/binsoon/binsoon-api@sha256:a0b3d837243a898cbd99fb25f4bfb0a21e03f9d5fca0df3ea8e9c81c80976bee
```

應用程式只連線到 Cloud SQL 的 Unix socket。DB 密碼保存在 Secret Manager，未寫入本文件、Git、一般環境設定或映像。

## 重新部署

從儲存庫根目錄執行，已安裝並登入 gcloud：

```sh
set -a
source backend/deploy/binsoon.env.example
set +a
bash backend/deploy/cloudrun.sh
```

macOS 若 gcloud 未在 PATH，可先設定：

```sh
export GCLOUD=/opt/homebrew/share/google-cloud-sdk/bin/gcloud
```

這會重新建置目前 backend 來源，執行初始化 Job，成功後部署新 API revision。先將程式變更提交，讓映像 tag 可追溯到 commit。

secret version 固定為 1；未來輪替密碼時，先確保 DB 密碼與 Secret 版本一致，再明確更新 SECRET_VERSION。不要因重部署重新執行資源建立步驟或覆寫現有帳密。

## 驗收與觀察

初始化 Job 已成功，記錄顯示匯入 trash_bins=681、hotspots=130。HTTP smoke check 已通過，結果記錄於此文件末尾。

重跑唯讀檢查（從儲存庫根目錄，使用 Python 3 標準函式庫，不需啟動本機 Docker）：

```sh
python3 backend/scripts/check_deployment.py \
  https://binsoon-api-887203439341.asia-east1.run.app
```

若加上 --create-candidate，會永久建立一筆標示為部署驗收用的候選點。一般重複驗收不要加此旗標。

更多操作、logs、回滾與費用管理見 [CLOUD_RUN.md](CLOUD_RUN.md)。Cloud SQL 在沒有 API 流量時仍會計費；未設定支出硬上限，也未自動停止或刪除資源。

## 首次部署 HTTP 驗收結果（0001）

- /health 回傳 200、status=ok；Swagger 與 OpenAPI 可存取。
- 十二行政區加總：trash_bins=681、hotspots=130。
- GET 預設大安區：bins=47、hotspots=18，經緯度為 JSON numeric。
- POST 候選點回傳 201，GET 候選點可查到，清潔箱筆數不變。
- 驗收點設於一筆既有清潔箱的相同座標，最近距離小於 0.001 公尺。
- 留存的測試候選點 ID：`47461090-0063-4b54-882e-3fd2aa4c7d1f`。
- 測試點名稱：`部署驗收候選點（非實際提案）`，不應用於真實選址決策。

本機容器直接對外的驗收連線曾未完成；已停止該程序，改由主機 Python 執行完成。Cloud Run 服務本身的健康與公開 HTTP 存取均正常。

下次更新的完整逐步指令、驗收與回滾見 [MANUAL_DEPLOYMENT.md](MANUAL_DEPLOYMENT.md)。

## 2026-10-19：第一階段 Demo 上線

- 當次 revision：`binsoon-api-00002-nzl`，當次接收 100% 流量；前一版為 `binsoon-api-00001-6df`。
- 映像 tag：`phase1-20261018160236-b4326ae15523`。
- 映像 digest：`sha256:d4e66235a6fe8d19d35e4889e67988f9fa291da561ce90a4703eb962698300c0`。
- Cloud Build：`7b995811-22ec-4a20-b71f-9bdeffeb5222`，SUCCESS。
- 初始化 execution：`binsoon-api-initialize-ts2zz`，成功；套用 Alembic 0002 與 CSV upsert，仍為清潔箱 681、景點 130。
- Demo Secret reference：`binsoon-demo-admin-token:1`，runtime 僅獲授該 secret 的 secretAccessor；token 沿用本機私密 `.env`，不保存於此。
- 規格維持 1 vCPU、512 MiB、min=0、max=2、concurrency=8，沿用既有 Cloud SQL，未新建資料庫。

來源為基於 `12b7e07f90add4a9f5b5576420d9f0949f113d37` 的未提交本機快照，不代表該 commit 已包含 Demo。依 `.gcloudignore` 篩選的 47 個來源檔案以 SHA256 manifest 識別，總雜湊 `b4326ae15523b3929e5388c8167c6a3f3b730dd96543719feb27e3e5ab9996ed`，`.env` 已排除。完整版本、檔案雜湊及驗收紀錄見 [release manifest](../deploy/releases/phase1-20261018160236-b4326ae15523.json)。未執行 Git commit 或 push。

### 驗收結果

- 本機：28 項 pytest 通過，Alembic check 無差異；未對 Cloud SQL 跑 pytest。
- 線上：health、Swagger、OpenAPI 正常；全市 bins/hotspots=681/130，大安區=47/18。
- 十點已透過管理 seed 匯入；重跑不重複；GeoJSON 順序正確；第 4、7 點保留中正區警告。
- Demo seed、reset、pause、resume、advance、collect 的未授權呼叫均為 401。
- 已實際推進 60 模擬分鐘、重送相同 request ID 確認不重算，清運歸零並留下 collection 事件，最後 reset 回復十點 0%。
- 驗收後狀態：`running`、`generation=1`、`seed=42`、`simulated_at=2026-01-05T00:00:00Z`。這是模擬時鐘，非真實監測時間；日後操作請以 GET status 取得當前 generation。

舊版 Demo 地圖資料（新版已移除）：[GET /api/v1/demo/bins](https://binsoon-api-887203439341.asia-east1.run.app/api/v1/demo/bins)；操作仍需 Swagger Authorize 的 Admin token。

## 統一 Bin refactor（0003）：2026-10-19 已部署

統一模型與狀態／歷史 API 已發布，使用 `/bins` 與 `/simulation`。

- 正式 revision：`binsoon-api-00004-lql`，100% 流量；舊版 `binsoon-api-00002-nzl`。
- 維護 revision：`binsoon-api-00003-5zc`，僅在切換期間回傳 503，現已無正式流量。
- Cloud SQL 遷移前按需備份：`1792342693302`，SUCCESSFUL；先阻擋新請求、排空舊請求至少 61 秒後建立。
- Cloud Build：`b8ad975a-b6d3-4e41-85a4-58cf3f2fa136`，SUCCESS。
- 映像 digest：`sha256:8edf51d2d67737824e98c4fe8827c51c132697d24f6a535eb97e1800049985fa`，維護、正式及初始化使用同一 digest。
- 初始化 execution：`binsoon-api-initialize-vs5dq`，成功套用 0003 與 CSV upsert。
- 規格維持 1 vCPU、512 MiB、min=0、max=2、concurrency=8，使用既有 Cloud SQL。Admin secret 沿用 `binsoon-demo-admin-token:1`，以 ADMIN_TOKEN 注入；未輪替或顯示 token。
- 來源為基於 `12b7e07f90add4a9f5b5576420d9f0949f113d37` 的未提交快照，SHA256 `f2355a324de3dd29278ac48ab3be247c4023cd8e828fe0a9c81c8ceffd322e9b`；不是聲稱該 commit 已包含目前程式。`.env` 排除，完整檔案雜湊與操作結果見 [release manifest](../deploy/releases/unified-20261018165305-f2355a324de3.json)。

線上驗收：692 個 Bin，包含 681 個既有與 11 個新增（十個推薦點與既存驗收點）；全部有滿度。原始 IDs、來源欄位、舊滿度、歷史讀值 IDs 及模擬時間/generation 均比對保留。既有與新增 Bin 都能以同一 ID 查 /bins/{id} 與 /history，GeoJSON、清運優先列表正常；未授權 POST 為 401，帶 Admin token 的冪等 seed 成功且不變更既有狀態。/demo 路由已移除。

本機 36 項測試通過，未在 Cloud SQL 執行 pytest。唯讀 HTTP 驗收仍為官方全市 bins/hotspots=681/130、大安區=47/18（Bin 使用 bin_type=existing 篩選）。未對新模擬時間做 advance/reset，避免改動既有讀值；切換前模擬時間及 generation 保留。

新 [Swagger](https://binsoon-api-887203439341.asia-east1.run.app/docs)、[全市 Bin](https://binsoon-api-887203439341.asia-east1.run.app/api/v1/bins?district=all)、[模擬狀態](https://binsoon-api-887203439341.asia-east1.run.app/api/v1/simulation/status)。
