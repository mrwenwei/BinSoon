# API 全覽與舊入口整理

2026-10-19，依目前router、OpenAPI、前端原始碼與驗收腳本盤點。依使用者確認已移除兩個candidates操作，目前共 **68 paths／70 operations**，同路徑GET／POST分別計算。以下省略 `/api/v1`，`/health`例外。

「現階段不需要串接」依A／B／D流程判斷，不代表已從線上access logs證明零流量。前端目前僅有道路路線的外部fetch，尚未串接本後端，因此不能把「前端尚未呼叫」當作API可刪除的依據。

## 1. 舊API的結論

原有16個operation中，2個已移除；剩下14個為6個資料／維運入口與8個持續使用入口。另有56個新增產品API。已移除的GET／POST `/candidates`均回404，不出現在OpenAPI；既有Bin及歷史不刪除，也無DB migration。

| 舊入口 | 現階段建議 | 替代／保留理由 |
| --- | --- | --- |
| GET /bins | 畫面優先用新版；保留資料／GeoJSON入口 | `/map/locations`提供畫面篩選、分頁及營運可用性；舊入口仍有GeoJSON、scenario_id及原始追溯資訊用途。 |
| GET /bins/{bin_id} | 畫面改用 `/view`；保留原資料查詢 | `/bins/{bin_id}/view`額外提供可用性、認養、最近清運成果及可執行動作；不是相同response。 |
| GET /hotspots | 地圖可改用新版；保留資料入口 | `/map/locations?kind=place`可服務地圖，舊入口保留來源欄位及原response；場所不是桶。 |
| POST /bins | 移至維運用途 | 市民應用POST `/proposals`，它會同時建立proposed Bin、提案、額度及首張支持票。直接POST Bin不會建立這些產品流程。 |
| POST /bins/{bin_id}/collect | 只保留獨立模擬工具用途 | 單純歸零與歷史紀錄，不滿足工單清空證據；工單展示用 `/admin/work-orders/{id}/demo-clear`。兩者作用範圍不同。 |
| GET /bins/collection-priorities | 不接目前隊員工作清單；保留分析用途 | 按滿度風險排桶；目前派工畫面用 `/staff/work-orders`與`/staff/route-stops`，同時考慮事件種類、任務狀態等。不是等價排序。 |
| GET /bins/{bin_id}/history | **持續使用** | 新版沒有重複的history endpoint；既有／新增Bin均用相同UUID查歷史。 |
| GET /simulation/status | 展示／維運保留 | 讀時鐘、generation及seed；歷史曲線可用generation選單輪。 |
| POST /simulation/seed | 展示初始化保留 | 冪等匯入十個固定模型建議點；不是市民提案或帳號seed。 |
| POST /simulation/advance | 展示控制保留 | 明確推進模擬時間，目前GET及前端timer不會推進。 |
| POST /simulation/pause | 展示控制保留 | 暫停模擬時鐘；不是暫停業務API。 |
| POST /simulation/resume | 展示控制保留 | 恢復模擬時鐘；目前沒有自動按牆鐘持續運行。 |
| POST /simulation/reset | 展示控制保留 | 開新generation，保留舊歷史；不清會員、工單、點數或認養。 |
| GET /health | 維運保留 | 資料庫連線健康檢查，無 `/api/v1`前綴。 |

六個「畫面不必串」入口尚未標deprecated；本輪保留用途及既有契約，不一併刪除。讀建議點用 `/bins?bin_type=proposed`或地圖 `include_proposed=true`；建立市民提案用POST `/proposals`，維運直接建桶用POST `/bins`。

## 2. 新增產品API全覽（56個）

權限：P公開，U市民，S隊員，A管理員，O任意登入角色。P可選帶個人session以取得本人狀態。S受責任區／接單者限制；私有單筆還須資源授權。完整限制見 [API契約](API_CONTRACT.md)。

### 身分與照片（5）

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| POST | /auth/demo/login | P | 展示帳號登入，取得60分鐘session。 |
| DELETE | /auth/session | O | 登出並撤銷session。 |
| GET | /me | O | 目前登入者、角色及責任區。 |
| POST | /media | O | 上傳照片；report須U、completion/site須S。 |
| GET | /media/{media_id}/access | O | 授權後取得私有照片短效網址。 |

`auth/demo/login`目前必需，但未來正式身分驗證上線後應替換展示登入；目前沒有真實OTP或TaipeiPass。

### 地圖、桶詳情與撤除（6）

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| GET | /map/locations | P | 地圖主入口：桶／場所、篩選、分頁及桶況。 |
| GET | /map/nearest-usable | P | 找最近可使用桶。 |
| GET | /map/availability | P | 提案前的300m周邊已設置桶及提案檢查。 |
| GET | /bins/{bin_id}/view | P | 桶詳情主入口：狀態、認養、成果及本人權益。 |
| GET | /bins/{bin_id}/lifecycle | A | 撤除操作前取得生命週期及ETag。 |
| POST | /admin/bins/{bin_id}/lifecycle | A | 管理員撤除桶並保留歷史。 |

### 市民回報（3）

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| POST | /reports | U | 一般或認養快捷回報。 |
| GET | /me/reports | U | 本人回報清單。 |
| GET | /reports/{report_id} | U／S／A | 有權限者查回報詳情與查證／處理進度。 |

### 隊員工單（11）

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| GET | /staff/work-orders | S | 待辦、處理中、已完成清單。 |
| GET | /staff/work-orders/{id} | S | 工單、回報、證據、完成條件及ETag。 |
| POST | /staff/work-orders/{id}/accept | S | 接單。 |
| POST | /staff/work-orders/{id}/arrive | S | 記錄到場。 |
| POST | /staff/work-orders/{id}/reports/{report_id}/review | S | 查證單一回報並依規則結算點數。 |
| POST | /staff/work-orders/{id}/evidence | S | 掛靠完工照或現況照。 |
| POST | /staff/work-orders/{id}/finish | S | 提交完成；滿桶可能先進入waiting_sensor。 |
| POST | /staff/work-orders/{id}/defer-repair | S | 註記待修繕。 |
| POST | /staff/work-orders/{id}/dismiss | S | 有證據及原因的不需處理結案，不計完工件數。 |
| GET | /admin/work-orders/{id} | A | 管理員讀工單及ETag，供展示清空。 |
| POST | /admin/work-orders/{id}/demo-clear | A | 明示展示清空讀值，帶工單關聯以滿足完成條件。 |

admin讀取工單與staff讀取雖然資料相近，但分屬不同授權角色；目前不是可直接刪除的舊重複入口。demo-clear將來可在真實IoT ingestion上線後退出正式環境，現在仍用於完整Demo。

### 會員、點數與兌換（6）

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| GET | /me/membership | U | 等級、可用／累積／待確認點數及回報資格。 |
| GET | /me/point-entries | U | 點數台帳。 |
| GET | /rewards | P | 展示獎品清單、庫存與點數需求。 |
| POST | /redemptions | U | 原子扣點／庫存，建立展示兌換紀錄。 |
| GET | /me/redemptions | U | 本人兌換清單。 |
| GET | /redemptions/{id} | U | 本人單筆展示券詳情。 |

### 提案、投票與命名（10）

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| GET | /proposals | P | 提案清單。 |
| POST | /proposals | U | 市民新增提案及對應proposed Bin。 |
| GET | /proposals/{id} | P | 提案、票數、進度及ETag。 |
| GET | /me/proposals | U | 本人提案。 |
| GET | /me/votes | U | 本人已投票提案。 |
| GET | /me/proposal-quota | U | 台北曆月三案額度。 |
| POST | /proposals/{id}/vote | U | 支持、反對或撤票。 |
| POST | /admin/proposals/{id}/review | A | 里長確認／評估／會勘示範審查。 |
| POST | /proposals/{id}/name-requests | U | 原提案者送命名申請。 |
| POST | /admin/proposals/{id}/name-review | A | 命名審核。 |

新增提案會產生Bin，Bin UUID與Proposal UUID不同。十個模型推薦Bin沒有自動變成可投票Proposal。

### 認養（9）

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| POST | /adoptions | U | 申請認養。 |
| GET | /me/adoptions | U | 本人認養清單。 |
| GET | /adoptions/{id} | U／A | 本人或管理員讀詳情與ETag。 |
| POST | /adoptions/{id}/withdraw | U | 撤回待審申請。 |
| POST | /adoptions/{id}/end | U | 結束有效認養。 |
| PATCH | /adoptions/{id}/preferences | U | 更新full／dumping／dirty通知偏好。 |
| GET | /adoptions/{id}/monthly-summary | U | 本人認養有效期間的月報。 |
| GET | /admin/adoptions | A | 管理員認養清單。 |
| POST | /admin/adoptions/{id}/review | A | 核准或拒絕認養。 |

### 通知、成果與路線（6）

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| GET | /me/notifications | O | 站內通知。 |
| POST | /me/notifications/{id}/read | O | 本人通知已讀。 |
| POST | /completions/{id}/like | U | 替該桶最新有效清運成果按讚。 |
| GET | /staff/route-stops | S | 隊員可處理站點；同桶合站，工單ID分別保留。 |
| GET | /staff/statistics | S | 完成件數、處理時間與月排名。 |
| GET | /public/outcomes | P | 公開月成果統計。 |

## 3. 文件與內部路由

以下不加入上述70個operation計數：

| Method／path | 說明 |
| --- | --- |
| GET /docs | Swagger互動文件。 |
| GET /redoc | ReDoc文件。 |
| GET /openapi.json | 機器可讀契約及型別產生來源。 |
| GET /api/v1/media/{media_id}/content | 隱藏於OpenAPI的本機照片ticket路由。前端使用access回傳的URL，不自行組合；Cloud Run使用GCS簽名URL。 |

舊 `/api/v1/demo/*` 已在統一Bin版本移除，不是本輪待清理的現存入口。維護模式 `app.maintenance:app` 是另一個部署入口，回503，不是日常業務API。

## 4. 本輪清理與後續建議

1. 前端依新入口接線，保留唯一的 `/bins/{id}/history`，不要再建立另一份history API。
2. **本輪已完成**：移除GET／POST `/candidates`、CandidateRead及專用距離／序列化helper；`scripts/check_deployment.py`改驗證舊路由404，選用寫入改為 `--create-bin`（POST /bins），真實HTTP測試覆蓋唯讀與新增流程。沒有沿用 `--create-candidate`舊旗標。
3. 將POST `/bins`、裸collect及simulation控制明列維運／展示用途；舊管理API目前仍使用共享維運token，不接受新admin session作為等價憑證。暫時不把共享token交給一般前端。
4. 若確定只需畫面服務，可另安排舊GET `/bins/{id}`及`/hotspots`的deprecated計畫；GET `/bins`仍保有GeoJSON／來源查詢需求，不因地圖改用新入口就直接刪除。
5. 若滿度風險清單沒有獨立產品需求，`/bins/collection-priorities`可列後續下架候選；工單排序依舊由staff APIs負責，不能直接宣稱兩者等價。

部署狀態見 [部署紀錄](DEPLOYMENT_STATUS.md) 最新章節；Request／Response詳見 [API Reference](API_REFERENCE.md)，前端操作流程見 [串接指南](FRONTEND_INTEGRATION.md)。本輪不改其他API權限、回應或資料庫結構。
