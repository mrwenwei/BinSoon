# 前端串接指南：從地圖到回報、工單與提案

這份文件供前端工程師直接開始串接。前端 A／B／D 畫面目前仍使用靜態資料及 localStorage；後端已提供持久化 API，本次沒有修改前端。詳細欄位及限制見 [API 契約](API_CONTRACT.md)，每一個 endpoint 的參數、必填欄位、回應型別見 [API Reference](API_REFERENCE.md)。

## 1. 連線資訊與先決條件

| 項目 | 值 |
| --- | --- |
| Cloud Run Origin | `https://binsoon-api-887203439341.asia-east1.run.app` |
| API Base URL | `https://binsoon-api-887203439341.asia-east1.run.app/api/v1` |
| Swagger | [開啟 Swagger](https://binsoon-api-887203439341.asia-east1.run.app/docs) |
| 線上 OpenAPI | [openapi.json](https://binsoon-api-887203439341.asia-east1.run.app/openapi.json) |
| 本機 | `http://localhost:8000/api/v1` |
| 已允許的開發來源 | `http://localhost:5173`、`http://127.0.0.1:5173` |
| 展示帳號 | 市民 `demo-citizen`、隊員 `demo-staff`、管理員 `demo-admin` |

密碼由後端維運私下提供，不能放進 Git、前端 bundle 或 `VITE_*`。部署結果以 [部署紀錄](DEPLOYMENT_STATUS.md) 最新章節為準。若前端使用其他 port／網域，提供完整 origin（協定、主機、port）給後端加入 CORS；不能僅改 API URL 解決瀏覽器 CORS。

可以將 API Base URL 放入 `VITE_API_BASE_URL`；這是公開連線設定，不含憑證。直接開 Swagger 可先測試流程，再接畫面。Cloud Run 會縮到零，首次呼叫可能較慢。

## 2. 前端需要先改的資料層

1. 建立共用 API client；保留後端 snake_case 或在單一 adapter 轉 camelCase。
2. 所有實體 ID 使用後端 UUID。`bin_id`、`report.id`、`event_id`、`work_order_id`、`proposal.id`、`media.id` 各自不同，勿互換；畫面上的 TP-xxx 只作顯示碼。
3. 地圖讀 `/map/locations`；點位詳情讀 `/bins/{id}/view`；歷史用 `/bins/{id}/history`。場所 `kind=place` 不能當可投垃圾的桶。
4. 移除 localStorage 中自行建立案件、判首報、加點、投票加一與假統計的邏輯。畫面以 command 回應和後續 GET 為準；不匯入舊展示資料。
5. 訪客可看地圖／提案；登入後重讀帶有 `mine`、`my_vote`、`can_report` 等個人化投影的資料。登入者相關 query cache 必須依 user.id 分開，登出清除。

所有滿度目前都是 `simulated`，容量及垃圾量為合成假設。未設置 proposed 必須標示「建議點／待現勘」，不能顯示為可用桶或實測 IoT。

## 3. 共用 fetch：認證、錯誤、重試與版本

以下是可複製到前端資料層調整的 TypeScript 範例；本文件不新增前端檔案。`request` 同時回傳 data 與 ETag，避免工單連續操作時沿用舊版本。

```ts
const API = import.meta.env.VITE_API_BASE_URL
  ?? 'https://binsoon-api-887203439341.asia-east1.run.app/api/v1';

type ApiFailure = {
  code: string; message: string;
  fields: { field: string; code: string; message: string }[];
  request_id?: string;
};
class ApiError extends Error {
  constructor(public status: number, public detail: ApiFailure) {
    super(detail.message);
  }
}
type Result<T> = { data: T; etag: string | null; replayed: boolean };
type Options = {
  method?: string; token?: string; body?: unknown;
  key?: string; etag?: string; signal?: AbortSignal;
};
async function request<T>(path: string, o: Options = {}): Promise<Result<T>> {
  const headers = new Headers();
  if (o.token) headers.set('Authorization', `Bearer ${o.token}`);
  if (o.key) headers.set('Idempotency-Key', o.key);
  if (o.etag) headers.set('If-Match', o.etag);
  const isForm = o.body instanceof FormData;
  if (o.body !== undefined && !isForm) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, {
    method: o.method ?? 'GET', headers, signal: o.signal,
    body: o.body === undefined ? undefined
      : isForm ? o.body as FormData : JSON.stringify(o.body),
  });
  const payload = response.status === 204 ? undefined : await response.json();
  if (!response.ok) {
    // 舊 bins/simulation API 的 detail 可能是字串或 FastAPI 陣列。
    const d = payload?.detail;
    throw new ApiError(response.status,
      d && typeof d === 'object' && !Array.isArray(d)
        ? d : { code: 'HTTP_ERROR', message: typeof d === 'string' ? d : '請求失敗', fields: [] });
  }
  return { data: payload as T, etag: response.headers.get('ETag'),
    replayed: response.headers.get('Idempotency-Replayed') === 'true' };
}
```

新產品 POST／PATCH 命令都要 `key: crypto.randomUUID()`，登入／上傳除外。**key 在使用者按下確認時建立一次**，網路失敗／逾時／未知是否成功時，原 key、body、ETag 一起保留重送；不要在 retry callback 裡重新產生 key。相同 key 不同 body 回 409。DELETE logout 不需要 key。

工單、提案審查／命名、認養更新及撤除桶還要 `If-Match`。先 GET 詳情取得 `ETag: "vN"`，成功後換成 response.etag。新版 JSON 中的 version 也可組成 `"v${version}"`；不要將 WorkDetail 根物件當成 WorkOrder（在 `work_order.version`）。查證回報使用工單的 ETag。

| 狀況 | 畫面行為 |
| --- | --- |
| 401 | token 過期或失效，保留表單、重新登入；沒有 refresh token。 |
| 403 | 顯示無權限；不實三次只暫停回報，不封鎖其他市民功能。 |
| 404 | 找不到／無權看私有資料；不要猜測其他使用者 ID。 |
| 409 | 顯示 detail.code/message，重讀相關資料；勿自動重送業務命令。 |
| 412／428 | GET 更新詳情及 ETag，讓使用者重新確認；確認後建立新命令 key。 |
| 422 | 顯示 fields 的欄位錯誤及 message。 |
| 429 | 依 response Retry-After 等候；登入不要無限自動重試。 |
| 503 | 功能暫不可用，保留輸入，不顯示成功。 |
| 網路失敗／5xx | GET 可有限次重試；命令保留同 key，不因逾時斷定未成功。 |

## 4. 登入、登出與角色

```ts
type Session = {
  access_token: string; token_type: 'bearer'; expires_at: string;
  user: { id: string; display_name: string;
    roles: ('citizen'|'staff'|'admin')[]; districts: string[]; auth_source: 'demo' };
};
const { data: session } = await request<Session>('/auth/demo/login', {
  method: 'POST', body: { account: 'demo-citizen', password: passwordFromLoginForm },
});
const token = session.access_token; // 建議存在記憶體；不要 console.log。
await request('/me', { token });
// 登出時：await request<void>('/auth/session', { method: 'DELETE', token });
```

登入回應 200，60 分鐘過期，登出 204 無 body。後端沒有手機 OTP／TaipeiPass；原前端固定 123456 不適用新 API。市民、隊員、管理員是不同身分，admin 不能代替 staff 接單或 citizen 投票。維運共享 Admin token 不交付一般市民前端。

## 5. P2–P4 地圖、可用桶與歷史

```http
GET /api/v1/map/locations?district=大安區&kind=all&limit=100&offset=0
GET /api/v1/map/nearest-usable?latitude=25.033&longitude=121.5358&limit=3
GET /api/v1/bins/{bin_id}/view
GET /api/v1/bins/{bin_id}/history?limit=100&offset=0
```

地圖回 `{items: Location[], page:{limit,offset,total}}`，一次最多 100；讀到 `offset + items.length >= total` 才完成，不能只畫第一頁。建議使用 URLSearchParams 編碼中文搜尋與座標；latitude／longitude 要一起送。起點存在時依距離排序，未送起點依 ID 排序。

桶況顏色讀 `bin_status.fill_status`：hungry <50%、half 50–<80%、full ≥80%、unknown 未知或營運不可用。導航讀 `is_usable`，不要單憑 fill 數字判定；維修／撤除／尚未設置均不能當可用桶。null 表示未知，不換成 0。

歷史 API 回**裸陣列**，不同於地圖 envelope；讀到不足 limit 結束。圖表 x=recorded_at、y=fill_level_pct，collection/reset 用事件標記。預設包含各輪模擬，若只看本輪先 GET `/simulation/status` 取 generation，再用 `?generation=N`；歷史時間是模擬時鐘，不能拿來比較實際回報時間。一般前端 GET 不會推進滿度。

要看所有建議點：`/map/locations?include_proposed=true` 或舊 `/bins?district=all&format=geojson`。GeoJSON 座標為 `[longitude, latitude]`；Leaflet LatLng 通常需要 `[latitude, longitude]`，須在 adapter 轉換。兩種回應 shape 不同，勿混用。

## 6. P5–P9 市民回報、查進度與點數

先以市民 session 上傳，再送回報：

```ts
const form = new FormData();
form.append('file', fileFromCamera);
form.append('purpose', 'report');
const { data: media } = await request<{ id: string }>('/media', {
  method: 'POST', token, body: form,
});
// 不手設 multipart Content-Type 或 Content-Length，瀏覽器會處理 boundary／長度。
const reportKey = crypto.randomUUID();
const { data: report } = await request<{
  id: string; bin_id: string; event_id: string; work_order_id: string|null;
  status: string; work_status: string|null; pending_points: number;
}>('/reports', {
  method: 'POST', token, key: reportKey,
  body: { bin_id: selectedBin.id, type: 'full', description: '投入口已滿',
    photo_ids: [media.id], position: currentPosition, quick: false },
});
// 導向回報詳情時使用 report.id；不要使用 bin_id 或 event_id。
```

照片限制：一張 JPEG／PNG／WebP，最多 5 MiB、2000 萬像素，單幀；總 request 最多 6 MiB。後端去 EXIF 並轉 JPEG。position 是 `{latitude:number,longitude:number}`，距離桶須 ≤50m；type 可 full／dirty／dumping／broken／other，other 必填 description。市民不能送 first_reporter/adopter/user_id/status。

`POST /reports` 新建 201，同一人同一開啟事件已回報則 200 既有案。UI 兩者皆導向回傳案件。回報成功後重讀：

| 資料 | API | 用法 |
| --- | --- | --- |
| P7 進度 | GET `/reports/{report.id}` | 同時顯示 status（查證）與 work_status（處理）。 |
| 回報清單 | GET `/me/reports?limit=20&offset=0` | 可篩 status、bin_id。 |
| P8 會員 | GET `/me/membership` | cumulative_points／available_points／pending_points 各有不同意義。 |
| 點數台帳 | GET `/me/point-entries` | 顯示伺服器 amount／balance_after，不自行推算。 |
| P9 獎品 | GET `/rewards?category=all` | 以 UUID reward.id 下單；code 對照靜態展示商品。 |
| 兌換 | POST `/redemptions`，`{reward_id}`＋key | 201 回 redemption、membership、reward，一起更新。 |
| 兌換紀錄 | GET `/me/redemptions`、`/redemptions/{id}` | voucher_code 是展示券，非可核銷真實獎品。 |

首報查證 approved 才入帳 +1，提交時具認養資格 +2；後續同事件回報 approved 可為 0。**查證成功與工單完成是兩回事**；approved＋waiting_sensor 合法。顯示 pending_points/awarded_points，不以「已接單／已清空」推算點數。區外回報保留，但 work_order_id=null、assignment_status=unassigned。

照片展示先帶 session GET `/media/{media.id}/access` 取得 `{url,expires_at}`，再把 url 放 `<img src>`；URL 有效約 5 分鐘，過期重新取得。不把私有 URL 當永久檔案位置，也不把後端 session 附加給 GCS。

## 7. P18–P22 隊員：接單到完成

隊員登入 demo-staff，責任區大安區。這些命令均需要新 key 與工單最新 ETag。

| 順序 | 呼叫 | body／回應重點 |
| --- | --- | --- |
| 1 | GET `/staff/work-orders?bucket=pending` | Page<WorkOrder>；bucket 另有 processing/completed/all。 |
| 2 | GET `/staff/work-orders/{id}` | WorkDetail；保存 header ETag。 |
| 3 | POST `.../accept` | `{}` → WorkOrder，保存新 ETag。 |
| 4 | POST `.../arrive` | `{}` → WorkOrder，表示已到場。 |
| 5 | POST `.../reports/{report_id}/review` | `{decision:"approved",reason:null}`；rejected 須原因。逐筆處理 reports。 |
| 6 | POST `/media` | purpose=completion，**到場後**才上傳完工照片。 |
| 7 | POST `.../evidence` | `{media_id,purpose:"completion"}` → WorkDetail。 |
| 8 | POST `.../finish` | `{}` 或 `{reason:null}` → WorkOrder。full 缺新清空回 waiting_sensor。 |
| 9 | GET 工單詳情 | 根據 completion_requirements.missing 顯示還缺什麼，完成時 status=completed。 |

完成照、查證、清空可不同順序到達，但須先接單並到場；未 submit finish 不會僅靠照片自動完成。工單每個子命令都更新 version。逐筆查證不要平行送，否則相同 ETag 將衝突。

```ts
// 示範一個版本化命令；不同操作的 key 不共用。
const workId = selectedWork.id;
const detail = await request(`/staff/work-orders/${workId}`, { token: staffToken });
if (!detail.etag) throw new Error('缺少 ETag，請重新取得工單');
const accepted = await request(`/staff/work-orders/${workId}/accept`, {
  method: 'POST', token: staffToken, key: crypto.randomUUID(),
  etag: detail.etag, body: {},
});
// 下一個 arrive 需 accepted.etag，不是 detail.etag。
```

滿桶展示清空由**管理員** GET `/admin/work-orders/{id}` 取得 ETag，再 POST `/admin/work-orders/{id}/demo-clear`，body `{reading_id:crypto.randomUUID()}`，同樣有 key。這是展示感測回傳，非真實 IoT。舊 `/bins/{id}/collect` 歸零不構成工單結案證據；simulation reset 也不會清空案件、點數或會員。

dirty/dumping/other 不等清空讀值；broken 可 `defer-repair`（必填 reason）留待修繕，不計完工；不需處理用 site 照＋`dismiss`（必填 reason）關閉，不產生成果。不要將 dismissed 當 completed 計件。

P20 GET `/staff/route-stops`，stops 含 bin_id 和多個 work_order_ids；同桶可合站但案件不能合併。道路計算沿用前端 Valhalla。P22 GET `/staff/statistics?month=2026-10`；公眾榜用 `/public/outcomes`，不填本機假歷史基數或發真實加給。等待更新建議前景每 10 秒 GET，切背景停止，離開頁面 abort。

## 8. P10–P13 提案、投票與命名

1. 讀 `/me/proposal-quota`：台北曆月最多 3 案；`/map/availability?latitude=...&longitude=...` 檢查半徑 300m，勿帶地圖篩選。
2. POST `/proposals`，body `{name,reason,latitude,longitude,confirmed_nearby:false}`＋key。50m 內已有提案時回 409 NEARBY_PROPOSAL，讓使用者確認為不同需求後以 true 送新操作；150m 內已有設置桶則成功回 warnings，不擋建立。實際大安區多邊形驗證，區外 422，不能改座標以假裝通過。
3. 201 回 `{proposal,quota,warnings}`。新增案已有自己的支持票，不再補送 +1；proposal.id 是提案 ID，proposal.bin_id 是新建 proposed 桶 ID。
4. 清單 GET `/proposals`，詳情 GET `/proposals/{id}`，我的 GET `/me/proposals`、`/me/votes`。
5. POST `/proposals/{id}/vote`＋key，body `{vote:"support"}`／`"oppose"`／`null`（撤票）；回應票數已含本人，support_ratio 為 0..1。
6. ≥60 人後自動關投票，支持率 ≥60%→evaluation，否則 village；由管理員 review，不能由市民改 status。
7. 管理員 GET 詳情 ETag，再 POST `/admin/proposals/{id}/review`＋key＋ETag，action 依次 village_approve／evaluation_approve／survey_approve，或 decline＋reason。合法狀態與 action 見 API 契約；不跳關。
8. 已示範設置後原提案人 POST `/proposals/{id}/name-requests` `{name}`＋key＋ETag，管理員 `/admin/proposals/{id}/name-review` `{approve:true,reason:null}`。待審時保留舊 approved_name。

後端不提供任意加 60 票 endpoint。單一帳號展示需後端維運執行明示 fixture CLI，不能用前端按鈕自己造票。十個既有模型推薦點是建議 Bin，與市民 Proposal 分開；不會自動出現在 `/proposals` 投票清單。示範設置保留 is_demo=true。

## 9. P14–P17 認養、快捷通報與通知

POST `/adoptions`＋key：

```json
{
  "bin_id": "10000000-0000-4000-8000-000000000001",
  "role": "居民",
  "display_name": "巷口守護者",
  "intro": "",
  "preferences": {"full": true, "dumping": true, "dirty": false}
}
```

上述 UUID 僅示例，請換成 GET 的真實 bin.id。role 是中文 enum：居民／店家／學校／社區團體；僅店家可填 intro。201 初始 pending，待審沒有權益。管理員 `/admin/adoptions` 查待審，GET `/adoptions/{id}` 取 ETag，POST `/admin/adoptions/{id}/review` `{decision:"active",reason:null}`＋key＋ETag 核准。同桶最多一個 active。

我的認養 GET `/me/adoptions`；月報 GET `/adoptions/{id}/monthly-summary?month=2026-10`。偏好 PATCH `/adoptions/{id}/preferences`（三個 boolean 都送），pending 撤回 POST `.../withdraw` `{}`，active 結束 POST `.../end` `{reason:null}`，皆 key＋ETag。每次更新後重新讀 BinView 的權益與 adopter。

P16 快捷通報仍 POST `/reports`，只是 quick=true；仍須照片、位置和 active 認養，不能僅靠前端切開關取得 +2。P17 GET `/me/notifications?unread_only=true`；target.kind/id 對應 report/work_order/proposal/adoption 的前端 route，POST `/me/notifications/{id}/read` `{}`＋key 標已讀。只有站內通知，沒有 LINE／推播。

## 10. 對接完成的驗收清單

- 訪客地圖載入所有分頁，bin/place 分開；點桶可看目前滿度與真實保存的模擬歷史。
- 登入失效／登出清除個人 query cache；市民、隊員、管理員分別用正確身分。
- 同一回報連點／斷網重送同 key，不新增重複案；成功後刷新清單及會員。
- 工單每步使用新 ETag；兩頁同時操作時 412 有可理解的重新整理提示。
- approved 立即結算，waiting_sensor 正確等待；清空、完工照、到場與全查證皆滿足才完成。
- 照片可上傳、私有短效 URL 可顯示、過期能重取；其他使用者不能看私照。
- 提案／票數／認養／兌換由後端回應決定；刷新頁面仍保留，沒有 localStorage 假資料混入。
- 一般市民無法呼叫 staff/admin 命令；所有 proposed／simulated／demo 都保留標記。

既有 API 格式保留，詳見 [統一 Bin 手冊](BINS.md)。完整 P1–P22 與 camelCase 對照見 [API 契約第 12 節](API_CONTRACT.md#12-前端頁面及欄位對照)。

本輪移除舊GET／POST `/candidates`，現回404；前端不要接這兩個入口。市民提案依第8節POST `/proposals`，維運直接POST `/bins`不經提案流程。其餘舊入口分類與全部70個操作見 [API全覽](API_INVENTORY.md)。
