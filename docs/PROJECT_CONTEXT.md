# BinSoon 專案背景與架構

## 產品與範圍

台北市智慧垃圾桶 MVP，地圖預設大安區，資料支援十二行政區。已有資料初始化、點位查詢、新增 Bin、滿度／清運歷史及可重現模擬。尚無前端、IoT 硬體通訊、選址最佳化或正式派工。

使用者最新要求：新增的 candidate 等同 Bin，統一模型與查詢。這不表示已實際設置；`bin_type=proposed`、`placement_status=proposed`、`feasibility_status=pending_review` 保留其待現勘意義。Hotspot 仍不是 bin。

## 目錄與環境

後端程式、資料、測試、migration、部署腳本與部署文件都在 backend/。尚未建立 frontend/。後端命令於 backend/ 執行；根目錄 Compose 需 `docker compose -f backend/compose.yaml --env-file backend/.env ...`。

Compose 專案固定 trashbin_soon，沿用 postgres_data volume。Python 3.12、FastAPI、SQLAlchemy 2、Pydantic v2、psycopg 3、PostgreSQL 16/PostGIS、Alembic、pytest；requirements.lock 固定依賴。

## 原始 CSV 與來源

| 檔案 | 實際內容 | 全市／大安區 | 處理 |
| --- | --- | --- | --- |
| backend/data/existing_bins_all_taipei.csv | 獨立清潔箱點位 | 681／47 | bins，bin_type=existing |
| backend/data/daan_hotspot_gap_screening.csv | 景點商圈聚合代表點 | 130／18 | hotspots |
| backend/data/hotspots_all_taipei.csv | 缺口分析參考 | 18／18 | 不自動匯入 |

後兩檔名與內容對調。匯入器檢查 schema，發出警告後載入真正聚合資料，原始 CSV 不改寫。景點 reported_count 是周邊清潔箱數量，不能展開成獨立點。缺口分析不能被當作真實新增點位。

UTF-8-SIG 讀取，驗證 UUID、來源唯一性、行政區、座標有限值、非負 reported_count、全市與大安區筆數；新版資料需明確調整驗證，不移除檢查。以 (source_type,source_row) upsert，保留 ID、created_at，updated_at 更新；兩組資料同一 transaction。沒有自動刪除，來源列號重排需先規劃識別策略。

十個模型推薦點另保存在 daan_phase1_10bins.json，UUID 與 external_id 穩定，source_type=model_recommendation。分數不是實測人流或垃圾量。第 4、7 點依保存的官方圖資位於中正區，座標與排名保留並警告；十點均需現勘。圖資來源、SHA256、授權與轉換見 backend/data/BOUNDARIES.md。

## 資料模型

- **Bin / bins**：所有既有及新增點，使用單一 UUID。bin_type 區分 existing/proposed；保留 name、address、status、placement_status、feasibility_status、推薦資訊及來源欄位。
- **Hotspot / hotspots**：景點聚合代表點，name、reported_count、location_precision。
- **BinState / bin_states**：每 Bin 一筆目前滿度、模擬容量、速度、觀測／清運時間與 reading source_type。
- **BinReading / bin_readings**：所有 Bin 的 measurement／collection／reset 事件；bin_id、滿度、UTC 時間、source_type、generation。
- **SimulationClock / simulation_clocks**：全體共用持久化時鐘、seed、倍率與 generation。
- **SimulationAdvance / simulation_advances**：request UUID、generation、時長與完成時間，處理重試去重。

沒有額外 registry、Candidate Model 或 Demo 專用讀值表。所有位置為 Geography(Point,4326)，GiST 索引；經度在前，API 經緯度為 numeric。所有時間為 timezone-aware UTC / timestamptz。

## API 與行為

主要使用 /api/v1/bins：列表、POST 新增、/{id} 詳情、/{id}/history、/{id}/collect、/collection-priorities。列表預設大安區，包含 existing/proposed；district=all 查全市，bin_type 篩選類型，format=geojson 取得 FeatureCollection。單一 ID 可查任一 Bin 的目前使用量及歷史。

原 /candidates GET/POST 暫保留原回應格式並 deprecated，但底層同一張 bins，POST 也需 Admin token。最近距離使用 ST_Distance 對全市 bin_type=existing 計算；無既有清潔箱回 null。Hotspot、proposed Bin 不參與既有清潔箱最近距離。

舊 /demo/* 在新版本移除，控制集中 /api/v1/simulation/{status,seed,advance,pause,resume,reset}。所有 POST 使用共享 Admin Bearer token；未設定時 503、未授權時 401。ADMIN_TOKEN 支援舊 DEMO_ADMIN_TOKEN fallback。帳密與 token 不提交 Git。

請求驗證在 Pydantic：十二行政區、有限座標與全球範圍、非空白 name 等。一般新增點尚未用多邊形驗證行政區歸屬，推薦 seed 有區界檢查。

## 狀態、歷史與模擬

CSV 匯入／POST Bin 同一 transaction 初始化缺少的狀態及歷史，不重設現有讀值。新增 Bin 從加入時的模擬時間開始，不補造過去資料。有效 ID 無讀值時 current_usage=null、history=[]；未知 ID 為 404。GET 沒有寫入或時間推進副作用。

目前所有滿度都是 simulated，包括既有清潔箱。預設容量 120 公升、基礎速率、時段／週末倍率與 noise 都是假設，estimated_used_liters 為估算。未來 iot_sensor 讀值可沿用查詢格式，硬體 ingestion 尚未實作；模擬只更新 source_type=simulated 的狀態。

固定 seed=42，統一手動 advance，不靠前端 timer，也沒有每個 Bin 無限背景迴圈。分鐘級 BLAKE2 noise 可重現，拆分推進結果相同，滿度限制 0～100。資料庫 advisory transaction lock 序列化 seed、建立、推進、清運與 reset；request ID 防重試重算，generation 拒絕 reset 前未完成的舊請求。

Reset 歸零並回復初始時鐘，generation +1；保留歷史，新增 reset 事件。歷史可篩選 UTC 時間、generation、source_type，使用 limit/offset 分頁。優先程度 >=90 critical、>=80 high、>=50 medium、其餘 low，非市府標準；到 90% 的估計以基礎速率外推，零速率 null。

## 遷移、部署與測試

0001、0002 已部署，不能改寫。0003 複製並合併 trash_bins/candidate_locations 到 bins，轉換狀態／歷史 FK 與欄位名，保留 UUID、來源、原始資訊、讀值與歷史 ID。UUID 衝突或多時鐘停止，不默默重新識別。舊表複製後移除，這是需協調切換的 schema 變更，downgrade 不會嘗試丟棄新歷史。

0003 已於 2026-10-19 完成雲端備份、維護與切換，正式 revision binsoon-api-00004-lql。第一次跨越破壞 schema 相容性的 revision 仍需備份、維護及停止舊寫入，不能直接當作無停機滾動升級。API 依 PORT 啟動且冷啟動不 migration/import；雲端使用獨立初始化 Job，Compose 啟動前初始化。migration/import 各自提交，不宣稱整體原子。

測試使用本機真實 PostGIS。一般測試外層 transaction rollback；獨立 schema 驗證完整 migration、UUID 衝突與真正並行。不得對正式 DB 跑 pytest。基本數量以 existing 篩選仍為全市 681／大安區 47，hotspots 130／18，總 Bin 數包含新點而增加。

操作與範例見 [統一 Bin 手冊](../backend/docs/BINS.md)、[後端 README](../backend/README.md)；已部署的歷史版本見 [DEPLOYMENT_STATUS.md](../backend/docs/DEPLOYMENT_STATUS.md)。

目前完成項目、驗證與待辦整理見 [PROGRESS.md](PROGRESS.md)。
