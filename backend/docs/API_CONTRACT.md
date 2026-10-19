# A／B／D Backend API 契約

前端工程師請先讀 [串接指南](FRONTEND_INTEGRATION.md)：內含線上 URL、TypeScript fetch、登入／上傳範例、P1–P22 呼叫順序與錯誤處理。逐一查詢 endpoint 的參數及完整欄位限制請看 [API Reference](API_REFERENCE.md)；本文件說明業務語意及權限。

日期：2026-10-19。**本文件描述雙種類程式契約（0006），已部署Cloud Run 0006／binsoon-api-00008-v7k。frontend未修改、尚未串接。** 實作順序見 [BACKEND_ROADMAP.md](BACKEND_ROADMAP.md)，初始化／HTTP驗收見 [PRODUCT_OPERATIONS.md](PRODUCT_OPERATIONS.md)，驗證見 [PRODUCT_VALIDATION.md](PRODUCT_VALIDATION.md)。執行中的 `/openapi.json` 列出實際schema及必要headers；雙種類線上OpenAPI已與本分支快照完整比對一致。

提供可供前端型別產生器使用的 [OpenAPI JSON快照](openapi.json)。在backend/執行 `python -m scripts.export_openapi` 更新；契約測試比對快照與實際回應。雙種類型別可從本分支快照或線上OpenAPI產生，兩者已驗證一致。詳細遷移、各API的waste_type預設與分類假設見 [雙種類串接](WASTE_STREAMS.md)。

## 1. 共通規格

- Base path：`/api/v1`。本文件路徑省略此前綴；`/health` 例外。
- JSON 欄位使用 snake_case，沿用現有後端風格。第 12 節提供 frontend camelCase 對照；不要求前端複製 ORM 結構。
- ID 為 UUID 字串；前端 TP-xxx 僅是展示碼，不能當設備 ID。既有 Bin UUID 不變。
- timestamp 使用 timezone-aware ISO 8601 UTC，例如 `2026-10-19T08:00:00Z`；月份使用台北曆月 `2026-10`。所有寫入業務時間由伺服器產生。
- 所有座標為有限 JSON number；latitude -90..90，longitude -180..180。GeoJSON `[longitude, latitude]`，距離公尺、時間秒、滿度 0..100、公升另列。未知為 null，不能代換 0。
- 新 DTO 未提供值的欄位仍輸出 null／空陣列，不輸出 undefined。新請求拒絕未定義欄位；字串 trim 後驗證。
- 新列表統一 `{ "items": [...], "page": { "limit": 20, "offset": 0, "total": 3 } }`，limit 預設 20、1..100，offset >=0。排序固定增加 id tie-breaker。GeoJSON 與既有裸陣列 API 不套此 envelope。
- 新單筆回應直接為 DTO，無 data 包裝。新建 201，讀取／命令 200，刪除 session 204 無 body。
- 新個人化／私有資料 `Cache-Control: no-store`；不得以共用快取回傳他人的 mine、vote、like 或認養資料。

### 認證、冪等及並行

- 表中 P=公開、U=市民、S=隊員（限責任區；操作限自己已接工單）、A=管理員、O=任意已登入者。管理員不隱含市民首報／投票身分；查證原則由執行隊員完成。
- 新 API 使用 `Authorization: Bearer <session_token>`。session token 只存雜湊，期限 60 分鐘，登出撤銷；第一版無 refresh token。過期後重新登入不清業務資料。
- 舊管理 API 繼續接受既有 Admin token；新管理 API 接受 admin session 或維運 Admin token。市民／隊員 API 不接受共享 Admin token 冒充市民／隊員。
- 新建及命令型 POST／PATCH 均需 `Idempotency-Key: <UUID>`，登入及檔案上傳除外。key 以 actor＋method＋path 限定；相同 body 重播原 status/body，回 `Idempotency-Replayed: true`，不同 body 回 409。維護CLI保留至少30天；關鍵業務唯一約束即使 key 過期仍有效。
- 驗證有效身分及授權後才重播，不因冪等紀錄繞過撤銷權限。重播的舊結果可用 GET 更新。
- 可變資源 DTO 有 version（整數，由 1 開始）及 `ETag: "v1"`。表中標記 V 的更新命令需 `If-Match: "v1"`；缺少 428，過期 412，前端重新 GET 後再操作。V 不表示前端可直接改 status。
- 查證使用 WorkOrder ETag，不使用 Report ETag；所有工單子操作遞增其 version。投票不要求 ETag，鎖定後使用最新投票狀態檢查，關閉回 409。
- 同 key 重播先於 version 檢查；全新 key 才進入狀態／版本驗證。未知、無權讀取的私有單筆資源均 404，角色本身不足則 403。
- CORS 僅允許設定的本機／部署前端來源；允許 Authorization、Content-Type、Idempotency-Key、If-Match，暴露 ETag、Idempotency-Replayed、X-Request-ID；不以 wildcard 搭配私有存取。

### 新 API 錯誤

```json
{
  "detail": {
    "code": "REPORTING_SUSPENDED",
    "message": "累積三次不實，暫停回報資格。",
    "fields": [],
    "request_id": "5b45f218-e2df-4d4b-91e7-001d2246c672"
  }
}
```

fields 為 `{field:string, code:string, message:string}[]`，無欄位錯誤時空陣列；不回傳 token／原始照片內容／資料庫訊息。

| HTTP | code 範例 | 前端行為 |
| --- | --- | --- |
| 401 | UNAUTHENTICATED、SESSION_EXPIRED | 導登入並保留當次表單。 |
| 403 | FORBIDDEN、REPORTING_SUSPENDED | 顯示無權限／暫停回報，不把投票及認養一起封鎖。 |
| 404 | NOT_FOUND | 顯示找不到或已無法存取。 |
| 409 | INVALID_TRANSITION、VOTING_CLOSED、MONTHLY_QUOTA_EXCEEDED、NEARBY_PROPOSAL、INSUFFICIENT_POINTS、OUT_OF_STOCK、BIN_UNAVAILABLE、ADOPTION_CONFLICT、EVIDENCE_REQUIRED、IDEMPOTENCY_CONFLICT | 顯示原因，更新相應資源；不自動重試業務命令。 |
| 412／428 | VERSION_CONFLICT／VERSION_REQUIRED | 更新詳情及 ETag，重新確認操作。 |
| 413／415 | FILE_TOO_LARGE／UNSUPPORTED_MEDIA_TYPE | 重選照片。 |
| 411 | CONTENT_LENGTH_REQUIRED | multipart需提供Content-Length；瀏覽器FormData自動提供。 |
| 422 | VALIDATION_ERROR、OUTSIDE_SUPPORTED_BOUNDARY、PROXIMITY_TOO_FAR | 標示欄位；月額度等狀態衝突使用 409。 |
| 429 | RATE_LIMITED | 依 Retry-After 等待。 |
| 503 | DEMO_AUTH_DISABLED、STORAGE_UNAVAILABLE | 說明功能暫不可用，不展示成功。 |

舊 API 保持目前 FastAPI detail／422 格式，不以全域 handler 改掉既有契約。

## 2. 既有 API 與已移除入口

| Method／path | Response／注意 |
| --- | --- |
| GET /bins | BinRead[]；district=大安區（可 all）、bin_type=existing/proposed、scenario_id、format=json/geojson。 |
| POST /bins | BinCreate → 201 BinRead；管理員 token，新增 proposed。 |
| GET /bins/{bin_id} | BinRead；保留所有原欄位與 current_usage。 |
| GET /bins/{bin_id}/history | ReadingRead[]；start/end UTC、source_type=simulated/iot_sensor、generation、limit=100（1..1000）、offset=0。預設查所有 generation，前端單輪圖可帶 generation。 |
| POST /bins/{bin_id}/collect | BinRead；管理用模擬歸零，**不建立工單完成證據**。 |
| GET /bins/collection-priorities | PriorityRead[]；滿度風險排序，不取代新工單優先度。 |
| GET /hotspots | HotspotRead[]；district 預設大安區，現有 endpoint 不支援 all。 |
| GET /simulation/status | ClockRead。 |
| POST /simulation/seed、pause、resume、reset | ClockRead，管理 token。 |
| POST /simulation/advance | `{request_id:UUID,generation:int,minutes:int}` 或 real_seconds（二選一）→ AdvanceRead；沿用既有 body 去重，不改成新 header 規則。 |
| GET /health（無 /api/v1） | `{"status":"ok"}`，DB 不可用時 503。 |

BinRead／UsageRead／ReadingRead 正確欄位以 [schemas.py](../app/schemas.py) 為準；ClockRead 等以 [simulation_schemas.py](../app/simulation_schemas.py) 為準，不在本計畫改寫。

2026-10-19依使用者確認移除GET／POST `/candidates`（404），不再提供CandidateRead。讀建議點用 `/bins?bin_type=proposed`；市民建立提案用POST `/proposals`，維運直接建桶用POST `/bins`。這是已公告的路由移除，不刪除既有Bin、來源或歷史；其他既有API回應維持不變。目前共68 paths／70 operations／88 schemas。

歷史範例（既有格式）：

```json
[
  {
    "id": "ba8ff5a1-5042-460a-9100-a033de143d9d",
    "bin_id": "10000000-0000-4000-8000-000000000001",
    "fill_level_pct": 62.5,
    "recorded_at": "2026-01-05T08:00:00Z",
    "source_type": "simulated",
    "event_type": "measurement",
    "generation": 0,
    "waste_type": "general",
    "classification_source": "demo_assumption"
  }
]
```

history新增waste_type篩選：general／recycling／legacy_unknown；不帶時回全部，舊讀值waste_type=null且classification_source=legacy_unclassified。不得把不同種類混成一條曲線。

recorded_at 為讀值所屬時間，模擬使用 simulated_at，不能當成真實作業時間；歷史陣列不足 limit 即讀取完畢。前端依 recorded_at、id 穩定排序後畫圖，不補固定示意柱。

## 3. DTO 字典

下列型別以 TypeScript 表達 JSON 契約，僅作文件，不新增或修改 frontend 程式。`UUID`／`UTC` 為 string；`Page<T>` 使用第 1 節 envelope；`Versioned` 為 `{version:number}`。所有下列列出的欄位皆必回傳（含 null）。BinRead新增compartments陣列，各項為{waste_type,classification_source,current_usage}，原current_usage是query選定種類（預設general）；產品Location／BinView的compartments則為BinStatus陣列。Object 的開放字典只有明確宣告的 Record。

### 3.1 身分、位置、桶況

```ts
type User = {
  id: UUID; display_name: string; roles: ("citizen"|"staff"|"admin")[];
  districts: string[]; auth_source: "demo";
};
type Session = {access_token:string; token_type:"bearer"; expires_at:UTC; user:User};
type Media = {
  id:UUID; purpose:"report"|"completion"|"site";
  content_type:"image/jpeg"|"image/png"|"image/webp";
  size_bytes:number; status:"ready"; created_at:UTC;
};
type WasteType = "general"|"recycling";
type ClassificationSource = "demo_assumption"|"legacy_assumed_general"|"legacy_unclassified";
type Location = {
  id:UUID; kind:"bin"|"place"; district:string; label:string;
  address:string|null; longitude:number; latitude:number; note:string;
  source_type:string; source_row:number|null; source_file:string|null;
  location_precision:"point_as_published"|"representative_point_only"|null;
  reported_count:number|null; bin_type:"existing"|"proposed"|null;
  placement_status:"existing"|"proposed"|"installed"|null;
  distance_m:number|null; walking_estimate_seconds:number|null;
  bin_status:BinStatus|null; compartments:BinStatus[];
};
type BinStatus = {
  waste_type:WasteType; classification_source:ClassificationSource;
  fill_level_pct:number|null; capacity_liters:number|null;
  estimated_used_liters:number|null;
  fill_status:"hungry"|"half"|"full"|"unknown";
  operational_status:"normal"|"repair"|"removed";
  is_usable:boolean;
  unavailable_reasons:("not_installed"|"removed"|"repair"|"full"|"unknown")[];
  is_new:boolean; installed_at:UTC|null; removed_at:UTC|null;
  reading_source_type:"simulated"|"iot_sensor"|null;
  observed_at:UTC|null; received_at:UTC|null; last_emptied_at:UTC|null;
  risk_priority:"critical"|"high"|"medium"|"low"|null;
  estimated_hours_to_90_pct:number|null;
};
type AdoptionPublic = {display_name:string; role:"居民"|"店家"|"學校"|"社區團體"; intro:string};
type Cleanup = {
  waste_type:WasteType; classification_source:ClassificationSource;
  id:UUID; work_order_id:UUID; bin_id:UUID; completed_at:UTC;
  like_count:number; liked_by_me:boolean; can_like:boolean;
};
type BinView = {
  location:Location; status:BinStatus; compartments:BinStatus[]; adopter:AdoptionPublic|null;
  latest_cleanup:Cleanup|null;
  my_adoption_id:UUID|null; can_apply_adoption:boolean; can_report:boolean;
  report_block_reason:"login_required"|"suspended"|"not_installed"|"removed"|null;
};
type Nearby = {
  has_existing_bin_within_radius:boolean; radius_m:number;
  nearest_installed_bin:Location|null; bins:Location[]; proposals:Proposal[];
};
```

Location 的 place：bin_type／placement_status／bin_status 為 null，reported_count 保留統計語意。Bin 的 reported_count=null。proposed 名稱即使存在也不代表已裝設。已確認設置的新增 Bin 保留 bin_type=proposed（來源），placement_status=installed（生命週期）。

fill_status：有效滿度 <50 hungry、50..<80 half、>=80 full；未知、維修、撤除顯示 unknown，數值若仍有效可保留但 is_usable=false。risk_priority 沿用 >=90 critical、>=80 high、>=50 medium、其餘 low；未知為 null。

is_new 只依有證據的 installed_at 於過去 30 天判定；舊 CSV 日期未知則 false。撤除保留永久紀錄，地圖預設只顯示近 7 天撤除標記。walking_estimate_seconds 為距離假設估算，不是真實路線時間，只有提供起點才有值。

### 3.2 回報、事件、工單

```ts
type Problem = "full"|"dirty"|"dumping"|"broken"|"other";
type Report = {
  waste_type:WasteType; classification_source:ClassificationSource;
  id:UUID; bin_id:UUID; event_id:UUID; work_order_id:UUID|null;
  type:Problem; description:string; created_at:UTC;
  status:"pending"|"processing"|"approved"|"rejected";
  adopter:boolean; first_reporter:boolean; quick:boolean;
  photo_ids:UUID[]; accepted_at:UTC|null; reviewed_at:UTC|null;
  rejection_reason:string|null; pending_points:number; awarded_points:number;
  settled_at:UTC|null; rule_version:string;
  event_status:"open"|"closed";
  work_status:WorkStatus|null; assignment_status:"assigned"|"unassigned";
};
type WorkStatus = "pending"|"processing"|"arrived"|"waiting_sensor"|"repair"|"completed"|"dismissed";
type WorkOrder = {
  waste_type:WasteType; classification_source:ClassificationSource;
  id:UUID; version:number; event_id:UUID; bin_id:UUID; type:Problem;
  source:"citizen"|"sensor"|"inspection"; status:WorkStatus; district:string;
  assigned_staff_id:UUID|null; created_at:UTC; accepted_at:UTC|null;
  arrived_at:UTC|null; photo_at:UTC|null; submitted_at:UTC|null;
  completed_at:UTC|null; clear_reading_id:UUID|null;
  reason:string|null; confirmed_problem:boolean|null;
  priority:"immediate"|"high"|"normal"|"inspection";
  target_at:UTC|null; is_overdue:boolean; distance_m:number|null;
  source_type:"demo"|"operational"; is_fixture:boolean;
  completion_id:UUID|null; blocked_by_removed_bin:boolean;
};
type WorkDetail = {
  work_order:WorkOrder; location:Location;
  reports:Report[]; evidence:Evidence[];
  latest_reading:TaskReading|null;
  completion_requirements:{
    arrived:boolean; reports_reviewed:boolean; completion_photo:boolean;
    work_submitted:boolean; fresh_clear_reading:boolean;
    missing:string[];
  };
};
type Evidence = {id:UUID; media_id:UUID; purpose:"completion"|"site"; created_at:UTC};
type TaskReading = {
  waste_type:WasteType|null; classification_source:ClassificationSource;
  id:UUID; bin_id:UUID; work_order_id:UUID;
  fill_level_pct:number; observed_at:UTC; received_at:UTC;
  source_type:"simulated"|"iot_sensor"; event_type:"collection";
};
type ReviewResult = {report:Report; work_order:WorkOrder};
type ClearResult = {reading:TaskReading; work_order:WorkOrder};
```

Report.status 僅為前端 P7 查證投影：尚未接單 pending、接單後未查證 processing，終局 approved/rejected；不可由市民指定。WorkStatus 是獨立進度，兩者必須同時顯示。

event_id 與 work_order_id 是不同 UUID；前端目前把 task.id 當 eventId 的寫法必須在資料轉接時修正，不能要求後端重用 ID。

priority：dumping 或有效滿度 >=90 immediate；full／認養快捷通報或滿度 >=80 high；其他 normal，僅稽查提示 inspection；符合多條取最高級。同級 created_at ASC、id ASC。immediate target_at=created_at+30 分鐘，只是展示目標，逾時不扣點或自動關閉。

### 3.3 會員、點數、兌換

```ts
type Tier = {code:string; name:string; threshold:number};
type Membership = {
  cumulative_points:number; available_points:number; pending_points:number;
  approved_report_count:number; rejected_report_count:number;
  reporting_suspended:boolean; current_tier:Tier; next_tier:Tier|null;
  points_to_next_tier:number|null; rule_version:string;
};
type PointEntry = {
  id:UUID; type:"report_award"|"redemption"|"demo_grant";
  amount:number; balance_after:number; report_id:UUID|null;
  redemption_id:UUID|null; created_at:UTC; source_type:"demo"|"operational";
};
type Reward = {
  id:UUID; code:string; name:string; category:"coupon"|"grand";
  cost:number; stock:number; is_demo:boolean; available:boolean;
};
type Redemption = {
  id:UUID; reward_id:UUID; cost:number; created_at:UTC;
  status:"demo_issued"; voucher_code:string; is_demo:true;
};
type RedeemResult = {redemption:Redemption; membership:Membership; reward:Reward};
```

等級門檻沿用 0／10／50／150／500／1000，名稱沿用前端。累積點數不因兌換下降；台帳不能用 approved_count 推算。展示贈點若啟用，必須是 demo_grant 台帳，不使用隱藏的 +63。獎品 code 對照前端目前靜態 ID，由種子資料與串接表固定，不以名稱當唯一鍵。

### 3.4 提案、認養、通知及成果

```ts
type Proposal = {
  id:UUID; version:number; bin_id:UUID; name:string; reason:string;
  latitude:number; longitude:number; district:string;
  created_at:UTC; mine:boolean; support:number; oppose:number;
  total_votes:number; support_ratio:number|null;
  my_vote:"support"|"oppose"|null;
  status:"collecting"|"village"|"evaluation"|"survey"|"installed"|"declined";
  outcome_reason:string|null; voting_closed_at:UTC|null;
  pending_name:string|null; approved_name:string|null;
  name_status:"pending"|"approved"|"returned"|null;
  is_demo:boolean; rule_version:string;
};
type ProposalQuota = {month:string; timezone:"Asia/Taipei"; limit:3; used:number; remaining:number};
type ProposalCreateResult = {
  proposal:Proposal; quota:ProposalQuota;
  warnings:{code:"NEAR_EXISTING_BIN"; distance_m:number; bin_id:UUID}[];
};
type Preferences = {full:boolean; dumping:boolean; dirty:boolean};
type Adoption = {
  id:UUID; version:number; bin_id:UUID;
  role:"居民"|"店家"|"學校"|"社區團體";
  display_name:string; intro:string; preferences:Preferences;
  status:"pending"|"active"|"rejected"|"withdrawn"|"ended";
  created_at:UTC; updated_at:UTC; reason:string;
};
type AdoptionMonth = {
  adoption_id:UUID; month:string; timezone:"Asia/Taipei";
  reports_submitted:number; reports_approved:number; points_awarded:number;
  is_partial_month:boolean; source_type:"demo"|"operational";
};
type Notification = {
  waste_type:WasteType|null;
  id:UUID; type:"report_reviewed"|"work_assigned"|"work_completed"|"proposal_updated"|"adoption_updated"|"adoption_alert";
  title:string; message:string; created_at:UTC; read_at:UTC|null;
  target:{kind:"report"|"work_order"|"proposal"|"adoption"; id:UUID};
};
type RouteStops = {
  origin:{latitude:number; longitude:number; source:"demo_fixed"};
  stops:{bin_id:UUID; label:string; latitude:number; longitude:number; work_order_ids:UUID[]; waste_types:WasteType[]; priority:WorkOrder["priority"]}[];
  generated_at:UTC;
};
type StaffMonth = {
  waste_type:WasteType|null;
  month:string; timezone:"Asia/Taipei"; district:string;
  completed_count:number; average_processing_seconds:number|null;
  like_count:number; bonus_display_only:true;
  ranking:{rank:number; staff_id:UUID; display_name:string; completed_count:number; average_processing_seconds:number|null; like_count:number}[];
};
type PublicOutcomes = {waste_type:WasteType|null; month:string; timezone:"Asia/Taipei"; district:string; completed_count:number; like_count:number};
type BinLifecycle = {
  bin_id:UUID; version:number; operational_status:"normal"|"repair"|"removed";
  placement_status:"existing"|"proposed"|"installed";
  installed_at:UTC|null; removed_at:UTC|null; reason:string|null;
};
```

support／oppose 均包含登入者自己的票，前端不得再加一次；support_ratio 為 0..1，零票 null，UI 可顯示 0%。mine／my_vote／liked_by_me 為登入身分投影，訪客為 false／null。示範環境 installed 是展示設置，is_demo=true，不能宣稱已現場裝設。

StaffMonth 只計有執行者與證據的 completed，dismissed 不計；同分 dense rank（1,1,2），讚及時間不破同分。後端不造前端的歷史基數；只有獨立展示 seed 可提供可追溯 fixtures，不能混入會員台帳。第一版不提供真實加給金額。

## 4. 身分與媒體 API

| Method／path | 權限 | Request | Response |
| --- | --- | --- | --- |
| POST /auth/demo/login | P | `{account:string,password:string}` | 200 Session |
| DELETE /auth/session | O | 無 | 204 |
| GET /me | O | 無 | User |
| POST /media | O | multipart：file、purpose | 201 Media |
| GET /media/{media_id}/access | O | 無 | `{url:string,expires_at:UTC}` |

展示登入由 DEMO_AUTH_ENABLED 控制，預設 false；帳號／角色由受控 seed 固定，不接受 client 自選角色。account 1..100、password 1..200 字元，拒絕記錄密碼，失敗統一 401；依帳號／來源節流。手機表單與固定 123456 是原前端展示，不是新後端真實 OTP，本階段不存手機或聲稱已發簡訊。展示帳號不配置公開的管理員密碼；環境變數不能放入 VITE_*。

照片：purpose=report／completion／site；最多 5 MiB，檢查實際 JPEG／PNG／WebP、可解碼、最大 2000 萬像素，移除 EXIF（含定位）；正規化後計大小及雜湊。第一版每回報／工單用途一張；不接受任意外部 URL。檔案先存妥再回 ready，失敗不回成功。未掛靠資產不作證據；逾 24h 孤兒用維運 CLI 清理，不依賴常駐排程。

上傳權限：report 僅 U、completion/site 僅 S；引用時檢查 uploader 及業務權限，不能借用他人資產或舊事件完成照。完成照建立時間須 >= arrived_at。media access 僅所有者、對應案件有權隊員／管理員；一般市民無權看其他回報者照片。網址有效 5 分鐘，本機使用同等授權的短效下載；Cloud 使用私有 bucket signed URL。

## 5. 地圖、桶詳情及生命週期

| Method／path | 權限 | Query／Request | Response |
| --- | --- | --- | --- |
| GET /map/locations | P（可帶 session） | district=大安區/all，kind=bin/place/all（預設 bin），q≤200，filter=all/hungry/can_fit/new，include_proposed=false，include_removed=false，latitude+longitude 二者同有，limit/offset | Page<Location> |
| GET /map/nearest-usable | P | latitude、longitude 必填；district=大安區/all，q、limit=3（1..10） | `{items:Location[]}` |
| GET /map/availability | P（可帶 session） | latitude、longitude；radius_m=300（固定） | Nearby |
| GET /bins/{bin_id}/view | P（可帶 session） | 無 | BinView |
| GET /bins/{bin_id}/lifecycle | A | 無 | BinLifecycle＋ETag |
| POST /admin/bins/{bin_id}/lifecycle | A，V | `{action:"remove",reason:string}` | BinLifecycle |

filter=can_fit 包含 hungry/half；new 只看 is_new。kind=all 時桶況 filter 不隱藏 place（place 不套桶況）。map 預設排除未設置 proposed；include_proposed=true 顯示其待現勘意義但不成為可用桶。include_removed=false 仍保留近 7 天已撤除標記，true 可查所有撤除紀錄。q 搜尋名稱／行政區／地址。提供起點依 distance ASC、id 排；未提供則 id ASC。

nearest-usable 沿用市民行政區／文字條件（對應目前最近三桶）；**availability 不套 UI 篩選**，跨全市找已設置未撤除桶，含滿桶／未知／維修，不含場所／未設置 proposed。nearest_installed_bin 取全市最近，不因超出 300m 變 null；bins 僅列半徑內點，proposals 為半徑內未 declined 的提案。ST_Distance geography 作準，不直接沿用前端 Haversine。

availability 的 existing 指「已設置位置存在」，包含日後 placement_status=installed 的 proposed；未設置建議點及場所不計入。

remove reason 1..500，撤除不可直接 restore；未完成工單標示 blocked_by_removed_bin、不自動完成。維修狀態由 broken 工單控制；不提供任意改 fill 或解除維修的通用 PATCH。初始 CSV installed_at 未知保持 null。

BinView 範例（UUID 為文件示例，不代表資料庫已有該點）：

```json
{
  "location": {
    "id": "10000000-0000-4000-8000-000000000001",
    "kind": "bin",
    "district": "大安區",
    "label": "展示清潔箱",
    "address": null,
    "longitude": 121.5358,
    "latitude": 25.033,
    "note": "",
    "source_type": "existing_bin",
    "source_row": 1,
    "source_file": "existing_bins_all_taipei.csv",
    "location_precision": "point_as_published",
    "reported_count": null,
    "bin_type": "existing",
    "placement_status": "existing",
    "distance_m": null,
    "walking_estimate_seconds": null,
    "bin_status": {
      "fill_level_pct": 62.5,
      "capacity_liters": 120,
      "estimated_used_liters": 75,
      "fill_status": "half",
      "operational_status": "normal",
      "is_usable": true,
      "unavailable_reasons": [],
      "is_new": false,
      "installed_at": null,
      "removed_at": null,
      "reading_source_type": "simulated",
      "observed_at": "2026-01-05T08:00:00Z",
      "received_at": null,
      "last_emptied_at": null,
      "risk_priority": "medium",
      "estimated_hours_to_90_pct": 5.5,
      "waste_type": "general",
      "classification_source": "demo_assumption"
    },
    "compartments": [
      {
        "fill_level_pct": 62.5,
        "capacity_liters": 120,
        "estimated_used_liters": 75,
        "fill_status": "half",
        "operational_status": "normal",
        "is_usable": true,
        "unavailable_reasons": [],
        "is_new": false,
        "installed_at": null,
        "removed_at": null,
        "reading_source_type": "simulated",
        "observed_at": "2026-01-05T08:00:00Z",
        "received_at": null,
        "last_emptied_at": null,
        "risk_priority": "medium",
        "estimated_hours_to_90_pct": 5.5,
        "waste_type": "general",
        "classification_source": "demo_assumption"
      },
      {
        "fill_level_pct": 20,
        "capacity_liters": 80,
        "estimated_used_liters": 16,
        "fill_status": "hungry",
        "operational_status": "normal",
        "is_usable": true,
        "unavailable_reasons": [],
        "is_new": false,
        "installed_at": null,
        "removed_at": null,
        "reading_source_type": "simulated",
        "observed_at": "2026-01-05T08:00:00Z",
        "received_at": null,
        "last_emptied_at": null,
        "risk_priority": "low",
        "estimated_hours_to_90_pct": 20,
        "waste_type": "recycling",
        "classification_source": "demo_assumption"
      }
    ]
  },
  "status": {
    "fill_level_pct": 62.5,
    "capacity_liters": 120,
    "estimated_used_liters": 75,
    "fill_status": "half",
    "operational_status": "normal",
    "is_usable": true,
    "unavailable_reasons": [],
    "is_new": false,
    "installed_at": null,
    "removed_at": null,
    "reading_source_type": "simulated",
    "observed_at": "2026-01-05T08:00:00Z",
    "received_at": null,
    "last_emptied_at": null,
    "risk_priority": "medium",
    "estimated_hours_to_90_pct": 5.5,
    "waste_type": "general",
    "classification_source": "demo_assumption"
  },
  "adopter": null,
  "latest_cleanup": null,
  "my_adoption_id": null,
  "can_apply_adoption": false,
  "can_report": false,
  "report_block_reason": "login_required",
  "compartments": [
    {
      "fill_level_pct": 62.5,
      "capacity_liters": 120,
      "estimated_used_liters": 75,
      "fill_status": "half",
      "operational_status": "normal",
      "is_usable": true,
      "unavailable_reasons": [],
      "is_new": false,
      "installed_at": null,
      "removed_at": null,
      "reading_source_type": "simulated",
      "observed_at": "2026-01-05T08:00:00Z",
      "received_at": null,
      "last_emptied_at": null,
      "risk_priority": "medium",
      "estimated_hours_to_90_pct": 5.5,
      "waste_type": "general",
      "classification_source": "demo_assumption"
    },
    {
      "fill_level_pct": 20,
      "capacity_liters": 80,
      "estimated_used_liters": 16,
      "fill_status": "hungry",
      "operational_status": "normal",
      "is_usable": true,
      "unavailable_reasons": [],
      "is_new": false,
      "installed_at": null,
      "removed_at": null,
      "reading_source_type": "simulated",
      "observed_at": "2026-01-05T08:00:00Z",
      "received_at": null,
      "last_emptied_at": null,
      "risk_priority": "low",
      "estimated_hours_to_90_pct": 20,
      "waste_type": "recycling",
      "classification_source": "demo_assumption"
    }
  ]
}
```

location.bin_status 與 status 必須取同一 snapshot，不可不同。最終 source_type 原樣保留資料庫來源，不因 UI 展示重新命名；例中來源字串僅示例。

## 6. 市民回報及清潔隊工單

| Method／path | 權限 | Request／Query | Response |
| --- | --- | --- | --- |
| POST /reports | U | ReportCreate（下方） | 201 Report；相同事件自己已回報則 200 既有 Report，不消耗新證據 |
| GET /me/reports | U | status、bin_id、limit/offset，created_at DESC | Page<Report> |
| GET /reports/{report_id} | U（本人）／S（責任區）／A | 無 | Report |
| GET /staff/work-orders | S | bucket=pending/processing/completed/all，type、source、limit/offset；district 必須在責任區 | Page<WorkOrder> |
| GET /staff/work-orders/{id} | S | 無 | WorkDetail＋WorkOrder ETag |
| POST /staff/work-orders/{id}/accept | S，V | `{}` | WorkOrder |
| POST /staff/work-orders/{id}/arrive | S，V | `{}` | WorkOrder |
| POST /staff/work-orders/{id}/reports/{report_id}/review | S，V | `{decision:"approved"|"rejected",reason:string|null}` | ReviewResult |
| POST /staff/work-orders/{id}/evidence | S，V | `{media_id:UUID,purpose:"completion"|"site"}` | WorkDetail |
| POST /staff/work-orders/{id}/finish | S，V | `{reason:string|null}` | WorkOrder |
| POST /staff/work-orders/{id}/defer-repair | S，V | `{reason:string}` | WorkOrder |
| POST /staff/work-orders/{id}/dismiss | S，V | `{reason:string}` | WorkOrder |
| GET /admin/work-orders/{id} | A | 無；供受控展示清空讀取最新版本 | WorkDetail＋WorkOrder ETag |
| POST /admin/work-orders/{id}/demo-clear | A，V | `{reading_id:UUID}` | ClearResult |

ReportCreate：

```json
{
  "bin_id": "10000000-0000-4000-8000-000000000001",
  "type": "full",
  "description": "垃圾已接近投入口。",
  "photo_ids": [
    "20000000-0000-4000-8000-000000000001"
  ],
  "position": {
    "latitude": 25.033,
    "longitude": 121.5358
  },
  "quick": false,
  "waste_type": "general"
}
```

- description 0..500，other trim 後必填；photo_ids 必須一張有效本人 report 照片。position 必填，後端算 <=50m；位置僅為使用者提供，非防偽 GPS 認證，不持久化原始使用者座標。
- 不接受 adopter／first_reporter／status／user_id。quick=true 需要目前 active 認養；其他使用者只能一般回報。停權時兩者都拒絕。
- 先查同使用者有效事件去重，再驗證新事件需要的證據；重送導回既有案，新事件不能沿用上一次證據。不得用隨機新 key 繞過唯一回報規則。
- 新建 Report 時建立／取得 Incident。大安區建立 pending 工單，其他區 work_order_id=null、assignment_status=unassigned，仍有 event_id；不把區外回報隱藏或視為已處理。
- 已設置且未撤除才可回報；維修中仍可回報其他現場問題，但不可導航為可用桶。
- reason 上限 500；reject／repair／dismiss 必填。approved reason 可 null。不得直接 PUT／PATCH report.status。
- bucket processing 包含 processing／arrived／waiting_sensor／repair，completed 包含 completed／dismissed。清單按 priority、created_at、id 排；操作不允許別人已接任務。
- accept 僅 pending→processing；arrive 僅 processing→arrived。到場後才可查證、掛證據、repair、finish、dismiss。
- finish 必須照片及全部回報查證齊備；full 無清空則 200 waiting_sensor，否則 completed。非 full 不靠清空結案。broken 修復 finish 完成時才解除對應維修限制，仍有其他開啟 broken 事件則不解除。
- evidence 只掛一張該用途照片，重複同 media_id 不重建；完成照有時但尚未 finish 不自動結案。dismiss 必須 site 照、全查證及原因，關事件但不生成可計件 Completion。
- demo-clear 僅展示模式且工單 full、已到場、未結案可用。observed_at／received_at 均由真實後端時鐘產生（不接受 client 偽造）；reading_id 全域唯一，較舊／重複／reset 讀值不作新證據。受控清空與 simulation 共用鎖序；保存 task 關聯 simulated collection，獨立真實作業時序，不用 simulated_at 比較 arrived_at。
- 模擬清空同時保存 simulation_at／generation 與真實 observed_at／received_at。既有 history 的 recorded_at 仍為模擬時間，TaskReading 使用真實觀測時間；歷史依模擬輪次畫圖，工作證據依真實時間驗證，不互相比較兩個時鐘。新 migration 對舊紀錄 received_at 保留 null。
- demo-clear 以鎖內當下 simulated_at 將模擬狀態歸零、重設積分基準；之後明確 advance 從 0 按新模擬時間增長，reset 只歸零開始新輪次。各寫入用遞增的 observation sequence 決定最新狀態，不以不同時鐘 timestamp 排序；模擬不覆寫 iot_sensor 狀態，也不改營運狀態。此狀態選值與 /bins current_usage 共用，避免兩種 API 滿度不一致。
- demo-clear 回 0% 不代表 completed；回應 work_order 可為 arrived 或 waiting_sensor，條件齊備才 completed。TaskReading 與其他 reading 共用來源標記，既有 history 能查到，但只有明確 task 關聯可滿足結案。
- 某事件已終局查證後有新市民回報，仍掛同一開啟事件；若工作要完成，必須連這筆一起查證。關閉與新回報並行由事件鎖處理。

Report 回應範例：

```json
{
  "id": "30000000-0000-4000-8000-000000000001",
  "bin_id": "10000000-0000-4000-8000-000000000001",
  "event_id": "40000000-0000-4000-8000-000000000001",
  "work_order_id": "50000000-0000-4000-8000-000000000001",
  "type": "full",
  "description": "垃圾已接近投入口。",
  "created_at": "2026-10-19T08:00:00Z",
  "status": "pending",
  "adopter": false,
  "first_reporter": true,
  "quick": false,
  "photo_ids": [
    "20000000-0000-4000-8000-000000000001"
  ],
  "accepted_at": null,
  "reviewed_at": null,
  "rejection_reason": null,
  "pending_points": 1,
  "awarded_points": 0,
  "settled_at": null,
  "rule_version": "phase1-2026-10-19",
  "event_status": "open",
  "work_status": "pending",
  "assignment_status": "assigned",
  "waste_type": "general",
  "classification_source": "demo_assumption"
}
```

## 7. 會員與兌換

| Method／path | 權限 | Request／Query | Response |
| --- | --- | --- | --- |
| GET /me/membership | U | 無 | Membership |
| GET /me/point-entries | U | limit/offset，created_at DESC | Page<PointEntry> |
| GET /rewards | P | category=all/coupon/grand（預設 all）、limit/offset | Page<Reward> |
| POST /redemptions | U | `{reward_id:UUID}` | 201 RedeemResult |
| GET /me/redemptions | U | limit/offset，created_at DESC | Page<Redemption> |
| GET /redemptions/{id} | U（本人） | 無 | Redemption |

POST 兌換不接受 client cost／stock／points，伺服器再次檢查並原子扣除。所有券碼明示 DEMO，無正式兌換／核銷能力。不實三次不阻擋合法兌換。新帳號餘額預設 0，展示贈點由 seed 以台帳明列。

## 8. 提案、投票、評估與命名

| Method／path | 權限 | Request／Query | Response |
| --- | --- | --- | --- |
| GET /proposals | P（可帶 session） | district=大安區、status、limit/offset，created_at DESC | Page<Proposal> |
| GET /proposals/{id} | P（可帶 session） | 無 | Proposal＋ETag |
| GET /me/proposals | U | limit/offset | Page<Proposal> |
| GET /me/votes | U | limit/offset，最後投票時間 DESC | Page<Proposal>（僅 my_vote 非 null） |
| GET /me/proposal-quota | U | 無 | ProposalQuota |
| POST /proposals | U | ProposalCreate（下方） | 201 ProposalCreateResult |
| POST /proposals/{id}/vote | U | `{vote:"support"|"oppose"|null}` | Proposal |
| POST /admin/proposals/{id}/review | A，V | `{action:"village_approve"|"evaluation_approve"|"survey_approve"|"decline",reason:string|null}` | Proposal |
| POST /proposals/{id}/name-requests | U（原提案者），V | `{name:string}` | Proposal |
| POST /admin/proposals/{id}/name-review | A，V | `{approve:boolean,reason:string|null}` | Proposal |

```json
{
  "name": "示範路口新增點",
  "reason": "希望進一步評估通行與垃圾需求。",
  "latitude": 25.033,
  "longitude": 121.5358,
  "confirmed_nearby": true
}
```

- name 1..200、reason 1..500。第一版以保存的官方大安區多邊形驗證，不把前端 demoBounds 矩形當行政邊界；district 後端決定，區外回 422 且不扣額度。既有十點 seed 的區外警告維持，不移動／刪除。
- confirmed_nearby 只在 50m 內已有提案時需要 true，否則 409 並以 fields 指示；150m 內已設置桶只是 warnings，不禁止建立。
- 原子建立 Bin(proposed, pending_review, source_type=user_proposal)、Proposal、自動支持票；同一 key 不重建。每人台北曆月最多 3 筆成功建立，不因 decline 返還額度。
- collecting 允許支持／反對／撤票；相同票為 no-op。total<60 維持 collecting；>=60 且 ratio>=0.6→evaluation，否則→village；達標後不再接受改撤票。支持率以精確票數判斷，不以顯示四捨五入值判斷。
- village_approve 僅 village→evaluation；evaluation_approve 僅 evaluation→survey；survey_approve 僅 survey→installed；decline 適用 village/evaluation/survey，reason 必填。不提供跳關、重開或任意改票數 API。
- 展示 survey_approve 同時將 Bin placement_status 設 installed、installed_at=真實 UTC，保留 bin_type=proposed、feasibility_status 的審查結果及 is_demo=true。只在展示環境表達模擬設置，不自動影響正式地理資料。
- 命名僅原提案者、installed、無 pending 時可送，1..30；退回可重送。審查拒絕 reason 必填，舊 approved_name 保留；核准才更新 Bin 公開名稱，原提案 name 及審查歷史保留。第一版不公開其他市民個資或逐票名單。

## 9. 認養

| Method／path | 權限 | Request／Query | Response |
| --- | --- | --- | --- |
| POST /adoptions | U | AdoptionCreate（下方） | 201 Adoption |
| GET /me/adoptions | U | status、limit/offset，created_at DESC | Page<Adoption> |
| GET /adoptions/{id} | U（本人）／A | 無 | Adoption＋ETag |
| POST /adoptions/{id}/withdraw | U（本人），V | `{}` | Adoption |
| POST /adoptions/{id}/end | U（本人），V | `{reason:string}` | Adoption |
| PATCH /adoptions/{id}/preferences | U（本人），V | 完整 Preferences | Adoption |
| GET /adoptions/{id}/monthly-summary | U（本人） | month=YYYY-MM（預設台北本月） | AdoptionMonth |
| GET /admin/adoptions | A | status、district、limit/offset | Page<Adoption> |
| POST /admin/adoptions/{id}/review | A，V | `{decision:"active"|"rejected",reason:string|null}` | Adoption |

```json
{
  "bin_id": "10000000-0000-4000-8000-000000000001",
  "role": "店家",
  "display_name": "示範店家",
  "intro": "附近店家，一起照顧環境。",
  "preferences": {
    "full": true,
    "dumping": true,
    "dirty": false
  }
}
```

display_name 1..50，intro<=120、非店家須空字串；preferences 全部必填，允許全 false。pending 無權益，不阻止別人申請；同人同桶 pending/active 不可重複，Bin 已 active 則拒絕。核准需再次檢查 Bin 已設置／未撤除及唯一 active。

pending→active/rejected/withdrawn；active→ended。rejected reason 必填，end reason 可空（<=500）；結束／撤除立即關閉通知偏好，歷史保留。月報只計該使用者在該認養有效期間送出的真實紀錄，點數按結算時間歸月；沒有資料回 0，不填前端固定示意統計。不實停權不阻擋申請、投票或提案。

## 10. 通知、按讚、路線及成果

| Method／path | 權限 | Request／Query | Response |
| --- | --- | --- | --- |
| GET /me/notifications | O | unread_only=false、limit/offset，created_at DESC | Page<Notification> |
| POST /me/notifications/{id}/read | O（本人） | `{}` | Notification |
| POST /completions/{id}/like | U | `{}` | Cleanup |
| GET /staff/route-stops | S | 無 | RouteStops |
| GET /staff/statistics | S | month=YYYY-MM，district 限責任區 | StaffMonth |
| GET /public/outcomes | P | month=YYYY-MM，district=大安區 | PublicOutcomes |

read 重複不改第一次 read_at。like 僅該桶最新有效 full/dirty/dumping Completion，已讚返回相同資源，不撤讚；repair/dismissed 不列可讚成果。API 同時驗證最新性，舊頁面不可替舊成果新增讚。

route-stops 依工單優先度，排除 completed/dismissed/repair/waiting_sensor、撤除／未設置，保留各 work_order_id，同桶合站。origin 固定大安森林公園展示起點，無隊員 GPS。回傳空 stops 合法。**不新增道路計算 API**，前端現有 Valhalla 指引可沿用；此 API 無最佳化、無導航語音／即時交通。

站內通知在相應業務 transaction 建立：查證結果、工單分派／完成、提案／認養異動；認養 alert 僅 active 且勾選偏好，full 為有效讀值首次跨入 >=80 的事件，dirty/dumping 為新事件，同事件不重發。只讀值反覆 GET 不產生通知，不提供 LINE 發送。

## 11. 最小串接流程

1. `POST /auth/demo/login` 取得 token；`GET /me` 確認角色。token 到期重新登入。
2. 地圖 `GET /map/locations`；最近三桶 `GET /map/nearest-usable`；點桶讀 `/bins/{id}/view`、既有 `/bins/{id}/history`。
3. 回報先 `POST /media`，再 `POST /reports`；使用回傳 report.id 導到案件頁，不使用 Bin ID 當回報 ID。
4. 隊員讀工單詳情取得 ETag；依 accept→重新讀／使用新 ETag→arrive→逐筆 review→掛照片→finish 操作。
5. 如為 full，受控管理操作 demo-clear；照片與清空可先後到達。若 waiting_sensor，輪詢詳情取得最新狀態（建議前景每 10 秒，背景停止），讀取本身不推進模擬。
6. 市民重讀 report／membership／point-entries，approved 可以與 waiting_sensor 同時存在。每次命令成功後更新相關 view，不由前端自行發點。
7. 兌換使用伺服器 reward.id 與新 key，成功以 RedeemResult 更新餘額及庫存。
8. B flow 查 quota／proposals，建立後直接使用後端回傳的票數與 bin_id；認養核准後再讀 BinView。

命令 header 範例：

```http
POST /api/v1/staff/work-orders/50000000-0000-4000-8000-000000000001/arrive
Authorization: Bearer <staff-session-token>
Content-Type: application/json
Idempotency-Key: 70000000-0000-4000-8000-000000000001
If-Match: "v2"

{}
```

重試同一次操作保留 key 與原 body；使用者確認後的不同操作換新 key。成功後從新 ETag／version 更新。前端不可對失敗的 POST 自動產生新 key 重送。

## 12. 前端頁面及欄位對照

| 頁面 | 資料來源／命令 |
| --- | --- |
| P1 | auth/demo/login、auth/session、me；手機固定碼屬舊展示 UI，非後端 OTP。 |
| P2 | map/locations、map/nearest-usable；locations 靜態快照改由前端資料層接此契約。 |
| P3 | bins/{id}/view、既有 history、completions/{id}/like。 |
| P4 | BinView 可用性、nearest-usable；市民步行指引仍為現有展示，不宣稱真實道路。 |
| P5／P6 | media、reports；獎勵預覽讀 pending_points，不自行判首報。 |
| P7 | reports/{id}，同時呈現 status、work_status、awarded_points。 |
| P8 | me/membership、me/point-entries、me/reports。 |
| P9 | rewards、redemptions、me/redemptions。 |
| P10 | map/availability；不帶 UI filter，不把 place／未設置 proposed 當既有桶。 |
| P11／P12 | proposals、proposal vote、me/proposal-quota。 |
| P13 | me/proposals、me/votes、proposal 詳情／name-requests；審查控制只能使用 admin。 |
| P14／P15 | adoptions、me/adoptions、monthly-summary、preferences／withdraw／end。 |
| P16 | 同 P5 reports API，quick=true；不另建立重複回報邏輯。 |
| P17 | me/notifications，target.kind/id 由前端轉成 hash，不把 hash 存 DB。 |
| P18／P19 | staff/work-orders 列表、詳情及狀態命令。 |
| P20 | staff/route-stops；保留前端現有車種及 Valhalla 請求。 |
| P21 | 工單詳情的 completion_id、狀態及證據；route-stops 取下一站。 |
| P22／市民榮譽榜 | staff/statistics／public/outcomes；不混用公開與私有資料。 |

| 前端目前欄位／算法 | API 對應／串接注意 |
| --- | --- |
| LocationRecord.kind／label／longitude／latitude／來源 | Location 同名，保留 bin/place；reported_count 不展開成桶。 |
| binDemo.capacity | BinStatus.fill_level_pct；百分比，**不是 capacity_liters**。 |
| binDemo.state | fill_status，維修／撤除依 operational_status 呈現。 |
| binDemo 新設／撤除／認養 UUID hash | 改讀 installed_at／removed_at／adopter，不沿用雜湊虛構狀態。 |
| DemoReport.locationId／createdAt／firstReporter／eventId | bin_id／created_at／first_reporter／event_id。另讀 work_order_id，不能再把 eventId 當 task.id。 |
| DemoReport.adopter／quick／type／status | 同名語意；adopter 是提交時資格快照，不由 client 指定。 |
| DemoReport.photo:boolean | photo_ids 非空；提交前先上傳，不能傳 photo:true 當證據。 |
| WorkOrder.locationId／acceptedAt／clearReadingId 等 | bin_id／accepted_at／clear_reading_id；其餘 camelCase→snake_case。 |
| WorkOrder.fixture／historical | is_fixture；不支援無證據 historical 基數加成。 |
| BinReading.capacity／observedAt／receivedAt／taskId | fill_level_pct／observed_at／received_at／work_order_id。 |
| Proposal.vote | my_vote；support／oppose 已含本人，前端不再 +1。 |
| Proposal.pendingName／approvedName／nameStatus | pending_name／approved_name／name_status。 |
| Adoption.locationId／displayName | bin_id／display_name；role 保留四個中文 enum，通知 key full/dumping/dirty 同名。 |
| Member 累積／可用／待確認＋固定63／48 | Membership 明確欄位；移除固定加成。 |
| Reward／Redemption.rewardId | 後端 UUID／reward_id；靜態商品 ID 對應 code，不能自行送 cost。 |
| completionLikes:string[] | Cleanup.liked_by_me／like_count，寫入使用 completion.id。 |
| localStorage／Web Locks | 不再作業務資料真相；後端 transaction／冪等負責跨裝置一致性。 |

## 13. 變更管理及範圍

本文件描述已部署的雙種類程式（0006）。Pydantic／OpenAPI及契約測試驗證欄位、狀態碼、headers及auth；未列的刪除、任意修正點數、翻案、重開結案、多人搶單轉派、真實 IoT ingestion、外部訊息或正式派工未加入。

實作若發現契約不能安全沿用，先在文件記錄具體差異及相容方案，再調整；不可默默把某個 enum／單位／source_type 改成另一種語意。前端目前仍可獨立展示，本次未對其程式作任何變更。

## 14. 雙種類API的共通增補

詳見 [WASTE_STREAMS.md](WASTE_STREAMS.md)。Bin列表／詳情／GeoJSON／優先清單、map三個入口與BinView新增waste_type（預設general）；history預設全部，可篩general、recycling、legacy_unknown。ReportCreate新增waste_type（預設general），報告／工單／成果／通知回傳種類。我的回報、工單清單、route-stops、staff/statistics與public/outcomes可選種類，不帶則兩種合併。清運只操作指定槽，工單demo-clear依工單種類，不接受任意指定另一槽。提案／認養仍依點位，不為兩種重複建立。
