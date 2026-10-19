# BinSoon Cloud Run 部署紀錄

首次部署日期：2026-10-18；最新統一 Bin 部署日期：2026-10-19（Asia/Taipei）。此文件只記錄資源名稱與版本，不保存密碼或 token。

## 線上入口

- API：https://binsoon-api-887203439341.asia-east1.run.app
- Swagger：https://binsoon-api-887203439341.asia-east1.run.app/docs
- Health：https://binsoon-api-887203439341.asia-east1.run.app/health
- 大安區全部 Bin：https://binsoon-api-887203439341.asia-east1.run.app/api/v1/bins
- 大安區既有清潔箱：https://binsoon-api-887203439341.asia-east1.run.app/api/v1/bins?bin_type=existing
- 大安區景點：https://binsoon-api-887203439341.asia-east1.run.app/api/v1/hotspots

HTTP 服務公開存取；舊管理 POST 仍需維運 Admin token，新產品 API 使用市民／隊員／管理員 session。展示登入僅提供本專案示範，不是真實台北通或正式作業環境。以下各版細節為歷史紀錄，最新部署見文末 0005。

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

目前腳本選用 `--create-bin`，會永久建立一筆標示為部署驗收用的proposed Bin；預設不寫入。舊 `--create-candidate` 及 /candidates 路由已移除。以下0001至0005紀錄中的候選點驗收描述為當時版本行為。

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

## A／B／D 持久化展示後端（0005）：2026-10-19 已部署

使用者明確要求部署並自動核准。沿用 binsoon／asia-east1／binsoon-api 與既有 Cloud SQL 展示資料庫；沒有建立新 SQL instance，沒有清空既有資料、reset 模擬或執行正式 DB pytest。此環境目前只有展示／模擬桶況，不作真實城市派工用途。

| 項目 | 結果 |
| --- | --- |
| 正式 revision／流量 | `binsoon-api-00005-kcw`／100% |
| 上一版 | `binsoon-api-00004-lql` |
| Alembic head | `0005`（新增0004產品表及0005完整性約束） |
| Cloud Build | `35544a80-2fd2-434e-9b6c-77e32ba49d10`，SUCCESS |
| 映像 digest | `sha256:4d2b87d96e5b4c97269b2590c879c9a0a347524facc6ae2c9150a78af037becc` |
| 遷移前備份 | `1792389532929`，SUCCESSFUL；description=before-product-0005-20261019 |
| 初始化 execution | `binsoon-api-initialize-kw4l4`，成功；CSV bins=681／hotspots=130 |
| 帳號 seed execution | `binsoon-api-product-seed-2sgbz`，成功 |
| Cloud Run 規格 | 維持1 vCPU／512 MiB／concurrency=8／min=0／max=2／timeout=60s |
| 私有照片 bucket | `gs://binsoon-media-887203439341`，asia-east1／Standard／uniform access／public access prevention |
| 照片 IAM | runtime 僅在上述 bucket 具有 storage.objectAdmin；同一 runtime signing account 具有 serviceAccountTokenCreator，啟用 IAM Credentials API，無下載私鑰 |
| CORS origins | `http://localhost:5173`、`http://127.0.0.1:5173` |
| 新 Secret references | `binsoon-demo-citizen-password:1`、`binsoon-demo-staff-password:1`、`binsoon-demo-admin-password:1` |

新增bucket／Secret為本展示部署的一部分，按量計費；沒有改動Cloud SQL機型或Cloud Run常駐數。DB密碼與既有維運token不輪替。

這次0004／0005是向後相容新增表／欄位／索引／FK：先備份，以獨立初始化Job migration／CSV upsert，seed建立三個固定帳號及四個展示獎品，預備no-traffic revision，再明確切新版100%。**未贈初始點數、未建立seed虛構待辦**；後續HTTP驗收會保留明示測試案件，見下方。

來源是 main HEAD `3a24659` 之後尚未提交的後端快照，不宣稱該commit已包含功能。Build來源tar與逐檔SHA256、測試及驗收證據見 [release manifest](../deploy/releases/product-20261019.json)。文件擴充與測試隔離修正於建置後完成，不影響部署runtime程式；本機工作尚未commit／push。

### 前端交接

- [前端串接指南](FRONTEND_INTEGRATION.md)：URL、三角色登入、可複製TypeScript、照片、各畫面順序、cache／重試／ETag／錯誤處理。
- [API契約](API_CONTRACT.md)：權限、DTO語意、規則與P1–P22欄位對照。
- [完整API Reference](API_REFERENCE.md)：72個operation、88個schema，逐一列必填、nullable、預設、enum及限制。
- [線上Swagger](https://binsoon-api-887203439341.asia-east1.run.app/docs)／[線上OpenAPI](https://binsoon-api-887203439341.asia-east1.run.app/openapi.json)：已比對本分支快照一致（69 paths）。

展示帳號為 `demo-citizen`、`demo-staff`、`demo-admin`。密碼僅存Secret Manager，維運私下交付；本次本機交接副本在 `/tmp/binsoon-product-credentials.env`（0600），不提交、不放前端bundle。三帳號共用角色示範資料，不當成多人正式登入。此檔清除後可由具權限維運者從對應Secret version取回。重跑seed不輪替帳號密碼。

### 本次實際驗收

- 本機Docker真實PostGIS完整pytest：**74 passed、61 warnings、177.59秒**。產品測試使用獨立schema，不再依賴本機展示帳號未初始化；一般資料與帳密保留。
- health／Swagger／OpenAPI／地圖／Bin詳情／歷史正常；既有桶全市681／大安47，景點大安18。
- 三角色登入、me、會員／回報／提案／認養／通知／獎品、隊員工單／站點／統計可讀；登出撤銷生效，市民讀staff為403、匿名回報為401。
- 兩個允許origin的Authorization／Idempotency-Key／If-Match preflight正常。
- 真實私有GCS圖片上傳、IAM SignBlob短效下載HTTP200、匿名物件讀取拒絕、未掛案件的市民照片隊員不可讀（404）。留存一張孤兒驗收照片 `8933d5d2-f05e-4dbc-9d7c-0314b8323550`，可於24小時後由既有maintenance CLI處理。
- 明確以HTTP跑通 `check_product_demo --write-demo`：示範市民上傳照片及回報→隊員接單／到場→查證入帳→完工照→finish等待→管理員demo-clear→completed。永久保留明示「API展示驗收」案件及照片、合法查證台帳，不補造歷史基數。該桶留下simulated collection，其他桶未advance/reset。

前端本次完全未修改，尚未對接／實體手機驗證。真實IoT、台北通、SMS／LINE、正式兌換及薪資仍未提供。

### 下次重部署與回復

從根目錄使用**新版設定**，避免舊範例把展示登入關閉：

```sh
set -a
source backend/deploy/binsoon-product.env.example
set +a
export GCLOUD=/opt/homebrew/share/google-cloud-sdk/bin/gcloud
bash backend/deploy/cloudrun.sh
# 如果流量仍固定舊revision，確認新revision readiness及初始化成功後再切：
gcloud run services update-traffic binsoon-api --project=binsoon --region=asia-east1 --to-latest
```

不要每次建置重新建立bucket、密碼或贈點；新環境需先配置資源／IAM。展示seed需明確執行既有 `binsoon-api-product-seed` Job，其映像應隨版本更新；不掛冷啟動。

0004／0005與上一版程式相容，緊急可將流量切回00004以恢復舊Bin功能（新產品功能會消失，但資料表保留），不downgrade或刪除新產品表；DB還原需另規劃。舊版不得繼續用於已啟用真實感測／營運資料的環境。

## API入口清理：2026-10-19 已部署

依使用者確認，僅移除已deprecated的GET／POST `/api/v1/candidates`，現在均回404。市民新增點使用POST `/proposals`，維運直接建立使用POST `/bins`；其他六個舊資料／維運入口保留，詳見 [API全覽](API_INVENTORY.md)。同時刪除CandidateRead及專用距離／序列化helper，不刪任何Bin、來源、歷史或migration。

| 項目 | 結果 |
| --- | --- |
| 程式commit | `02520dfdadd09eefe8b906fd20be1d73aea1cea6` |
| 正式revision／流量 | `binsoon-api-00006-n96`／100% |
| 上一版 | `binsoon-api-00005-kcw` |
| Cloud Build | `5735c793-6add-4878-bc53-3ac6bca99e68`，SUCCESS |
| 映像digest | `sha256:273003d199aa141534654cef6ea5571908f100c95316828329d0ca7ddafc76a0` |
| 初始化execution | `binsoon-api-initialize-r8fqh`，成功；與HTTP使用同一digest |
| Schema | 維持0005，無新migration |
| 契約 | 68 paths／70 operations／87 schemas |
| 本機完整測試 | 74 passed／61 warnings／187.11秒 |

完整來源、映像與驗收metadata見 [release manifest](../deploy/releases/api-cleanup-20261019-02520df.json)。程式及前端交接文件已包含在上述commit，部署結果文件於線上驗收後另行commit。未push遠端。

部署沿用既有Cloud SQL、Secret references、三角色帳號、私有媒體bucket、CORS及1 vCPU／512 MiB／min=0／max=2規格；沒有重新seed帳號、建立資源、輪替密碼、推進／reset模擬、清空桶或新增案件。初始化Job仍冪等upsert CSV，updated_at可能刷新。

線上實際驗收：

- 匿名及admin session呼叫已移除GET／POST路由皆404，OpenAPI無candidates／CandidateRead，且與本分支快照完全一致。
- 部署前後692個Bin的ID集合、名稱、座標、行政區、類型、來源、設置狀態、推薦識別／排名／分數及current_usage逐筆一致；模擬時鐘完全一致，history可讀。
- 舊唯讀驗收腳本已更新並實際通過：官方全市bins／hotspots=681／130、大安區=47／18；預設不建立測試點。
- 三角色登入、me、會員／回報／認養／通知／提案／獎品、隊員工單／站點／統計、管理員認養清單正常；登出撤銷與市民不可讀staff檢查通過。
- 本機兩個origin的CORS preflight正常；重用前次明示照片驗證GCS短效下載200及匿名物件拒絕，沒有新增照片。
- 線上只新增並撤銷短效登入session及更新登入節流紀錄，沒有業務寫入；未對Cloud SQL跑pytest。前端完全未修改，實體手機與前端對接仍待驗證。

目前唯一的滿度歷史仍為 `/bins/{id}/history`；沒有另加demo history。所有滿度依舊為simulated，不代表實測IoT。緊急回復可切流量回00005（會暫時恢復舊candidates入口），不需downgrade DB。
