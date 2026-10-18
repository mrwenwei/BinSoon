# 統一 Bin API 與模擬

## 使用方式

既有清潔箱、十個推薦點、人工新增點都在 bins 表，每個 UUID 可直接用於同一組 API。沒有額外監測 registry 或 Candidate ORM。原始點位來源與 proposed 標記保留，hotspots 仍是獨立聚合資料。

GET /bins 預設包含大安區 existing + proposed，因此不再保證回傳 47 筆。查官方既有數量請加 bin_type=existing（全市 681、大安區 47）。所有現有、新增 Bin 都有同樣的模擬狀態與歷史；之後新增的 Bin 會在建立當下加入共用時鐘。

## 先看點位，再以 ID 查詢

```sh
curl 'http://localhost:8000/api/v1/bins?district=all'
curl 'http://localhost:8000/api/v1/bins?district=all&format=geojson'
curl 'http://localhost:8000/api/v1/bins?district=all&scenario_id=daan_phase1_10bins'
```

scenario_id 只是原始十點的來源分組，不再決定哪些 Bin 能取得讀值。它與模擬時鐘分開。

`GET /api/v1/bins/{id}` 回應（節錄）：

```json
{
  "id": "<原本的 Bin UUID>",
  "bin_type": "proposed",
  "name": "市民大道／復興南路",
  "placement_status": "proposed",
  "feasibility_status": "pending_review",
  "source_type": "model_recommendation",
  "current_usage": {
    "fill_level_pct": 65.2,
    "capacity_liters": 120,
    "estimated_used_liters": 78.24,
    "fill_rate_pct_per_hour": 7.86,
    "source_type": "simulated",
    "recorded_at": "2026-01-05T08:00:00Z",
    "last_emptied_at": null,
    "priority": "medium",
    "estimated_hours_to_90_pct": 3.1552162849872776
  }
}
```

source_type 分別說明點位來源、滿度來源。容量、速度與公升數都是合成假設，不能當成實測。有效 Bin 沒有讀值時 current_usage=null、history=[]；不存在的 ID 為 404。GET 不建立狀態、不推進時間。

## 歷史

```text
GET /api/v1/bins/{id}/history
    ?start=2026-01-05T00:00:00Z
    &end=2026-01-06T00:00:00Z
    &generation=2
    &source_type=simulated
    &limit=100
    &offset=0
```

時間參數必須帶時區，UTC 存入資料庫；起訖皆包含。limit 預設 100、上限 1000。可省略篩選查所有模擬輪次。依 generation、recorded_at 新到舊排序；同時刻 collection 優先。generation 用來區分 reset 後時鐘重回起點的多輪歷史。

每筆紀錄含 id、bin_id、fill_level_pct、recorded_at、source_type、event_type、generation。event_type 為 measurement／collection／reset。source_type 預留 iot_sensor 查詢，這階段沒有 IoT 寫入端點。

## 新增 Bin

在 Swagger Authorize 貼上 ADMIN_TOKEN 的值，或以私密環境變數傳入 Bearer token；不要把 token 寫在文件、Git 或前端 bundle。

```text
POST /api/v1/bins
Authorization: Bearer <私密 token>
Content-Type: application/json
```

```json
{
  "name": "新增待現勘點",
  "district": "大安區",
  "longitude": 121.543,
  "latitude": 25.026,
  "note": "需確認現場設置條件"
}
```

回傳 201 與完整 BinRead，包括 UUID、current_usage.fill_level_pct=0。Bin、初始狀態與 reset 紀錄在同一 transaction 建立，立即可透過 /bins/{id} 及 /history 查詢。新增點標記 proposed、pending_review，不開放以此端點冒充官方既有清冊。

所有 POST 都需管理 token；未設定時 503，缺少／錯誤時 401。舊 DEMO_ADMIN_TOKEN 仍可讀取，避免本機或既有雲端 Secret 必須立即輪替。推薦使用 ADMIN_TOKEN。

## 模擬操作

1. CSV 匯入會初始化尚缺狀態；已有滿度與歷史保持不變。
2. 若需匯入十個既有分析點，POST /api/v1/simulation/seed。重跑不重複、不覆寫人工 Bin。升級後原十點與 UUID 都保留。
3. GET /api/v1/simulation/status，取得目前 generation 與 UTC 模擬時間。
4. POST /api/v1/simulation/advance。
5. GET /bins/{id}、/history、/bins/collection-priorities 查看結果。
6. POST /bins/{id}/collect 清空單一 Bin。
7. POST /simulation/reset 開始下一輪；舊歷史不刪除。

Advance 請求：

```json
{
  "request_id": "2c626eb9-c742-4d53-9754-98aa5c211001",
  "generation": 2,
  "minutes": 60
}
```

generation 必須從 status 取得。每次新操作使用新 UUID，重試相同操作沿用 request_id、generation、時長，回應 replayed=true 且不重算。不同 ID 的並行推進會透過資料庫鎖依序累加。舊 generation 未執行的請求回 409。已完成的舊 ID 只回舊結果，不影響目前狀態。

minutes 為 1～10080 整數；也可改傳 real_seconds，以倍率換算成完整模擬分鐘，例如倍率 600 時 real_seconds=6 等同 minutes=60，兩者只能選一。

POST /simulation/pause 禁止 advance；resume 恢復，不補算牆鐘經過時間。GET 與前端定時器都不維持模擬狀態。時鐘持久化在 PostgreSQL，沒有每桶無限背景迴圈。

## 引擎與資料結構

```text
bins              # 所有點位及來源；bin_type 區分 existing/proposed
bin_states        # 每 Bin 一筆目前滿度、容量、模擬速度
bin_readings      # 所有 Bin 的滿度／清運歷史
simulation_clocks # 一個共用時鐘、seed、generation、速度倍率
simulation_advances # 推進 request ID 去重
hotspots          # 原景點聚合資料，與 Bin 監測無關
```

對應程式：app/api.py、services/bins.py 負責 Bin 查詢／建立；simulation_api.py、services/simulation.py 負責模擬；security.py 共用管理權限。

固定 seed=42，逐模擬分鐘更新。每一分鐘的 noise 由 seed、bin_id、絕對模擬分鐘的 BLAKE2 雜湊決定；同 ID、相同推進和清運事件可重現，分段 advance 與一次推進的滿度相同。0003 後引擎版本為 unified-v1；已保存舊版讀值原樣保留，未重算。

十點速度使用 demand_score/10+(11-rank)*0.03；其他點依 UUID 決定 4～8 %/hour 的基礎速率。這都是合成假設。台北時間週末倍率 1.2、平日 1；07～10、17～21 點倍率 1.3，11～14 點 1.1，其餘 0.6，沒有國定假日行事曆。每分鐘 noise 為 ±0.02 個百分點；零速度不增加滿度，滿度限制 0～100。

每次 advance 為每個模擬 Bin 新增一筆 measurement，不保存內部逐分鐘計算。達到 100 後略過多餘填滿運算，但仍更新觀測時間。未來來源為 iot_sensor 的狀態不會被 advance/reset 覆寫。

清運規則：>=90 critical、>=80 high、>=50 medium，其餘 low。排序依滿度、預估到 90% 時間、UUID。預估時間以基礎填滿速度外推，不含未來時段／噪音；已達 90% 為 0，零速度為 null。不是正式清運標準。

## 遷移與部署限制

0001、0002 已部署，保持不變；0003 將 trash_bins/candidate_locations 合併成 bins，UUID、原始座標、來源欄位、排名分數、created_at/updated_at、舊滿度及歷史 ID 均保留。來源 UUID 衝突或多個時鐘會拒絕遷移。舊 Candidate 專屬表於複製與 FK 轉換後移除，不另留第二套 active model。

這是需要協調切換的 schema 變更，舊 API 程式無法繼續使用新 schema。雲端部署前需備份、安排維護並停止舊版寫入，完成 migration 與新版本切換後再開放服務；不能把舊的一鍵流程視為無停機升級。downgrade 明確拒絕，避免丟掉舊 schema 無法表達的既有 Bin 歷史；回復需使用備份或往前修復。

2026-10-19 已完成本機及雲端備份、0003 遷移與切換，Cloud Run 已提供本頁的新 API。/demo 路由在新版本移除；/candidates 是 deprecated 相容入口，POST 也改為需管理權限。GET /bins 改為包含所有類型並增加 current_usage，前端需按新契約更新。

## 本機驗證紀錄

本次 36 項 pytest 全部通過，包含獨立 schema 遷移保留、UUID 衝突、並行 seed／advance、重試去重、所有 Bin 查詢與歷史。Alembic check 無差異。實際 HTTP 驗收為 681 個 existing + 10 個 proposed，所有 Bin 具狀態，新舊 ID 均能查歷史；官方全市／大安區與景點筆數維持 681／47、130／18。本機遷移前已另存資料庫備份。雲端另完成按需備份與維護切換，驗收詳見 [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)。CSV 對調與 TestClient 棄用提醒仍存在。
