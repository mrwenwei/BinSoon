# A／B／D 後端實作計畫

日期：2026-10-19。狀態：已依確認範圍完成後端實作並部署Cloud Run（0006），frontend尚未串接。以下保留階段及驗收依據；實際操作見 [PRODUCT_OPERATIONS.md](PRODUCT_OPERATIONS.md)，測試見 [PRODUCT_VALIDATION.md](PRODUCT_VALIDATION.md)，前端交接見 [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md)。

## 1. 已確認範圍

- 只修改 backend、migration、測試與文件，不修改 frontend。
- 交付可持久化、可跨裝置使用的展示後端，對應 [A](../../docs/A_FLOW.md)、[B](../../docs/B_FLOW.md)、[D](../../docs/D_FLOW.md)。
- 第一版使用可關閉的展示帳號登入，有期限及可撤銷的 session；不整合台北通、真實簡訊、LINE、IoT 硬體、獎品核銷、薪資或最佳化演算法。
- 市民提案建立 proposed Bin，Proposal 保存投票／審查流程並關聯同一 bin_id。尚未設置者不得成為可用桶、認養標的或清運任務。
- 採既有 +1／+2／0、三次不實、每月三案、60 人／60% 規則；規則版本保存在案件上。
- 管理員審查提案、命名、認養；隊員只處理責任區工單與查證。
- 支援真實照片上傳；本機使用開發儲存目錄，Cloud Run 使用私有物件儲存，不以容器磁碟持久化。此計畫不建立雲端資源。
- 第一版只配置大安區隊員。區外回報保留為未分派，不誤派到大安區。
- 展示清空由管理權限送入 simulated reading；既有 simulation 保留，不向一般市民開放。
- 不搬移 frontend localStorage，不把前端 63 點、48 次回報或虛構市民當成正式紀錄。
- 無管理員網頁；提供 Swagger、管理 API、初始化 CLI 及操作文件。

API 完整契約、DTO、頁面對照見 [API_CONTRACT.md](API_CONTRACT.md)。前端仍需由其負責人另行串接；新增 API 不會自動取代原本靜態快照或本機帳本。

## 2. 架構

維持 FastAPI／SQLAlchemy／PostgreSQL + PostGIS 的模組化單體，不增加 Redis、Celery 或微服務。

```text
backend/app/
  api.py, schemas.py, models.py       # 現有入口，逐步改為相容匯出
  simulation_api.py, services/       # 保留既有模擬契約
  modules/
    api.py, schemas.py               # 產品路由與Pydantic契約
    models.py                        # 新產品ORM，與既有Base共用metadata
    application.py, common.py        # 新API錯誤、CORS、冪等、版本及交易
    identity.py, media.py            # 身分與私有照片
    workflows.py                     # 回報／事件／查證／工單／完成
    participation.py                 # 提案／投票／認養／生命週期
    membership.py                    # 兌換及台帳交易
    views.py                         # 共用讀取投影，無寫入副作用
```

為保持最小變更，本輪採扁平模組而非先建立多層空目錄，舊models／schemas／router不搬動。ORM metadata同源、Alembic可偵測新表，原import相容；共用只放已出現的需求。

### 資料模型

| 類別 | 資料與重要約束 |
| --- | --- |
| 保留 | bins、hotspots、bin_states、bin_readings、simulation_clocks、simulation_advances；既有 UUID 不變。 |
| 身分 | users（roles／districts為受控JSON欄位）、auth_sessions、login_attempts；session token只存雜湊，帳密來自環境／受控初始化。 |
| 媒體 | media_assets：所有者、用途、內容類型、大小、儲存鍵、雜湊、就緒狀態、來源；儲存鍵不作公開 URL。 |
| 問題 | incidents、reports；每 Bin／問題最多一個開啟事件，每事件／使用者最多一個回報，首報 FK 固定。 |
| 工作 | work_orders、work_order_evidence、work_order_actions、completions；每事件最多一張工單、每工單最多一筆完成成果。 |
| 結算 | point_entries；Report固定settled_at、awarded_points及規則版本，每回報一次結算，台帳append-only，支出不可使餘額為負。 |
| 兌換 | rewards、redemptions；庫存及點數同一 transaction 扣除，外部核銷不在範圍。 |
| 提案 | proposals、proposal_votes、proposal_reviews（含命名歷史）；每Proposal一個proposed Bin、每人一張有效票。 |
| 認養 | adoptions（保存完整申請生命週期及preferences）；每Bin最多一個active，未核准無權益。 |
| 通知／感謝 | notifications、completion_likes；每完成成果／市民最多一個讚。 |
| 跨模組 | idempotency_records、必要 audit 紀錄；通知與業務提交同一 transaction。 |

## 3. 實作順序與交付

| 階段 | 修改內容 | Migration（順序為規劃，實際 revision ID 於實作建立） | 驗收 |
| --- | --- | --- | --- |
| 0 契約 | 本計畫、API 契約、狀態／權限／頁面對照。 | 無 | Request／Response、錯誤、角色、前端欄位差異有明確定義。 |
| 1 基礎 | 分層、共用錯誤／分頁／冪等，保持既有 API 原狀。 | 冪等及 audit 基礎 | 舊 API 回歸、重試 body 衝突、交易 rollback。 |
| 2 身分／媒體 | 展示登入、session、me、責任區、照片上傳及授權下載、CORS allowlist。 | 使用者／session／媒體 | 登出立即失效、越權拒絕、照片驗證、私有下載、關閉展示登入。 |
| 3 Bin | 地圖讀取、可用性、生命週期、詳細 view、附近搜尋；既有歷史沿用。 | bins 營運欄位、讀值觀測／接收欄位 | 全市既有 681／大安 47；hotspots 130／18；座標、未知、維修、撤除、proposed 正確。 |
| 4 回報／工單 | 事件聚合、資格快照、區外未分派、接單到場、逐筆查證、證據、修繕、結案；結算核心同階段落地。 | 事件／工單／成果／點數結算核心 | A→D→A 完整流程、並行事件去重、非法跳步、清空與照片兩種到達順序、只結算一次。 |
| 5 會員／兌換 | 會員摘要、等級、台帳查詢、三次不實、獎品及兌換。 | 獎品／兌換及所需帳戶約束 | 並行扣點不透支、不超賣、查證與結案分離、展示帳本可追溯。 |
| 6 提案 | Bin＋Proposal 原子建立、月額度、附近提示、投票、評估、命名、示範設置確認。 | 提案／投票／審查 | 60／60% 邊界、並行第三／四案、門檻鎖定、十點 seed 不變。 |
| 7 認養 | 申請／審核／撤回／結束、偏好、回報資格接合、摘要月報。 | 認養／偏好 | 唯一 active、撤除終止權益、資格不追溯、快捷通報仍須證據。 |
| 8 通知／統計 | 站內通知、完成按讚、隊員月榜、公開成果、路線站點。 | 通知／讚及統計索引 | 同分／跨月／重試正確、無需處理不計件、同桶合站但工單分開。 |
| 9 驗收／交付 | OpenAPI、契約驗證、API smoke CLI、完整遷移、環境範例、手冊與部署準備。 | 必要索引及約束收斂 | 真實 PostGIS 全套 pytest、Alembic check、舊版 schema 升級、HTTP 流程驗收。 |

階段 4 的點數 settlement 與查證一起提交，不能先將回報改為 approved 再等待階段 5 補發。階段 5 只補公開查詢及兌換能力。階段 7 以前，沒有真實 active 認養者就保存 adopter=false，不虛構認養資格；認養上線不回算舊案。

各階段同步新增測試及文件。實際DDL整併為兩個增量revision：0004產品功能與nullable metadata，0005讀值索引及延遲首報FK；上表Migration欄是責任分組，不代表已建立九個revision。新功能仍需前端負責人串接，不能直接取代其本機資料。

## 4. 重要交易與狀態界線

- 報告建立：驗證身分／停權／Bin／證據 → 序列化同桶同問題 → 找到或建立事件／工單 → 固定首報及認養快照 → 回報與站內通知同 transaction。
- 查證：產品advisory交易鎖序列化工單／回報／帳戶寫入 → 檢查責任區、到場、尚未終結 → settlement、點數、不實次數及通知原子提交；首報不實不遞補。此為展示負載策略，非高併發吞吐承諾。
- 滿桶結案：逐筆查證、完成證據、提交工作結果、本次到場後有效清空四者齊備，才關閉事件、產生成果及計件；單獨清空只更新讀值。
- 待修繕及撤除是營運限制，不因容量變低解除；照片不代替量測。
- 兌換：鎖帳戶／獎品，檢查可用點數及庫存，台帳與兌換紀錄一次提交。
- 投票：鎖提案，修改唯一票並重算；達雙門檻之一的終局分支即關閉投票，後續不得撤票。
- 月額度：以真實 UTC 時刻換算 Asia/Taipei 曆月，透過每使用者／月份序列化避免同時超額。
- 認養：鎖 Bin，核准時再次檢查唯一 active；待審不是永久保留名額，允許其他使用者申請。
- 撤除：將 Bin 標記撤除，終止 pending／active 認養、停新回報與一般清運；開啟工單保留並退出路線，不自動偽造完成或刪歷史。
- 所有作業時間使用真實 UTC，模擬時間只支配 simulated reading。reset 不刪台帳、回報、工單、認養或已保存證據，不補造清空證據。
- 通知只實作站內建立與讀取，不配置外部背景發送。排名即時計算或 SQL 聚合，無排程相依。

## 5. 相容、資料及部署

- 原規劃保留既有 /bins、/hotspots、/history、/simulation 的預設Response、認證與錯誤格式，新UI聚合用view／map、history直接重用。後續使用者已明確授權移除deprecated GET／POST /candidates；本輪僅移除這兩個入口，其他六個舊資料／維運入口保留。
- 現有 /collect 仍是管理用模擬操作，不得讓它滿足工單完成條件；工單證據須用有 task 關聯的新管理操作。
- 不將 proposed 改成官方 CSV 來源。Bin 保留 bin_type 作來源類別；另以 placement_status=installed 表示後續確認設置。舊最近官方桶距離繼續只計 bin_type=existing，新「已設置桶」查詢明確涵蓋後續安裝點。
- 既有資料不套前端 UUID hash 產生的虛構撤除／認養／新設日期。未知 installed_at 保留 null。
- 已部署 0001–0003 不改寫。擴充 migration 優先 nullable／可回填欄位，驗證後才加必要約束；不 fabricate 舊觀測接收時間或完成證據。
- migration／seed 透過既有初始化 Job，容器冷啟動不執行。展示帳號、案例、庫存及贈點使用獨立且可重跑 CLI，不隨 CSV 匯入或 GET 建立。
- 展示資料為隔離的展示環境／資料庫，不把虛構點數、工單及公開可用的展示登入開到真實作業環境。UUID、事件及 source_type 可追溯。
- 部署準備會同步檢查 CLOUD_RUN、MANUAL_DEPLOYMENT、環境範例與腳本。建立物件儲存等付費資源前另確認既有 GCP 專案、Billing、區域、規格；本文件不是資源已建立的證明。

## 6. 必須通過的測試

1. 舊 API schema、權限、原始 UUID／CSV 筆數／距離／歷史保留。
2. 未登入 401；錯角色 403；他人私有資料不可讀取；區外隊員不可操作。
3. 回報證據、50m、other 說明、被停權、未設置／撤除桶拒絕。
4. 同事件並行回報、同使用者重送、首報鎖定、結案後新事件。
5. 到場前不能查證；同回報並行查證只結算一次；首報不實無遞補。
6. 滿桶完成條件的排列順序、重複／舊／無效清空、repair／dismissed／撤除。
7. 累積與可用點數、三次不實範圍、併發兌換不負值、不超賣。
8. 投票 60 人及 60% 邊界、改撤票、跨月額度與並行額度、實際區界驗證。
9. 認養唯一 active、結束／撤除後新資格、既有資格快照不變。
10. 讚與完成各一次、台北曆月／並列排名、無需處理不計件、公開資料不洩漏案件或隊員私資。
11. 冪等 key 相同 body 重播、不同 body 409；過期／跨使用者／跨路徑不可誤重播；過期 session 仍須先驗證。
12. migration 從 0003 升級、Alembic check、PostGIS 真正並行測試；所有測試只用本機或獨立測試 DB。

## 7. 前端交接

- 提供 OpenAPI 匯出、完整 schema／enum、頁面對照、前後欄位 mapping、錯誤碼、權限及串接操作範例。
- 不承諾零前端改動即可對接；前端需改資料層、登入、媒體上傳與事件／工單 ID 關聯，移除本機計算發點、虛構歷史與 fixtures。
- 先交付 Bin／歷史，再交付 A→D 閉環，接著 B；前端可依階段替換資料來源，不要同一業務同時使用後端與 localStorage 結算。

## 後續已授權：雙種類桶槽

每點general／recycling兩個獨立State／Reading；回報事件唯一性包含種類，清運與工單證據依種類，地圖篩選與最近可用桶同步。新增0006，保留舊未分類歷史與原始CSV，不改前端。完整契約與維護部署要求見 [WASTE_STREAMS.md](WASTE_STREAMS.md)。本輪已部署Cloud Run 0006／binsoon-api-00008-v7k。
