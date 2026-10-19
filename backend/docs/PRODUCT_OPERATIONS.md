# A／B／D 後端初始化、驗收及交接

2026-10-19。持久化展示 API 已部署 Cloud Run，schema=0005、revision=binsoon-api-00006-n96；frontend 完全未修改。私有 GCS 與 Secret references 已配置，三角色已初始化。線上只做明示 HTTP 展示驗收，未對 Cloud SQL 執行 pytest。完整紀錄見 [部署紀錄](DEPLOYMENT_STATUS.md)。

前端先看 [串接指南](FRONTEND_INTEGRATION.md)，全部欄位、權限、錯誤、P1–P22 對照見 [API 契約](API_CONTRACT.md) 與 [逐項參考](API_REFERENCE.md)。Swagger `/docs` 與 `/openapi.json` 以目前啟動版本為準，線上已更新新版。

前端也可直接使用 [OpenAPI JSON](openapi.json) 產生client／型別。變更schema後在backend/執行 `python -m scripts.export_openapi`；pytest會檢查快照同步。

## 1. 本機初始化

在 `backend/` 執行；已有 `.env` 不覆寫。準備獨立展示資料庫，不讓展示登入接觸真實作業資料。

```sh
docker compose up --build -d --wait
docker compose exec api alembic upgrade head
docker compose exec api alembic check
docker compose exec api python -m scripts.import_data
docker compose exec api pytest -q
```

0004 新增產品資料表及 nullable 觀測／生命週期欄位；0005 新增讀值索引及首報 FK。原始 Bin UUID、681 筆既有位置、130 筆場所與歷史 ID 保留。舊 API 的預設回應及 Admin token 不變；新增市民／隊員功能使用個人 session。

在 `.env` 設定以下項目，再重建／重建容器使環境生效（密碼為私密輸入，不提交 Git、不放 VITE_*）：

```dotenv
DEMO_AUTH_ENABLED=true
DEMO_CITIZEN_PASSWORD=<自行產生，至少12字元>
DEMO_STAFF_PASSWORD=<另一組私密密碼，至少12字元>
DEMO_ADMIN_PASSWORD=<另一組管理密碼，至少12字元>
CORS_ORIGINS=["http://127.0.0.1:5173","http://localhost:5173"]
```

```sh
docker compose up -d --force-recreate api
# 建立帳號與獎品；重跑不重設密碼、餘額或庫存。
docker compose exec api python -m scripts.seed_product_demo
# 選用：初始63點以一筆 demo_grant 明列，及三張虛構待辦。
docker compose exec api python -m scripts.seed_product_demo --grant-points 63 --with-work-orders
```

帳號固定 `demo-citizen`、`demo-staff`、`demo-admin`，密碼來自對應環境變數。預設新會員 0 點，不補造 48 次歷史回報。seed 不讀／覆寫 frontend localStorage。贈點只能初始化一次，同一筆贈點換金額會拒絕，不提供任意加點 API。

`--with-work-orders` 建立 sensor 滿桶、inspection 髒污、inspection 待修繕各一張，標示 is_fixture=true；沒有虛構已完成成果、其他市民的照片、回報獎勵或薪資。重跑不重開已結案的 seed。十個模型推薦點仍由原 `/simulation/seed` 管理，不自動投票或設置。

## 2. API 使用方式

登入 body：

```json
{"account":"demo-citizen","password":"<你的展示帳號密碼>"}
```

`POST /api/v1/auth/demo/login` 回 `{access_token,token_type,expires_at,user}`。把 token 填入 Swagger Authorize；有效 60 分鐘，`DELETE /api/v1/auth/session` 即時登出；不需要也不能把共享 Admin token 當市民登入。

所有新 POST／PATCH 命令（登入及媒體上傳除外）帶 `Idempotency-Key: <UUID>`，同一次操作重送保留原 key／body。工單、審查、認養更新需帶 GET 最新資源取得的 `If-Match: "vN"`；命令回應含新 ETag。412 先更新資料再確認，不盲目重送。Swagger 的 OpenAPI 已列出 headers。

初始化與 GET 不建立會員帳本或測試案件。照片使用 multipart file＋purpose；單張最多 5 MiB／2000 萬像素，JPEG／PNG／WebP 會正規化為移除 metadata 的 JPEG。multipart 必須有 Content-Length（一般瀏覽器 FormData 自動提供）；檔案／表單總請求最多 6 MiB。回報與完工照片不可用 boolean 取代。

## 3. 手動走 A → D → A

1. 市民：`GET /api/v1/map/locations` 選大安區已設置桶；`GET /bins/{id}/view` 及既有 `GET /bins/{id}/history` 查看狀態、歷史。以下省略 `/api/v1`。
2. `POST /media`，purpose=report，取得 media ID。
3. `POST /reports`，body 含 bin_id、type、description、photo_ids、position、quick=false。選桶座標可作明示展示位置；後端驗證 <=50m，但不能把 client 座標當成防偽 GPS。
4. 保存回傳 report.id、event_id、work_order_id。三者不同；同一事件的自己重送回 200 既有案，另一位市民可有另一筆回報。
5. 登入隊員：GET 工單及 ETag，依序 POST accept、arrive（每步使用新 ETag）。
6. 對每筆回報 POST review，approved 或 rejected；拒絕須有原因。approved 首報立即入帳 +1／+2，後報 0。此時工單仍可未完成。
7. 到場後上傳 purpose=completion 的照片，再掛 `/staff/work-orders/{id}/evidence`，POST finish。
8. full 若無新清空，回 waiting_sensor。登入管理員，GET `/admin/work-orders/{id}` 取 ETag，再 POST `/admin/work-orders/{id}/demo-clear`，body `{reading_id:UUID}`。
9. 清空與照片可先後到達；條件齊備只產生一次完成成果。dirty／dumping／other 不靠桶內清空結案，broken 需修繕證據，dismiss 需現況照及原因且不計件。
10. 市民讀案件、membership、point-entries；對最新有效 Completion 按讚。隊員 statistics 計件一次，route-stops 不再含已完成工單。

原 `/bins/{id}/collect` 只是模擬歸零，不構成工單證據；simulation reset 不能清空會員帳務、回報、工單、認養或補造清空證據。工作時間採真實 UTC，模擬歷史的 recorded_at 採模擬時鐘；勿互相比較。

## 4. B flow 驗收

- 提案：讀 quota → POST proposals → GET 詳情 → POST vote（support／oppose／null）。新案同時建立 proposed Bin 及自己的支持票。
- 台北曆月最多三案，60 人／60% 門檻由唯一投票rows算，沒有任意灌aggregate票數的API。單一帳號展示可明確執行以下固定虛構情境；不可宣稱為真實市民票數。
- 管理員依 village／evaluation／survey 合法狀態 review，decline 須原因。示範設置保留 is_demo=true，Bin 保留 proposed 來源並更新 placement_status=installed。
- 原提案者送命名、管理員審核；新名待審時保留上次 approved_name。
- 認養：POST adoptions → 管理員 review active → 我的認養／偏好／月報；待審無權益，也不永久保留桶。同桶最多一個 active。
- 快捷回報仍用 POST reports，quick=true 且須 active 認養；提交時的資格快照不因後續結束而追扣。撤除會結束認養並保留歷史。

與目前 frontend 的兩個刻意差異：後端用實際大安區圖資驗證新提案，不沿用矩形 demoBounds；示範設置成功時會更新關聯 Bin，不再只是 localStorage 成果卡。前端負責人在對接時需依 API 契約調整資料層，本輪沒有修改其行為。

建立自己的新提案後，若只有原提案者一張支持票，可選一種固定情境：

```sh
docker compose exec api python -m scripts.seed_product_votes --proposal-id REPLACE_WITH_PROPOSAL_UUID --profile evaluation
# 或以另一個新案展示里長確認分支：--profile village
```

此CLI僅在DEMO_AUTH_ENABLED=true可用，建立59個不可登入、明確命名的虛構投票者及唯一票，依同一投票service推進門檻：evaluation=36支持／24反對，village=35／25。重跑相同情境不重複；有其他票或已處理的案件不覆寫。不建立會員點數，不影響十個模型推薦點，不提供公開造票endpoint。

## 5. 自動 HTTP 驗收

```sh
# 預設唯讀，不登入、不建立案件。
docker compose exec api python -m scripts.check_product_demo http://127.0.0.1:8000
# 僅對獨立展示環境明確執行寫入；永久保存示範案件／照片／點數。
docker compose exec api python -m scripts.check_product_demo http://127.0.0.1:8000 --write-demo
```

腳本從環境／本機 .env 讀展示帳密，不輸出密碼或 token；有其他尚未查證回報時停止，避免驗收程式代審他人案件。本分支測試另以真實 HTTP server＋獨立 schema 實際執行上述兩種模式，不對正式 DB 執行。

## 6. 媒體與維護

Compose 使用新增 named volume `media_data` 保存照片，原 postgres_data 不變。不執行 down -v。本機純 Python 可設定 MEDIA_DIRECTORY 為私有持久化目錄，預設 /tmp 只適合測試。

```sh
# 預設只列數量，不刪除；只處理24小時以前未掛案件的照片。
docker compose exec api python -m scripts.product_maintenance
# 明確確認後才清理孤兒及過期登入／冪等紀錄；不刪回報、台帳或成果。
docker compose exec api python -m scripts.product_maintenance --apply
```

保留至少30天冪等回應、過期session再保留7天、登入嘗試1天；業務唯一約束長期保留。照片資產由服務產生 binsoon- 前綴；bucket 必須專供本服務，維護不得拿別的服務 bucket 測試。這是按需 CLI，沒有 Celery／常駐排程。

## 7. Cloud Run 部署設定（已執行，以下亦供新環境準備）

- 0004／0005 已經獨立初始化 Job 套用，遷移前備份成功。此次為向後相容新增欄位／表，先migration與seed，再切換新版流量；不在 HTTP 冷啟動執行。
- 部署腳本預設 DEMO_AUTH_ENABLED=false，既有 service 重新部署不會自動開展示登入／seed。展示應使用獨立 service／database。
- Cloud Run 媒體需 MEDIA_BACKEND=gcs、私有 MEDIA_BUCKET、MEDIA_SIGNING_SERVICE_ACCOUNT；腳本會使用 gcs。未配置bucket時照片API回503，不使用容器本機磁碟冒充持久化。
- runtime account 需要限定 bucket 的物件寫入／讀取／刪除權限，及指定 signing account 的 iam.serviceAccounts.signBlob；使用 ADC＋IAM 簽名，不下載私鑰。現有私有bucket為 binsoon-media-887203439341，已完成真實GCS上傳／短效下載／禁止匿名讀取驗證。
- 展示密碼透過 DEMO_CITIZEN_PASSWORD_SECRET／DEMO_STAFF_PASSWORD_SECRET／DEMO_ADMIN_PASSWORD_SECRET 及 *_PASSWORD_SECRET_VERSION 指定 Secret Manager 名稱，不能傳明碼。此名稱與維運 ADMIN_SECRET 分開；舊 DEMO_ADMIN_SECRET 只保留為維運 token reference 的相容別名，不能作登入密碼 reference。
- CORS_ORIGINS 是 JSON array；部署腳本使用自訂分隔符，保留多網域 JSON 中的逗號。新的 Secret 設定需保留，避免 --set-secrets 覆寫掉既有項目。
- 初始Job只跑migration／CSV；展示帳號、贈點、工單另以受控 Job 執行 seed_product_demo，不在公開 HTTP 提供seed帳號／加點。

官方儲存參考：[簽名 URL](https://docs.cloud.google.com/storage/docs/access-control/signing-urls-with-helpers)、[Python Blob](https://docs.cloud.google.com/python/docs/reference/storage/latest/google.cloud.storage.blob.Blob)、[Pillow 圖片驗證與限制](https://pillow.readthedocs.io/en/stable/reference/Image.html)。

## 8. 已知界線

- 全部目前滿度仍為 simulated。IoT 只預留來源、雙時間、序列與任務關聯，不實作裝置 ingestion 或硬體校正。
- 新產品寫入以 PostgreSQL 全域 advisory transaction lock 序列化，適合目前展示負載；不是高併發正式派工架構。模擬使用原有獨立鎖，產品→模擬鎖序固定。
- 位置搜尋與桶況篩選為目前約811筆資料的批次讀取／記憶體篩選；地圖避免逐點SQL，但尚未做大規模地圖分塊／游標查詢。
- 月榜按完成件數並列，不發薪資；沒有跨隊轉派、多人搶單產品流程、翻案、追回已兌換點數或重開結案。
- 通知只有站內資料，未串接LINE／推播；道路仍由前端既有Valhalla計算，無最佳化。
- 真實GCS IAM／上傳下載與Cloud Run build／部署已驗證；實體手機與前端串接尚未驗證。
