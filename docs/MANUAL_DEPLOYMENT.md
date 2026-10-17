# BinSoon 手動部署操作手冊

此手冊供下次自行部署使用。指令以 macOS 的 bash／zsh 為例，從 **BinSoon 儲存庫根目錄**執行；不用將資料庫密碼下載到本機。

現有環境已在 2026-10-18（台北時間）完成首次部署。日常更新從第一節開始，不要重建 Cloud SQL、DB user 或 Secret。實際資源與首次映像版本見 [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)。

## 一、日常更新：準備與測試

### 1. 取得程式

若這台電腦尚未下載儲存庫：

```sh
git clone git@github.com:mrwenwei/BinSoon.git
cd BinSoon
```

已有本機儲存庫時，進入該目錄即可（原開發電腦的目錄為 `/Users/wen/Documents/Codex/trashbin_soon`，不一定叫 BinSoon）。先確認分支與未提交變更：

```sh
git status
git branch --show-current
# 確認目前修改已保存，且準備部署 main 分支時才執行：
git switch main
git pull --ff-only
```

有尚未完成的本機修改時，先處理後再切換／更新分支。不要為了部署使用 git reset --hard 清除修改。

### 2. 確認必要工具

- Google Cloud CLI（gcloud）：登入與雲端建置／部署。
- Git：取得版本。
- Python 3：執行只使用標準函式庫的 HTTP 驗收。
- Docker Desktop：用於本機測試；映像在 Cloud Build 建置，本機不需要推送 Docker 映像。

```sh
gcloud version
python3 --version
docker compose version
```

若這台 macOS 的 gcloud 不在 PATH，可先執行以下指令，再用本手冊的 `$GCLOUD` 指令：

```sh
export GCLOUD=/opt/homebrew/share/google-cloud-sdk/bin/gcloud
```

其他電腦已能直接呼叫 gcloud 時：

```sh
export GCLOUD=gcloud
```

### 3. 本機回歸測試

```sh
cd backend
# 只有尚未存在 .env 時才建立，不覆寫既有帳密：
if [ ! -f .env ]; then cp .env.example .env; fi
# 首次請編輯 .env 設定本機密碼，該檔不提交 Git。
docker compose up --build -d --wait
docker compose exec api alembic check
docker compose exec api pytest -q
cd ..
```

目前基準是 13 項測試通過。CSV 檔名對調警告是已記錄的資料現況。測試使用本機 Compose 的 PostGIS，**不要將本機 .env 改成雲端資料庫設定來跑 pytest**。

若有資料表變更，先新增並驗證 Alembic revision。不要修改已部署的 migration，也不要只改 SQLAlchemy model 後直接上線。

### 4. 保存此次程式版本

確認檔案內容後，提交並推送準備發布的變更：

```sh
git status
# 以實際修改檔案取代下方路徑，避免加入不相關檔案：
git add backend/app backend/alembic backend/tests
# 有變更時才 commit，訊息依本次內容修改：
git commit -m 'Describe this release'
git push origin main
git status --short
```

部署以本機 backend/ 內容建置，不會自動從 GitHub 拉取來源。未提交檔案也可能被上傳，因此發布前應確認工作目錄乾淨，且 .env 被排除。

## 二、登入與載入現有部署設定

### 5. 登入可存取 binsoon 專案的 Google 帳號

```sh
"$GCLOUD" auth login
"$GCLOUD" auth list
"$GCLOUD" projects describe binsoon --format='value(projectId)'
```

本次部署使用的帳號為 `wen.chang.wlb@gmail.com`。未來可以用其他有適當權限的帳號，但不能只因 gcloud 目前選了其他專案就誤部署過去。以下指令全部明確指定 project。

若發生 invalid_grant，重新登入即可；不需要 gcloud auth application-default login，也不需要下載 service account JSON key。

### 6. 載入非機密設定

```sh
set -a
source backend/deploy/binsoon.env.example
set +a
```

這個已提交的範例檔實際保存既有環境名稱，可直接用於 binsoon 專案；**沒有 DB 密碼**。主要設定：

| 變數 | 現有值 |
| --- | --- |
| GCP_PROJECT_ID | binsoon |
| REGION | asia-east1 |
| SERVICE | binsoon-api |
| CLOUD_SQL_CONNECTION_NAME | binsoon:asia-east1:binsoon-db |
| POSTGRES_DB / POSTGRES_USER | binsoon / binsoon |
| DB_PASSWORD_SECRET / SECRET_VERSION | binsoon-db-password / 1 |
| PUBLIC_ACCESS | true（包含 POST 候選點） |

不要 source `backend/.env` 代替這份檔案：那是本機 Compose 的資料庫設定。

### 7. 確認既有資源可用

```sh
"$GCLOUD" sql instances describe "$CLOUD_SQL_INSTANCE" \
  --project="$GCP_PROJECT_ID" --format='value(state)'
"$GCLOUD" secrets versions describe "$SECRET_VERSION" \
  --secret="$DB_PASSWORD_SECRET" --project="$GCP_PROJECT_ID" --format='value(state)'
"$GCLOUD" run services describe "$SERVICE" --project="$GCP_PROJECT_ID" \
  --region="$REGION" --format='value(status.latestReadyRevisionName)'
```

預期依序看見 RUNNABLE、ENABLED、目前 revision 名稱。這些指令不讀出密碼。如果資料庫被手動暫停，要先確認費用與用途後恢復，不能直接重新建立同名資源。

## 三、執行部署：兩種方式擇一

### 方式 A：自己操作既有腳本（一般更新建議使用）

完成前面步驟後，在儲存庫根目錄執行：

```sh
bash backend/deploy/cloudrun.sh
```

腳本會依序「建置映像 → 解析 digest → 更新初始化 Job → 等待 migration／匯入完成 → 部署 API」。任一步失敗會停止，不要忽略錯誤繼續做下一步。

成功時會輸出 Cloud Run Service URL。接著跳到第四節驗收。

### 方式 B：完全手動逐步執行

這些指令等同腳本的主要流程，方便觀察、排錯或從中斷處繼續。**不要先執行方式 A 再無故重做方式 B。**

#### 8. 建立這次發布的映像名稱

```sh
RELEASE_TAG="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
IMAGE="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${REPOSITORY}/${SERVICE}:${RELEASE_TAG}"
JOB="${SERVICE}-initialize"
ENV_VARS="POSTGRES_HOST=/cloudsql/${CLOUD_SQL_CONNECTION_NAME},POSTGRES_PORT=5432,POSTGRES_USER=${POSTGRES_USER},POSTGRES_DB=${POSTGRES_DB}"
```

先記下目前 revision，供必要時回滾：

```sh
PREVIOUS_REVISION="$("$GCLOUD" run services describe "$SERVICE" \
  --project="$GCP_PROJECT_ID" --region="$REGION" \
  --format='value(status.latestReadyRevisionName)')"
printf '%s\n' "$PREVIOUS_REVISION"
```

這適用目前只有單一 revision 接收流量的部署。若未來使用流量分配，先查看 status.traffic 並記錄完整分配，不能只記 latestReadyRevisionName。

#### 9. Cloud Build 建置並推送映像

```sh
"$GCLOUD" builds submit backend --project="$GCP_PROJECT_ID" \
  --config=backend/deploy/cloudbuild.yaml \
  --service-account="projects/${GCP_PROJECT_ID}/serviceAccounts/${BUILD_SERVICE_ACCOUNT}" \
  --substitutions="_IMAGE=${IMAGE}"
```

等待建置 SUCCESS。Cloud Build 會建置 linux/amd64，適用 Cloud Run；本機 Apple Silicon 不用自行切換 Docker 平台。

backend/.gcloudignore 排除上傳來源中的 .env，.dockerignore 另排除 Docker context。修改這些檔案時要確認憑證仍被排除。

將 tag 解析為不可變 digest，確保 Job 與 API 使用同一映像：

```sh
DIGEST="$("$GCLOUD" artifacts docker images describe "$IMAGE" \
  --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')"
# 應輸出 sha256:...；若為空或查詢失敗，先停止排錯：
printf '%s\n' "$DIGEST"
IMAGE="${IMAGE%:*}@${DIGEST}"
```

#### 10. 更新初始化 Job

```sh
"$GCLOUD" run jobs deploy "$JOB" \
  --project="$GCP_PROJECT_ID" --region="$REGION" --image="$IMAGE" \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" \
  --set-cloudsql-instances="$CLOUD_SQL_CONNECTION_NAME" \
  --set-env-vars="$ENV_VARS" \
  --set-secrets="POSTGRES_PASSWORD=${DB_PASSWORD_SECRET}:${SECRET_VERSION}" \
  --command=python --args=-m,scripts.initialize_db \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=600s \
  --cpu=1 --memory=512Mi
```

這一步只部署 Job 定義，尚未執行 migration。

#### 11. 執行 migration 與匯入

```sh
"$GCLOUD" run jobs execute "$JOB" --project="$GCP_PROJECT_ID" \
  --region="$REGION" --wait
```

看到 execution successfully completed 才繼續。初始化會更新 schema、以 upsert 匯入 681／130 筆資料，不重複新增，不會把缺口分析轉成候選點。重跑會更新來源的 updated_at。

Migration 與匯入不是同一個 transaction。若匯入失敗，schema 可能已更新；查明原因後重跑 Job，不能認定資料庫完全沒有改變。HTTP 服務的每次冷啟動不會執行初始化。

#### 12. 部署公開 API

```sh
"$GCLOUD" run deploy "$SERVICE" \
  --project="$GCP_PROJECT_ID" --region="$REGION" --image="$IMAGE" \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" --execution-environment=gen2 \
  --add-cloudsql-instances="$CLOUD_SQL_CONNECTION_NAME" \
  --set-env-vars="$ENV_VARS" \
  --set-secrets="POSTGRES_PASSWORD=${DB_PASSWORD_SECRET}:${SECRET_VERSION}" \
  --port=8080 --cpu=1 --memory=512Mi --concurrency=8 \
  --min-instances=0 --max-instances=2 --timeout=60s \
  --allow-unauthenticated
```

這與本次已核准的公開展示設定一致，POST 也公開。若未來改成 IAM 私有服務，改用 --no-allow-unauthenticated，並採 IAM identity token 或本機代理驗收；本手冊的匿名 HTTP 檢查不適用私有服務。

--set-env-vars 與 --set-secrets 會替換相應設定集合。未來新增其他環境變數或 secrets 時，先同步更新部署腳本／ENV_VARS，避免部署時覆蓋遺漏。

## 四、驗收與記錄

### 13. 取得網址並驗收

```sh
SERVICE_URL="$("$GCLOUD" run services describe "$SERVICE" \
  --project="$GCP_PROJECT_ID" --region="$REGION" --format='value(status.url)')"
printf '%s\n' "$SERVICE_URL"
curl --fail --max-time 60 "$SERVICE_URL/health"
python3 backend/scripts/check_deployment.py "$SERVICE_URL"
```

預期檢查通過並輸出：

```json
{
  "health": "ok",
  "all_taipei": {"bins": 681, "hotspots": 130},
  "daan": {"bins": 47, "hotspots": 18}
}
```

瀏覽器開啟 `$SERVICE_URL/docs` 查看 Swagger。平常更新只做唯讀驗收；若確實要測試 POST，可執行以下指令，它會永久留下一筆有清楚標示的測試候選點：

```sh
python3 backend/scripts/check_deployment.py "$SERVICE_URL" --create-candidate
```

### 14. 保存此次發布結果

```sh
"$GCLOUD" run services describe "$SERVICE" --project="$GCP_PROJECT_ID" \
  --region="$REGION" --format='yaml(status.url,status.latestReadyRevisionName,status.traffic)'
"$GCLOUD" run jobs executions list --job="${SERVICE}-initialize" \
  --project="$GCP_PROJECT_ID" --region="$REGION" --limit=3
```

將日期、commit、映像 digest、新 revision、成功的初始化 execution、驗收結果補到部署紀錄，再提交文件。切勿記錄密碼、token 或 .env。

## 五、部署中斷、失敗與回滾

### 先看失敗在哪一步

| 階段 | 檢查與處理 |
| --- | --- |
| 登入 invalid_grant | 重新執行 `$GCLOUD auth login` |
| Cloud Build 失敗 | 查看該次 Build log，確認依賴、來源檔案、build account IAM；不要繼續部署 |
| 初始化 Job 失敗 | 查 execution 與 Job log，確認 Cloud SQL 狀態、Secret version、DB user 權限與 migration |
| API 啟動失敗／503 | 查看 revision log，檢查 PORT、Cloud SQL 掛載、DB 連線與 secretAccessor |
| API 403 | 檢查 public IAM 設定或呼叫者 run.invoker 權限 |
| 筆數不符 | 查 CSV schema／筆數與 importer log，不以建立假清潔箱補齊 |

查詢近期記錄：

```sh
"$GCLOUD" builds list --project="$GCP_PROJECT_ID" --limit=5
"$GCLOUD" run services logs read "$SERVICE" --project="$GCP_PROJECT_ID" \
  --region="$REGION" --limit=50
"$GCLOUD" logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="binsoon-api-initialize"' \
  --project="$GCP_PROJECT_ID" --limit=30 --format='value(textPayload)'
```

關閉終端或按 Ctrl+C 不一定取消雲端作業。下次先查 Build status、Job executions 與 Cloud SQL state；已有成功映像時，可手動從設定 IMAGE=digest 與第 10 步接續，不必重建資料庫或每次重新 build。

### 回滾 HTTP 服務

列出 revisions，選定確實已驗證的舊版本。此指令會立即改變對外流量：

```sh
"$GCLOUD" run revisions list --service="$SERVICE" \
  --project="$GCP_PROJECT_ID" --region="$REGION"
# 將下方名稱換成要回復的已驗證 revision：
ROLLBACK_REVISION=binsoon-api-00001-6df
"$GCLOUD" run services update-traffic "$SERVICE" \
  --project="$GCP_PROJECT_ID" --region="$REGION" \
  --to-revisions="${ROLLBACK_REVISION}=100"
python3 backend/scripts/check_deployment.py "$SERVICE_URL"
```

回滾流量**不會回滾資料庫 migration**。部署前須確保 schema 與舊 API 相容；不確定時先分析 migration，不能直接降版資料庫。之後再次 run deploy 通常會將流量移到新 revision，應重新驗收。

## 六、只有首次建立新環境才做的事

這次 binsoon 已建立完成，日常更新不用做本節。

新專案的順序為：

1. 登入、選擇 globally unique Project ID，建立 project。
2. 選擇 Billing Account 並連結，確認費用與建立權限。
3. 啟用 Run、SQL Admin、Artifact Registry、Cloud Build、Secret Manager、IAM APIs。
4. 建立 Artifact Registry、runtime／build service accounts 與相應 IAM。
5. 建立 Cloud SQL PostgreSQL 16、應用程式 database。
6. 建立空 Secret，授權 runtime secretAccessor。
7. 執行 `backend/deploy/create_db_credentials.py`，產生隨機密碼、建立 DB user 並存入 Secret Manager。
8. 使用新專案設定，從本手冊第 8 步建置、初始化、部署並驗收。

完整首次建置指令已列於 [CLOUD_RUN.md](CLOUD_RUN.md) 第 1～4 節。若換 Project ID，必須同步修改 service account email、connection name、registry 路徑與部署環境設定；不可只改 GCP_PROJECT_ID 就沿用其餘 binsoon 名稱。

Cloud SQL 會持續計費，Cloud Run min=0 不會停止資料庫費用。停止／刪除資源前先確認資料與備份；本手冊不會自動清理或刪除任何雲端資源。
