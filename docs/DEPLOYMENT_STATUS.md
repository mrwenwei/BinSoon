# BinSoon Cloud Run 部署紀錄

部署日期：2026-10-18（Asia/Taipei）。此文件只記錄資源名稱與版本，不保存密碼或 token。

## 線上入口

- API：https://binsoon-api-887203439341.asia-east1.run.app
- Swagger：https://binsoon-api-887203439341.asia-east1.run.app/docs
- Health：https://binsoon-api-887203439341.asia-east1.run.app/health
- 大安區清潔箱：https://binsoon-api-887203439341.asia-east1.run.app/api/v1/bins
- 大安區景點：https://binsoon-api-887203439341.asia-east1.run.app/api/v1/hotspots

依使用者確認，API 公開存取，包含 POST 候選點。

## 實際資源

| 項目 | 設定 |
| --- | --- |
| GCP Project ID / Number | binsoon / 887203439341 |
| 區域 | asia-east1（台灣） |
| Cloud Run Service | binsoon-api |
| 初次 revision | binsoon-api-00001-6df，100% 流量 |
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

完整映像：

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

## 最終 HTTP 驗收結果

- /health 回傳 200、status=ok；Swagger 與 OpenAPI 可存取。
- 十二行政區加總：trash_bins=681、hotspots=130。
- GET 預設大安區：bins=47、hotspots=18，經緯度為 JSON numeric。
- POST 候選點回傳 201，GET 候選點可查到，清潔箱筆數不變。
- 驗收點設於一筆既有清潔箱的相同座標，最近距離小於 0.001 公尺。
- 留存的測試候選點 ID：`47461090-0063-4b54-882e-3fd2aa4c7d1f`。
- 測試點名稱：`部署驗收候選點（非實際提案）`，不應用於真實選址決策。

本機容器直接對外的驗收連線曾未完成；已停止該程序，改由主機 Python 執行完成。Cloud Run 服務本身的健康與公開 HTTP 存取均正常。

下次更新的完整逐步指令、驗收與回滾見 [MANUAL_DEPLOYMENT.md](MANUAL_DEPLOYMENT.md)。
