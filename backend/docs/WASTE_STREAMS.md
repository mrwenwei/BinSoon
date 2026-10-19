# 一般垃圾與資源回收：資料模型及API串接

本輪程式已改為每個Bin點位包含兩種獨立桶槽：`general`（一般垃圾）、`recycling`（資源回收）。Bin UUID、座標、來源及existing/proposed意義不變；不新增另一個地圖點，不將681個官方位置宣稱為1362個已確認實體桶。frontend未修改。本機與Cloud Run schema=0006；雙種類正式revision為binsoon-api-00008-v7k，100%流量。

## 1. 資料來源與遷移假設

原始CSV沒有垃圾種類、桶槽規格或真實感測資料。依使用者要求，所有現有／新建／推薦／市民提案Bin均配置兩種展示桶槽，不表示已完成現場盤點。所有proposed仍須會勘；場所hotspot不產生桶槽。

| 資料 | waste_type | classification_source | 處理方式 |
| --- | --- | --- | --- |
| 0005以前的目前滿度 | general | legacy_assumed_general | 原滿度、容量、速率、時間保持，以明示展示假設對應一般槽。 |
| 0005以前的歷史讀值 | null | legacy_unclassified | 原ID、滿度、事件、時間、generation及source_type完整保留，不複製、不宣稱已確認種類。 |
| 新建桶槽及其讀值 | general／recycling | demo_assumption | 各自初始化、模擬、清運；source_type仍為simulated。 |
| 原回報／事件／工單／成果 | general | legacy_assumed_general | 保留IDs、點數、結算與關聯；既有清空歷史仍可為未分類。 |

`classification_source`說明分類根據，`source_type`說明讀值來源，兩者不可互換。舊一般槽之後產生的讀值仍承襲其legacy_assumed_general標記。新增回收槽從當前模擬時間0%開始，沒有倒填舊回收歷史；也不把舊滿度分攤、複製或平均到兩個槽。

SQLAlchemy `BinState`主鍵改為 `(bin_id,waste_type)`；BinReading有獨立waste_type，舊資料可null。每個槽各有容量、速率、目前滿度、最後清空時間及觀測序列。事件唯一性改為同一 `(bin_id,type,waste_type)` 最多一個open事件；兩種滿桶是不同事件／工單／首報週期。

## 2. 模擬設定

| 環境變數 | 預設 | 說明 |
| --- | --- | --- |
| SIMULATION_CAPACITY_LITERS | 120 | 新一般槽模擬容量，公升；原有槽不重設。 |
| SIMULATION_RECYCLING_CAPACITY_LITERS | 80 | 新回收槽模擬容量，公升。 |
| SIMULATION_RECYCLING_RATE_MULTIPLIER | 0.65 | 回收槽基礎填滿速率＝該點一般基礎速率×此值；允許0。 |

以上數值均是可配置合成假設，不代表一般／回收垃圾的實際比例、密度或真實桶容積。環境設定只用於建立尚缺桶槽，不在重入時改寫既有容量／速率。公升估算各自為 `capacity_liters * fill_level_pct / 100`。

兩種共用後端手動時鐘、seed=42、generation及advance去重，但noise序列獨立，支援平假日／時段倍率。reset歸零兩種槽並保留所有歷史，不動會員台帳／業務案件；GET不改滿度。模擬只處理source_type=simulated，不覆寫iot_sensor。

## 3. 查詢與顯示

以下query的 `waste_type=general|recycling` 預設general，代表此次想丟的種類；省略時保留舊前端一般垃圾語意：

- GET `/api/v1/bins`（含GeoJSON）、`/bins/{id}`、`/bins/collection-priorities`
- GET `/api/v1/map/locations`、`/map/nearest-usable`、`/map/availability`
- GET `/api/v1/bins/{id}/view`

原單值 `current_usage`、`bin_status`、`status`均代表此次選定種類，**不是兩種平均或加總**。BinRead新增 `compartments`，每項有waste_type、classification_source、current_usage；Location／BinView的compartments直接為兩個BinStatus。place的compartments是空陣列、bin_status仍null。

```http
GET /api/v1/bins/{bin_id}?waste_type=recycling
GET /api/v1/bins/{bin_id}/view?waste_type=recycling
GET /api/v1/map/locations?filter=can_fit&waste_type=recycling
GET /api/v1/map/nearest-usable?latitude=25.033&longitude=121.5358&waste_type=recycling
```

例如general=95%、recycling=20%，一般垃圾導航會排除此桶，回收導航仍可選到。broken修繕只限制對應槽；點位尚未設置或撤除則兩種都不可用。availability的半徑判斷仍是已設置位置存在，不因滿桶或維修而假裝附近沒桶。

前端query cache須把waste_type放入key，切換種類重查地圖／詳情／歷史；不要拿general的95%當recycling滿度。列表仍每點一筆，GeoJSON座標仍 `[longitude,latitude]`。認養與提案依點位處理，不為兩種類再建兩個Proposal／Adoption。

## 4. 歷史曲線

GET `/api/v1/bins/{id}/history`保留裸陣列及原分頁，新增query：

| waste_type query | 回傳 |
| --- | --- |
| 不帶 | 全種類及舊未分類歷史，各筆均附waste_type／classification_source。 |
| general | 只有明確標為general的新讀值。 |
| recycling | 只有recycling讀值；不補過去歷史。 |
| legacy_unknown | 只有waste_type=null的遷移前歷史。 |

```http
GET /api/v1/bins/{bin_id}/history?waste_type=general&generation=0&limit=100
GET /api/v1/bins/{bin_id}/history?waste_type=recycling&generation=0&limit=100
GET /api/v1/bins/{bin_id}/history?waste_type=legacy_unknown
```

未帶種類時，前端按waste_type分成兩條曲線及「舊未分類」區段，不能混成一條線或把null換成general。每次advance每槽各新增measurement，因此同一點同時間出現兩筆是正常。recorded_at仍為模擬時間；工單證據的observed_at／received_at仍依真實UTC。

## 5. 回報、工單與清運

POST `/api/v1/reports`新增body欄位waste_type，省略為general，允許general／recycling；各問題類型都依指定槽處理：

```json
{
  "bin_id": "10000000-0000-4000-8000-000000000001",
  "waste_type": "recycling",
  "type": "full",
  "description": "回收投入口已滿",
  "photo_ids": ["20000000-0000-4000-8000-000000000001"],
  "position": {"latitude": 25.033, "longitude": 121.5358},
  "quick": false
}
```

UUID僅為文件示例。Report／WorkOrder／Completion／TaskReading增加waste_type及classification_source。回報查證與工單完成仍分開；同種類同事件去重，各種類首報分別依既有規則結算，不以一個槽清空完成另一個槽的工單。

- GET `/me/reports`、`/staff/work-orders`、`/staff/route-stops`增加可選waste_type；不帶表示兩種全列。
- `/staff/route-stops`仍同位置合站，stops增加waste_types，保留不同work_order_ids，不能把兩張工單合成一張。
- `/staff/statistics`、`/public/outcomes`增加可選waste_type；不帶計兩種類工單總數，response的waste_type=null；有帶則只計指定種類。
- POST `/bins/{id}/collect?waste_type=recycling`只歸零回收槽並新增該槽歷史；省略仍只清general，沒有all參數。
- POST `/admin/work-orders/{id}/demo-clear` **不接受client自行指定種類**，依工單waste_type清空，body仍 `{reading_id:UUID}`。先GET該工單最新ETag，再帶新Idempotency-Key及If-Match。
- 完工照、到場、查證、清空皆掛該工單；另一種類的清空／裸collect／reset不能滿足它。舊關聯歷史可仍waste_type=null，不重新標示為確認分類。
- 最近成果與可按讚資格按種類判斷；從對應種類BinView取latest_cleanup.id按讚，不同種類不互相覆蓋最新成果。
- 認養仍一個位置一位active，涵蓋兩槽；full／dirty／dumping偏好適用兩種類，通知新增waste_type以區分。舊通知或非桶況通知可null。會員、兌換及認養月報仍彙總兩種類的實際台帳／回報，不自行乘二。

舊報告冪等紀錄沒有waste_type時，僅同key、同原body的general重試可沿用；不能把相同key改成recycling重播。舊response補上general／legacy_assumed_general預設；舊evidence回應快照的location.compartments可為空陣列，不補造當時不存在的回收狀態，成功重播後重新GET即取得當前兩槽。其他狀態／授權／版本規則不變。

## 6. 初始化、測試與部署

本機使用標準入口：

```sh
docker compose up --build -d --wait
docker compose exec api alembic check
docker compose exec api python -m scripts.import_data
docker compose exec api pytest -q
```

0006只遷移結構與分類標記；初始化入口在migration後呼叫import_data／simulation.initialize，為所有既有Bin補齊缺少的兩種槽（包括沒有原始State的Bin）。單獨alembic upgrade後，仍需上述初始化步驟；重跑不重設現有資料。

**0006的複合主鍵及雙槽數量不相容於0005舊程式。** Cloud Run不可讓舊程式與新schema同時寫入：先備份、切維護並排空舊請求，使用新映像初始化Job升級0006及補齊槽，再切新API驗收。不可單純回滾0005映像，也不提供丟掉回收歷史的downgrade；需協調備份還原或向前修復。本輪已完成維護切換、備份及Cloud SQL遷移，未對正式DB執行pytest；驗收與備份見 [部署紀錄](DEPLOYMENT_STATUS.md)。

所有新增測試只用本機PostGIS及獨立schema，包含舊歷史保留、資料重入、雙種類可重現、單槽清空、獨立事件與工單、維修隔離、地圖篩選、分類驗證及舊冪等重播。精確Request／Response見 [API Reference](API_REFERENCE.md)。
