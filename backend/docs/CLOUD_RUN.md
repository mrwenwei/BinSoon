# BinSoon：Google Cloud Run 部署與操作

> 2026-10-19 A／B／D後端及0004／0005已部署至既有展示服務 binsoon-api-00006-n96，私有GCS與三角色登入已驗證。重部署請用 [binsoon-product.env.example](../deploy/binsoon-product.env.example) 保留Secret reference／媒體／CORS設定；完整結果見 [部署紀錄](DEPLOYMENT_STATUS.md) 最新章節。展示登入不能接到真實作業環境。以下初版／0003內容為歷史與資源建立說明。

> 統一 Bin（0003）已於 2026-10-19 完成備份、維護與雲端切換，版本見 [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)。0003 整併表結構，需備份、停止舊寫入並協調程式切換；不能直接以原流程宣稱無停機升級，也不能只回滾舊映像。新 API、權限、官方筆數篩選與歷史行為見 [BINS.md](BINS.md)。

本文件的終端指令從儲存庫根目錄開始。專案 ID、Billing Account 與資料庫實際建立結果，以部署完成後的紀錄為準；以下名稱是可重現的預設方案，尚未表示雲端資源已建立。

## 架構與範圍

- Cloud Run Service `binsoon-api`：FastAPI HTTP API，依 PORT 環境變數監聽，HTTPS 由 Cloud Run 終止。
- Cloud Run Job `binsoon-api-initialize`：在每次部署前執行 Alembic 與 CSV 匯入，成功後才部署服務。
- Cloud SQL PostgreSQL 16：持久化資料，Alembic 建立 PostGIS extension。
- Artifact Registry `binsoon`：保存 linux/amd64 容器映像。
- Cloud Build：建置後端映像，不需要從本機 Apple Silicon 推送 arm64 映像。
- Secret Manager：保存資料庫密碼，以 secret reference 注入容器，密碼不寫進 Git、Dockerfile 或一般環境變數設定檔。
- 獨立 service accounts：`binsoon-api` 負責執行 API／初始化，`binsoon-build` 負責建置映像。

MVP 預設部署區域為台灣 `asia-east1`。Cloud Run 使用 1 vCPU、512 MiB、min instances 0、max instances 2、concurrency 8。每個 instance 的 SQLAlchemy pool 最多 2 條連線，初始化 Job 另最多 2 條。這些是節制的初始設定，並非成本硬上限。

建議新資料庫使用 Cloud SQL Enterprise、PostgreSQL 16、db-f1-micro、10 GB SSD、單區域非 HA，供黑客松使用。Cloud SQL 不會跟隨 Cloud Run 自動縮到零，持續計費；另有儲存、備份、映像、建置、網路與 Secret Manager 費用。建立前需確認 Billing Account 與可接受費用，並參考當下區域報價。小型 shared-core 不作正式環境可用性承諾。

## 1. 登入與選擇專案

```sh
gcloud auth login
gcloud auth list
gcloud billing accounts list
```

macOS 若 gcloud 未在 PATH，可使用 `/opt/homebrew/share/google-cloud-sdk/bin/gcloud`，或將該 SDK 的 bin 加入 PATH。登入需要使用者在瀏覽器選擇帳號，不要把 token／驗證碼寫進專案文件。

以下非機密設定由操作者依實際資源填入：

```sh
export GCP_PROJECT_ID=YOUR_GLOBALLY_UNIQUE_PROJECT_ID
export BILLING_ACCOUNT_ID=YOUR_BILLING_ACCOUNT_ID
export REGION=asia-east1
export CLOUD_SQL_INSTANCE=binsoon-db
export CLOUD_SQL_CONNECTION_NAME="$GCP_PROJECT_ID:$REGION:$CLOUD_SQL_INSTANCE"
export POSTGRES_USER=binsoon
export POSTGRES_DB=binsoon
export DB_PASSWORD_SECRET=binsoon-db-password
export RUNTIME_SERVICE_ACCOUNT="binsoon-api@$GCP_PROJECT_ID.iam.gserviceaccount.com"
export BUILD_SERVICE_ACCOUNT="binsoon-build@$GCP_PROJECT_ID.iam.gserviceaccount.com"
export REPOSITORY=binsoon
export PUBLIC_ACCESS=false
```

建立全新專案；已有專案時略過 create。若帳號受組織政策管理，需依實際權限指定 organization 或 folder，不能推測父層資源。

```sh
gcloud projects create "$GCP_PROJECT_ID" --name=BinSoon
gcloud billing projects link "$GCP_PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com \
  --project="$GCP_PROJECT_ID"
```

不用修改使用者原有的全域 gcloud project；後續指令都明確傳入 --project。

## 2. 建立映像儲存庫與身分

```sh
gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker \
  --location="$REGION" --project="$GCP_PROJECT_ID"
gcloud iam service-accounts create binsoon-api --display-name='BinSoon runtime' \
  --project="$GCP_PROJECT_ID"
gcloud iam service-accounts create binsoon-build --display-name='BinSoon build' \
  --project="$GCP_PROJECT_ID"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT" --role=roles/cloudsql.client
gcloud artifacts repositories add-iam-policy-binding "$REPOSITORY" \
  --location="$REGION" --project="$GCP_PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" --role=roles/artifactregistry.writer
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" --role=roles/logging.logWriter
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" --role=roles/storage.objectViewer
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" --role=roles/serviceusage.serviceUsageConsumer
```

build account 的 Storage Viewer 用於讀取 Cloud Build 的來源封存；新專案只用於本服務。若重用有其他敏感儲存桶的專案，應改成來源 bucket 層級 IAM。

執行部署的人需要建立／執行 build、部署 Cloud Run、使用上述 service accounts（iam.serviceAccounts.actAs）等權限。不要為了排錯直接授予 runtime account Owner 或 Editor。

## 3. 建立 Cloud SQL PostgreSQL 16

確認費用後才執行。範例採 public IP + Cloud SQL Auth Proxy Unix socket，不設定對外 authorized networks，不讓資料庫直接接受任意網際網路客戶端。API 與 Job 的 --set/add-cloudsql-instances 建立代理連線，執行帳號需 roles/cloudsql.client。

```sh
gcloud sql instances create "$CLOUD_SQL_INSTANCE" --project="$GCP_PROJECT_ID" \
  --database-version=POSTGRES_16 --edition=ENTERPRISE \
  --tier=db-f1-micro --region="$REGION" --availability-type=ZONAL \
  --storage-type=SSD --storage-size=10 --assign-ip \
  --backup-start-time=19:00 --retained-backups-count=3 \
  --no-enable-point-in-time-recovery

gcloud sql databases create "$POSTGRES_DB" --instance="$CLOUD_SQL_INSTANCE" \
  --project="$GCP_PROJECT_ID"
```

建立可能需要數分鐘。PostGIS extension 由初始化 Job 的 migration 建立；初始化 DB user 必須具備建立該 extension 的權限。MVP 共用 Cloud SQL 內建 DB user 執行 migration 與 API；後續正式部署可拆開 migration 與 runtime 的資料庫角色。

使用安全本機程式或終端隱藏輸入來產生／輸入密碼，將相同密碼設定到 Cloud SQL user 與 Secret Manager。不要將密碼當作聊天內容或寫在 shell 指令歷史中。雲端建立時可透過 stdin 或受限暫存檔傳遞 Secret Manager 值；不在此提供明碼密碼範例。

```sh
# 以下 secret create 不帶 value，之後以安全方式新增 secret version。
gcloud secrets create "$DB_PASSWORD_SECRET" --replication-policy=automatic \
  --project="$GCP_PROJECT_ID"
gcloud secrets add-iam-policy-binding "$DB_PASSWORD_SECRET" \
  --project="$GCP_PROJECT_ID" --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT" \
  --role=roles/secretmanager.secretAccessor
```

使用內附程式安全建立初始帳密（只用 Python 標準函式庫，密碼不經 argv 或輸出）：

```sh
python3 backend/deploy/create_db_credentials.py
```

此程式用目前 gcloud 身分呼叫 SQL Admin API 建立 DB user，並將隨機密碼透過 stdin 存進 Secret Manager。若 DB user 與可用 secret version 都已存在，就不覆寫；若只有一邊存在會停止，需先檢查部分完成的狀態。它不作密碼輪替，也不保證既有兩個資源的密碼相符。

部署前必須已建立 POSTGRES_USER，並已將密碼存成 secret version。可用 `gcloud sql users list` 及 `gcloud secrets versions list` 確認名稱／版本，無須讀出密碼。

## 4. 建置、初始化、部署

確認前述 export 的環境變數仍在當前終端：

```sh
bash backend/deploy/cloudrun.sh
```

腳本會：

1. 從 backend/ 上傳來源，以 Cloud Build 建置 linux/amd64 映像。
2. 將映像 tag 解析為 immutable digest。
3. 用同一 digest 建立／更新單 task 的初始化 Job。
4. 等待 `python -m scripts.initialize_db` 完成；失敗就停止，不部署新 API。
5. 將服務部署到 Cloud Run，連接 Cloud SQL，注入 Secret Manager 密碼，輸出服務 URL。

初始化程式使用 PostgreSQL advisory lock，序列化透過此入口執行的 migration／匯入，避免多個初始化 Job 同時修改 schema。Migration 與匯入各自提交；若匯入失敗，migration 可能已完成，修正資料後可重跑。這個鎖不保護直接繞過入口執行的 alembic 或 importer 指令。

本機 Docker Compose 仍會先初始化再啟動，Cloud Run 的 API 容器只負責啟動 HTTP，不會在每次冷啟動匯入資料。

Cloud Build 上傳範圍受 backend/.gcloudignore 控制；Docker build 另受 .dockerignore 控制，兩者都排除 .env 與本機快取。不得移除這些排除項目。

## 5. 存取與驗收

預設 PUBLIC_ACCESS=false，只有具 Cloud Run Invoker 的 IAM 身分可呼叫。開放展示需先明確設定 `PUBLIC_ACCESS=true`；統一 Bin 版的 GET 可公開，所有 POST 另需 ADMIN_TOKEN；目前尚無完整使用者角色管理。

```sh
export SERVICE_URL="$(gcloud run services describe binsoon-api \
  --project="$GCP_PROJECT_ID" --region="$REGION" --format='value(status.url)')"
# IAM 私有服務的本機瀏覽器代理
gcloud run services proxy binsoon-api --project="$GCP_PROJECT_ID" --region="$REGION" --port=8080
```

透過本機代理開啟 http://localhost:8080/docs。CLI 驗收亦可在程式內取得 identity token 並置入 Authorization header；不要將 token 印在報告或聊天中。

驗收 /health、/docs、/openapi.json；大安區 bins 應為 47、hotspots 為 18。建立候選點後 GET 應可查到，該測試點會永久存在雲端資料庫；應清楚命名為部署驗收候選點並記錄 ID，不能將其混入清潔箱。

不要對雲端正式資料庫直接執行 pytest。pytest 使用本機 Compose PostGIS 即可；雲端使用明確的 HTTP smoke checks。本輪GET／POST /candidates已移除（404），驗收腳本已改用Bin並預設不寫入；選用建立測試點旗標為 `--create-bin`。

## 6. 日常操作與排錯

```sh
# 查看服務與最近記錄
gcloud run services describe binsoon-api --project="$GCP_PROJECT_ID" --region="$REGION"
gcloud run services logs read binsoon-api --project="$GCP_PROJECT_ID" --region="$REGION" --limit=50
# 查看初始化執行記錄
gcloud run jobs executions list --job=binsoon-api-initialize \
  --project="$GCP_PROJECT_ID" --region="$REGION"
# 如需手動重跑（先確認映像版本）
gcloud run jobs execute binsoon-api-initialize --wait \
  --project="$GCP_PROJECT_ID" --region="$REGION"
```

- invalid_grant：重新執行 gcloud auth login。
- 服務 403：檢查是否私有、呼叫者是否有 run.invoker，以及 identity token 是否正確。
- Secret 拒絕存取：確認 runtime account 在該 secret 上有 secretAccessor。
- DB 連線失敗：核對 instance connection name、附掛設定、Cloud SQL Client IAM、DB user、密碼版本與 instance 狀態。
- migration 失敗：查看初始化 Job log，不反覆啟動 HTTP 服務嘗試修復。
- 初始化失敗後服務仍可能使用前一個 revision；新 schema migration 必須維持舊 API 的相容性。

回滾 Cloud Run revision 只回滾應用程式映像，不自動回滾資料庫 migration。正式 schema 改動需另有相容性／備份計畫。

## 7. 黑客松結束後的費用管理

Cloud Run min=0 可在沒有流量時縮到零，但 Cloud SQL 仍計費。可設定 Billing 預算通知（通知不是硬性支出上限）。停止或刪除資料庫會影響服務，刪除前應先匯出所需候選點與資料備份；不要自動執行清理或刪除專案。

若只是暫停，可在確認影響後將 Cloud SQL activation policy 設為 NEVER；儲存與備份可能仍計費。再次啟用後確認 /health。所有停止、刪除與清理都應明確選定資源後操作。

## 官方參考

- [Cloud Run 容器規格與 PORT](https://docs.cloud.google.com/run/docs/container-contract)
- [Cloud Run 連接 Cloud SQL PostgreSQL](https://docs.cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud SQL PostgreSQL extensions / PostGIS](https://docs.cloud.google.com/sql/docs/postgres/extensions)
- [Cloud SQL 建立 PostgreSQL instance](https://docs.cloud.google.com/sql/docs/postgres/create-instance)
- [Cloud SQL 費用](https://cloud.google.com/sql/pricing)

## 已部署環境

目前 BinSoon 的實際資源、服務 URL、驗收結果與可重用設定見 [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)。

唯讀 HTTP 驗收也可直接從儲存庫根目錄執行，不需額外 Python 套件：

```sh
python3 backend/scripts/check_deployment.py https://binsoon-api-887203439341.asia-east1.run.app
```

日常更新部署與完全手動指令見 [MANUAL_DEPLOYMENT.md](MANUAL_DEPLOYMENT.md)。

## 第一階段 Demo（選用）

見 [DEMO.md](DEMO.md)。新版 migration 新增獨立 Demo 模擬資料，不影響官方清潔箱，初始化 Job 不自動 seed Demo。`deploy/cloudrun.sh` 可用 `ADMIN_SECRET` 與 `ADMIN_SECRET_VERSION` 指定 Admin token 的 Secret Manager reference；需事先建立 secret 並授權 runtime secretAccessor。未設定時 Demo POST 關閉，不能將 token 寫入一般 env 範例或前端 bundle。部署腳本用 --set-secrets 替換設定，重部署時需保留選用 secret 變數。2026-10-19 已發布至既有 Cloud Run 環境，最新版本與驗收結果見 [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)。

## 不相容 schema 的維護入口

`app.maintenance:app` 為本次 0003 切換新增的部署入口，所有 HTTP 路徑均回 503 / Retry-After，且不載入 DB。先以 no-traffic 預備維護與正式 revision，再切維護、排空舊請求、完成 Cloud SQL 備份、執行初始化 Job、切正式並做 HTTP 驗收。不能直接在舊 API 仍處理寫入時整併表。完整實際流程見 [手動部署手冊](MANUAL_DEPLOYMENT.md) 最後一節；普通相容版本仍可沿用既有腳本。
