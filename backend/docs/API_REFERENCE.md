# API Reference：完整參數與 DTO

由 [OpenAPI 快照](openapi.json) 產生。先讀 [前端串接指南](FRONTEND_INTEGRATION.md) 的登入、範例及畫面流程，再用本頁查每個 endpoint 的精確欄位。業務規則、權限與錯誤處理見 [API 契約](API_CONTRACT.md)。

本頁所有 path 已含 `/api/v1`（health 除外）。必填＝欄位不能省略；允許 null＝值可為 null，兩者不同。JSON response 不省略 null。DTO 為傳輸格式，無須了解 ORM。日期 `date-time` 使用 UTC ISO 8601。

成功回應旁列完整型別連結；每個 DTO 的欄位均在下方。Request 限制由 Pydantic 與業務規則共同驗證。新 API 的 Idempotency-Key／If-Match 在各 endpoint 參數表列出；Authorization 依權限表使用，並非每個 query 參數。

重建：在 backend/ 執行 `python -m scripts.export_openapi` 後，執行 `python -m scripts.export_api_reference`。

## Endpoint 索引

| Method | Path | 成功回應 |
| --- | --- | --- |
| GET | `/api/v1/admin/adoptions` | 200 [Page_AdoptionRead_](#schema-page-adoptionread-) |
| POST | `/api/v1/admin/adoptions/{id}/review` | 200 [AdoptionRead](#schema-adoptionread) |
| POST | `/api/v1/admin/bins/{bin_id}/lifecycle` | 200 [Lifecycle](#schema-lifecycle) |
| POST | `/api/v1/admin/proposals/{id}/name-review` | 200 [ProposalRead](#schema-proposalread) |
| POST | `/api/v1/admin/proposals/{id}/review` | 200 [ProposalRead](#schema-proposalread) |
| GET | `/api/v1/admin/work-orders/{id}` | 200 [WorkDetail](#schema-workdetail) |
| POST | `/api/v1/admin/work-orders/{id}/demo-clear` | 200 [ClearResult](#schema-clearresult) |
| POST | `/api/v1/adoptions` | 201 [AdoptionRead](#schema-adoptionread) |
| GET | `/api/v1/adoptions/{id}` | 200 [AdoptionRead](#schema-adoptionread) |
| POST | `/api/v1/adoptions/{id}/end` | 200 [AdoptionRead](#schema-adoptionread) |
| GET | `/api/v1/adoptions/{id}/monthly-summary` | 200 [AdoptionMonth](#schema-adoptionmonth) |
| PATCH | `/api/v1/adoptions/{id}/preferences` | 200 [AdoptionRead](#schema-adoptionread) |
| POST | `/api/v1/adoptions/{id}/withdraw` | 200 [AdoptionRead](#schema-adoptionread) |
| POST | `/api/v1/auth/demo/login` | 200 [SessionRead](#schema-sessionread) |
| DELETE | `/api/v1/auth/session` | 204 無 body |
| GET | `/api/v1/bins` | 200 Array&lt;[BinRead](#schema-binread)&gt; / [BinGeoJSON](#schema-bingeojson) |
| POST | `/api/v1/bins` | 201 [BinRead](#schema-binread) |
| GET | `/api/v1/bins/collection-priorities` | 200 Array&lt;[PriorityRead](#schema-priorityread)&gt; |
| GET | `/api/v1/bins/{bin_id}` | 200 [BinRead](#schema-binread) |
| POST | `/api/v1/bins/{bin_id}/collect` | 200 [BinRead](#schema-binread) |
| GET | `/api/v1/bins/{bin_id}/history` | 200 Array&lt;[ReadingRead](#schema-readingread)&gt; |
| GET | `/api/v1/bins/{bin_id}/lifecycle` | 200 [Lifecycle](#schema-lifecycle) |
| GET | `/api/v1/bins/{bin_id}/view` | 200 [BinView](#schema-binview) |
| POST | `/api/v1/completions/{id}/like` | 200 [Cleanup](#schema-cleanup) |
| GET | `/api/v1/hotspots` | 200 Array&lt;[HotspotRead](#schema-hotspotread)&gt; |
| GET | `/api/v1/map/availability` | 200 [Nearby](#schema-nearby) |
| GET | `/api/v1/map/locations` | 200 [Page_Location_](#schema-page-location-) |
| GET | `/api/v1/map/nearest-usable` | 200 [Locations](#schema-locations) |
| GET | `/api/v1/me` | 200 [UserRead](#schema-userread) |
| GET | `/api/v1/me/adoptions` | 200 [Page_AdoptionRead_](#schema-page-adoptionread-) |
| GET | `/api/v1/me/membership` | 200 [Membership](#schema-membership) |
| GET | `/api/v1/me/notifications` | 200 [Page_NotificationRead_](#schema-page-notificationread-) |
| POST | `/api/v1/me/notifications/{id}/read` | 200 [NotificationRead](#schema-notificationread) |
| GET | `/api/v1/me/point-entries` | 200 [Page_PointRead_](#schema-page-pointread-) |
| GET | `/api/v1/me/proposal-quota` | 200 [Quota](#schema-quota) |
| GET | `/api/v1/me/proposals` | 200 [Page_ProposalRead_](#schema-page-proposalread-) |
| GET | `/api/v1/me/redemptions` | 200 [Page_RedemptionRead_](#schema-page-redemptionread-) |
| GET | `/api/v1/me/reports` | 200 [Page_ReportRead_](#schema-page-reportread-) |
| GET | `/api/v1/me/votes` | 200 [Page_ProposalRead_](#schema-page-proposalread-) |
| POST | `/api/v1/media` | 201 [MediaRead](#schema-mediaread) |
| GET | `/api/v1/media/{media_id}/access` | 200 [AccessRead](#schema-accessread) |
| GET | `/api/v1/proposals` | 200 [Page_ProposalRead_](#schema-page-proposalread-) |
| POST | `/api/v1/proposals` | 201 [ProposalCreated](#schema-proposalcreated) |
| GET | `/api/v1/proposals/{id}` | 200 [ProposalRead](#schema-proposalread) |
| POST | `/api/v1/proposals/{id}/name-requests` | 200 [ProposalRead](#schema-proposalread) |
| POST | `/api/v1/proposals/{id}/vote` | 200 [ProposalRead](#schema-proposalread) |
| GET | `/api/v1/public/outcomes` | 200 [PublicOutcomes](#schema-publicoutcomes) |
| POST | `/api/v1/redemptions` | 201 [RedeemResult](#schema-redeemresult) |
| GET | `/api/v1/redemptions/{id}` | 200 [RedemptionRead](#schema-redemptionread) |
| POST | `/api/v1/reports` | 201 [ReportRead](#schema-reportread) |
| GET | `/api/v1/reports/{report_id}` | 200 [ReportRead](#schema-reportread) |
| GET | `/api/v1/rewards` | 200 [Page_RewardRead_](#schema-page-rewardread-) |
| POST | `/api/v1/simulation/advance` | 200 [AdvanceRead](#schema-advanceread) |
| POST | `/api/v1/simulation/pause` | 200 [ClockRead](#schema-clockread) |
| POST | `/api/v1/simulation/reset` | 200 [ClockRead](#schema-clockread) |
| POST | `/api/v1/simulation/resume` | 200 [ClockRead](#schema-clockread) |
| POST | `/api/v1/simulation/seed` | 200 [ClockRead](#schema-clockread) |
| GET | `/api/v1/simulation/status` | 200 [ClockRead](#schema-clockread) |
| GET | `/api/v1/staff/route-stops` | 200 [RouteStops](#schema-routestops) |
| GET | `/api/v1/staff/statistics` | 200 [StaffMonth](#schema-staffmonth) |
| GET | `/api/v1/staff/work-orders` | 200 [Page_WorkRead_](#schema-page-workread-) |
| GET | `/api/v1/staff/work-orders/{id}` | 200 [WorkDetail](#schema-workdetail) |
| POST | `/api/v1/staff/work-orders/{id}/accept` | 200 [WorkRead](#schema-workread) |
| POST | `/api/v1/staff/work-orders/{id}/arrive` | 200 [WorkRead](#schema-workread) |
| POST | `/api/v1/staff/work-orders/{id}/defer-repair` | 200 [WorkRead](#schema-workread) |
| POST | `/api/v1/staff/work-orders/{id}/dismiss` | 200 [WorkRead](#schema-workread) |
| POST | `/api/v1/staff/work-orders/{id}/evidence` | 200 [WorkDetail](#schema-workdetail) |
| POST | `/api/v1/staff/work-orders/{id}/finish` | 200 [WorkRead](#schema-workread) |
| POST | `/api/v1/staff/work-orders/{id}/reports/{report_id}/review` | 200 [ReviewResult](#schema-reviewresult) |
| GET | `/health` | 200 object |

## Endpoint 詳情

### GET `/api/v1/admin/adoptions`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `status` | 否 | `"pending"`、`"active"`、`"rejected"`、`"withdrawn"`、`"ended"` / null | — |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` / null | — |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_AdoptionRead_](#schema-page-adoptionread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/admin/adoptions/{id}/review`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[AdoptionReview](#schema-adoptionreview)。

| HTTP | Response |
| --- | --- |
| 200 | [AdoptionRead](#schema-adoptionread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/admin/bins/{bin_id}/lifecycle`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `bin_id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[Remove](#schema-remove)。

| HTTP | Response |
| --- | --- |
| 200 | [Lifecycle](#schema-lifecycle) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/admin/proposals/{id}/name-review`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[NameReview](#schema-namereview)。

| HTTP | Response |
| --- | --- |
| 200 | [ProposalRead](#schema-proposalread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/admin/proposals/{id}/review`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[ProposalReview](#schema-proposalreview)。

| HTTP | Response |
| --- | --- |
| 200 | [ProposalRead](#schema-proposalread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/admin/work-orders/{id}`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [WorkDetail](#schema-workdetail) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/admin/work-orders/{id}/demo-clear`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[ClearCreate](#schema-clearcreate)。

| HTTP | Response |
| --- | --- |
| 200 | [ClearResult](#schema-clearresult) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/adoptions`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| header | `Idempotency-Key` | 是 | string (uuid) | — |

Request：`application/json`，必填；[AdoptionCreate](#schema-adoptioncreate)。

| HTTP | Response |
| --- | --- |
| 201 | [AdoptionRead](#schema-adoptionread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/adoptions/{id}`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [AdoptionRead](#schema-adoptionread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/adoptions/{id}/end`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[Reason](#schema-reason)。

| HTTP | Response |
| --- | --- |
| 200 | [AdoptionRead](#schema-adoptionread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/adoptions/{id}/monthly-summary`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| query | `month` | 否 | string / null | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [AdoptionMonth](#schema-adoptionmonth) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### PATCH `/api/v1/adoptions/{id}/preferences`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[Preferences](#schema-preferences)。

| HTTP | Response |
| --- | --- |
| 200 | [AdoptionRead](#schema-adoptionread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/adoptions/{id}/withdraw`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[Empty](#schema-empty)。

| HTTP | Response |
| --- | --- |
| 200 | [AdoptionRead](#schema-adoptionread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/auth/demo/login`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request：`application/json`，必填；[Login](#schema-login)。

| HTTP | Response |
| --- | --- |
| 200 | [SessionRead](#schema-sessionread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### DELETE `/api/v1/auth/session`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 204 | 無 body |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/bins`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` / `"all"` | 預設 `"大安區"` |
| query | `bin_type` | 否 | `"existing"`、`"proposed"` / null | — |
| query | `scenario_id` | 否 | string / null | — |
| query | `format` | 否 | `"json"`、`"geojson"` | 預設 `"json"` |
| query | `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | Array&lt;[BinRead](#schema-binread)&gt; / [BinGeoJSON](#schema-bingeojson) |
| 422 | [HTTPValidationError](#schema-httpvalidationerror) |

### POST `/api/v1/bins`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request：`application/json`，必填；[BinCreate](#schema-bincreate)。

| HTTP | Response |
| --- | --- |
| 201 | [BinRead](#schema-binread) |
| 422 | [HTTPValidationError](#schema-httpvalidationerror) |

### GET `/api/v1/bins/collection-priorities`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` / `"all"` | 預設 `"大安區"` |
| query | `bin_type` | 否 | `"existing"`、`"proposed"` / null | — |
| query | `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | Array&lt;[PriorityRead](#schema-priorityread)&gt; |
| 422 | [HTTPValidationError](#schema-httpvalidationerror) |

### GET `/api/v1/bins/{bin_id}`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `bin_id` | 是 | string (uuid) | — |
| query | `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [BinRead](#schema-binread) |
| 422 | [HTTPValidationError](#schema-httpvalidationerror) |

### POST `/api/v1/bins/{bin_id}/collect`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `bin_id` | 是 | string (uuid) | — |
| query | `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [BinRead](#schema-binread) |
| 422 | [HTTPValidationError](#schema-httpvalidationerror) |

### GET `/api/v1/bins/{bin_id}/history`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `bin_id` | 是 | string (uuid) | — |
| query | `limit` | 否 | integer | 最小 `1`；最大 `1000`；預設 `100` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |
| query | `start` | 否 | string (date-time) / null | — |
| query | `end` | 否 | string (date-time) / null | — |
| query | `generation` | 否 | integer / null | 最小 `0` |
| query | `source_type` | 否 | `"simulated"`、`"iot_sensor"` / null | — |
| query | `waste_type` | 否 | `"general"`、`"recycling"`、`"legacy_unknown"` / null | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | Array&lt;[ReadingRead](#schema-readingread)&gt; |
| 422 | [HTTPValidationError](#schema-httpvalidationerror) |

### GET `/api/v1/bins/{bin_id}/lifecycle`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `bin_id` | 是 | string (uuid) | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Lifecycle](#schema-lifecycle) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/bins/{bin_id}/view`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `bin_id` | 是 | string (uuid) | — |
| query | `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [BinView](#schema-binview) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/completions/{id}/like`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |

Request：`application/json`，必填；[Empty](#schema-empty)。

| HTTP | Response |
| --- | --- |
| 200 | [Cleanup](#schema-cleanup) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/hotspots`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` | 預設 `"大安區"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | Array&lt;[HotspotRead](#schema-hotspotread)&gt; |
| 422 | [HTTPValidationError](#schema-httpvalidationerror) |

### GET `/api/v1/map/availability`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `latitude` | 否 | number / null | 最小 `-90`；最大 `90` |
| query | `longitude` | 否 | number / null | 最小 `-180`；最大 `180` |
| query | `radius_m` | 否 | integer | 最小 `300`；最大 `300`；預設 `300` |
| query | `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Nearby](#schema-nearby) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/map/locations`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` / `"all"` | 預設 `"大安區"` |
| query | `kind` | 否 | `"bin"`、`"place"`、`"all"` | 預設 `"bin"` |
| query | `q` | 否 | string | 最長字元 `200`；預設 `""` |
| query | `filter` | 否 | `"all"`、`"hungry"`、`"can_fit"`、`"new"` | 預設 `"all"` |
| query | `include_proposed` | 否 | boolean | 預設 `false` |
| query | `include_removed` | 否 | boolean | 預設 `false` |
| query | `latitude` | 否 | number / null | 最小 `-90`；最大 `90` |
| query | `longitude` | 否 | number / null | 最小 `-180`；最大 `180` |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |
| query | `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_Location_](#schema-page-location-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/map/nearest-usable`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` / `"all"` | 預設 `"大安區"` |
| query | `q` | 否 | string | 最長字元 `200`；預設 `""` |
| query | `latitude` | 否 | number / null | 最小 `-90`；最大 `90` |
| query | `longitude` | 否 | number / null | 最小 `-180`；最大 `180` |
| query | `limit` | 否 | integer | 最小 `1`；最大 `10`；預設 `3` |
| query | `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Locations](#schema-locations) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [UserRead](#schema-userread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/adoptions`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `status` | 否 | `"pending"`、`"active"`、`"rejected"`、`"withdrawn"`、`"ended"` / null | — |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_AdoptionRead_](#schema-page-adoptionread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/membership`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Membership](#schema-membership) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/notifications`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `unread_only` | 否 | boolean | 預設 `false` |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_NotificationRead_](#schema-page-notificationread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/me/notifications/{id}/read`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |

Request：`application/json`，必填；[Empty](#schema-empty)。

| HTTP | Response |
| --- | --- |
| 200 | [NotificationRead](#schema-notificationread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/point-entries`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_PointRead_](#schema-page-pointread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/proposal-quota`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Quota](#schema-quota) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/proposals`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_ProposalRead_](#schema-page-proposalread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/redemptions`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_RedemptionRead_](#schema-page-redemptionread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/reports`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `status` | 否 | `"pending"`、`"processing"`、`"approved"`、`"rejected"` / null | — |
| query | `bin_id` | 否 | string (uuid) / null | — |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |
| query | `waste_type` | 否 | `"general"`、`"recycling"` / null | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_ReportRead_](#schema-page-reportread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/me/votes`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_ProposalRead_](#schema-page-proposalread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/media`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request：`multipart/form-data`，必填；[Body_upload_api_v1_media_post](#schema-body-upload-api-v1-media-post)。

| HTTP | Response |
| --- | --- |
| 201 | [MediaRead](#schema-mediaread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/media/{media_id}/access`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `media_id` | 是 | string (uuid) | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [AccessRead](#schema-accessread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/proposals`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` | 預設 `"大安區"` |
| query | `status` | 否 | `"collecting"`、`"village"`、`"evaluation"`、`"survey"`、`"installed"`、`"declined"` / null | — |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_ProposalRead_](#schema-page-proposalread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/proposals`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| header | `Idempotency-Key` | 是 | string (uuid) | — |

Request：`application/json`，必填；[ProposalCreate](#schema-proposalcreate)。

| HTTP | Response |
| --- | --- |
| 201 | [ProposalCreated](#schema-proposalcreated) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/proposals/{id}`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [ProposalRead](#schema-proposalread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/proposals/{id}/name-requests`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[NameCreate](#schema-namecreate)。

| HTTP | Response |
| --- | --- |
| 200 | [ProposalRead](#schema-proposalread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/proposals/{id}/vote`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |

Request：`application/json`，必填；[VoteCreate](#schema-votecreate)。

| HTTP | Response |
| --- | --- |
| 200 | [ProposalRead](#schema-proposalread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/public/outcomes`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` | 預設 `"大安區"` |
| query | `month` | 否 | string / null | — |
| query | `waste_type` | 否 | `"general"`、`"recycling"` / null | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [PublicOutcomes](#schema-publicoutcomes) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/redemptions`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| header | `Idempotency-Key` | 是 | string (uuid) | — |

Request：`application/json`，必填；[Redeem](#schema-redeem)。

| HTTP | Response |
| --- | --- |
| 201 | [RedeemResult](#schema-redeemresult) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/redemptions/{id}`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [RedemptionRead](#schema-redemptionread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/reports`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| header | `Idempotency-Key` | 是 | string (uuid) | — |

Request：`application/json`，必填；[ReportCreate](#schema-reportcreate)。

| HTTP | Response |
| --- | --- |
| 201 | [ReportRead](#schema-reportread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/reports/{report_id}`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `report_id` | 是 | string (uuid) | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [ReportRead](#schema-reportread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/rewards`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `category` | 否 | `"all"`、`"coupon"`、`"grand"` | 預設 `"all"` |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_RewardRead_](#schema-page-rewardread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/simulation/advance`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request：`application/json`，必填；[AdvanceRequest](#schema-advancerequest)。

| HTTP | Response |
| --- | --- |
| 200 | [AdvanceRead](#schema-advanceread) |
| 422 | [HTTPValidationError](#schema-httpvalidationerror) |

### POST `/api/v1/simulation/pause`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [ClockRead](#schema-clockread) |

### POST `/api/v1/simulation/reset`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [ClockRead](#schema-clockread) |

### POST `/api/v1/simulation/resume`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [ClockRead](#schema-clockread) |

### POST `/api/v1/simulation/seed`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [ClockRead](#schema-clockread) |

### GET `/api/v1/simulation/status`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [ClockRead](#schema-clockread) |

### GET `/api/v1/staff/route-stops`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `waste_type` | 否 | `"general"`、`"recycling"` / null | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [RouteStops](#schema-routestops) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/staff/statistics`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` / null | — |
| query | `month` | 否 | string / null | — |
| query | `waste_type` | 否 | `"general"`、`"recycling"` / null | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [StaffMonth](#schema-staffmonth) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/staff/work-orders`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| query | `bucket` | 否 | `"pending"`、`"processing"`、`"completed"`、`"all"` | 預設 `"all"` |
| query | `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` / null | — |
| query | `type` | 否 | `"full"`、`"dirty"`、`"dumping"`、`"broken"`、`"other"` / null | — |
| query | `source` | 否 | `"citizen"`、`"sensor"`、`"inspection"` / null | — |
| query | `limit` | 否 | integer | 最小 `1`；最大 `100`；預設 `20` |
| query | `offset` | 否 | integer | 最小 `0`；預設 `0` |
| query | `waste_type` | 否 | `"general"`、`"recycling"` / null | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [Page_WorkRead_](#schema-page-workread-) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/api/v1/staff/work-orders/{id}`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | [WorkDetail](#schema-workdetail) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/staff/work-orders/{id}/accept`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[Empty](#schema-empty)。

| HTTP | Response |
| --- | --- |
| 200 | [WorkRead](#schema-workread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/staff/work-orders/{id}/arrive`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[Empty](#schema-empty)。

| HTTP | Response |
| --- | --- |
| 200 | [WorkRead](#schema-workread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/staff/work-orders/{id}/defer-repair`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[RequiredReason](#schema-requiredreason)。

| HTTP | Response |
| --- | --- |
| 200 | [WorkRead](#schema-workread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/staff/work-orders/{id}/dismiss`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[RequiredReason](#schema-requiredreason)。

| HTTP | Response |
| --- | --- |
| 200 | [WorkRead](#schema-workread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/staff/work-orders/{id}/evidence`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[EvidenceCreate](#schema-evidencecreate)。

| HTTP | Response |
| --- | --- |
| 200 | [WorkDetail](#schema-workdetail) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/staff/work-orders/{id}/finish`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[Reason](#schema-reason)。

| HTTP | Response |
| --- | --- |
| 200 | [WorkRead](#schema-workread) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### POST `/api/v1/staff/work-orders/{id}/reports/{report_id}/review`

| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- | --- |
| path | `id` | 是 | string (uuid) | — |
| path | `report_id` | 是 | string (uuid) | — |
| header | `Idempotency-Key` | 是 | string (uuid) | — |
| header | `If-Match` | 是 | string | — |

Request：`application/json`，必填；[Review](#schema-review)。

| HTTP | Response |
| --- | --- |
| 200 | [ReviewResult](#schema-reviewresult) |
| 401 | [ApiError](#schema-apierror) |
| 403 | [ApiError](#schema-apierror) |
| 404 | [ApiError](#schema-apierror) |
| 409 | [ApiError](#schema-apierror) |
| 411 | [ApiError](#schema-apierror) |
| 412 | [ApiError](#schema-apierror) |
| 413 | [ApiError](#schema-apierror) |
| 415 | [ApiError](#schema-apierror) |
| 422 | [ApiError](#schema-apierror) |
| 428 | [ApiError](#schema-apierror) |
| 429 | [ApiError](#schema-apierror) |
| 503 | [ApiError](#schema-apierror) |

### GET `/health`

無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。

Request body：無。

| HTTP | Response |
| --- | --- |
| 200 | object |

## DTO 欄位

<a id="schema-accessread"></a>

### Schema AccessRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `expires_at` | 是 | string (date-time) | — |
| `url` | 是 | string | — |

<a id="schema-adoptioncreate"></a>

### Schema AdoptionCreate

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `display_name` | 是 | string | 最短字元 `1`；最長字元 `50` |
| `intro` | 否 | string | 最長字元 `120`；預設 `""` |
| `preferences` | 是 | [Preferences](#schema-preferences) | — |
| `role` | 是 | `"居民"`、`"店家"`、`"學校"`、`"社區團體"` | — |

<a id="schema-adoptionmonth"></a>

### Schema AdoptionMonth

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `adoption_id` | 是 | string (uuid) | — |
| `is_partial_month` | 是 | boolean | — |
| `month` | 是 | string | — |
| `points_awarded` | 是 | integer | — |
| `reports_approved` | 是 | integer | — |
| `reports_submitted` | 是 | integer | — |
| `source_type` | 是 | string | — |
| `timezone` | 是 | `"Asia/Taipei"` | — |

<a id="schema-adoptionpublic"></a>

### Schema AdoptionPublic

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `display_name` | 是 | string | — |
| `intro` | 是 | string | — |
| `role` | 是 | `"居民"`、`"店家"`、`"學校"`、`"社區團體"` | — |

<a id="schema-adoptionread"></a>

### Schema AdoptionRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `created_at` | 是 | string (date-time) | — |
| `display_name` | 是 | string | — |
| `id` | 是 | string (uuid) | — |
| `intro` | 是 | string | — |
| `preferences` | 是 | [Preferences](#schema-preferences) | — |
| `reason` | 是 | string | — |
| `role` | 是 | `"居民"`、`"店家"`、`"學校"`、`"社區團體"` | — |
| `status` | 是 | `"pending"`、`"active"`、`"rejected"`、`"withdrawn"`、`"ended"` | — |
| `updated_at` | 是 | string (date-time) | — |
| `version` | 是 | integer | — |

<a id="schema-adoptionreview"></a>

### Schema AdoptionReview

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `decision` | 是 | `"active"`、`"rejected"` | — |
| `reason` | 否 | string / null | 最長字元 `500` |

<a id="schema-advanceread"></a>

### Schema AdvanceRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `generation` | 是 | integer | — |
| `replayed` | 是 | boolean | — |
| `request_id` | 是 | string (uuid) | — |
| `simulated_at` | 是 | string (date-time) | — |

<a id="schema-advancerequest"></a>

### Schema AdvanceRequest

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `generation` | 是 | integer | 最小 `0.0` |
| `minutes` | 否 | integer / null | 最小 `1.0`；最大 `10080.0` |
| `real_seconds` | 否 | number / null | 最大 `604800.0`；大於 `0.0` |
| `request_id` | 是 | string (uuid) | — |

<a id="schema-apierror"></a>

### Schema ApiError

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `detail` | 是 | [ErrorDetail](#schema-errordetail) | — |

<a id="schema-bincreate"></a>

### Schema BinCreate

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `district` | 否 | `"中正區"`、`"大同區"`、`"中山區"`、`"松山區"`、`"大安區"`、`"萬華區"`、`"信義區"`、`"士林區"`、`"北投區"`、`"內湖區"`、`"南港區"`、`"文山區"` | 預設 `"大安區"` |
| `latitude` | 是 | number | 最小 `-90.0`；最大 `90.0` |
| `longitude` | 是 | number | 最小 `-180.0`；最大 `180.0` |
| `name` | 是 | string | 最短字元 `1`；最長字元 `200` |
| `note` | 否 | string | 最長字元 `5000`；預設 `""` |

<a id="schema-binfeature"></a>

### Schema BinFeature

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `geometry` | 是 | [BinGeometry](#schema-bingeometry) | — |
| `id` | 是 | string (uuid) | — |
| `properties` | 是 | [BinRead](#schema-binread) | — |
| `type` | 是 | `"Feature"` | — |

<a id="schema-bingeojson"></a>

### Schema BinGeoJSON

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `features` | 是 | Array&lt;[BinFeature](#schema-binfeature)&gt; | — |
| `type` | 是 | `"FeatureCollection"` | — |

<a id="schema-bingeometry"></a>

### Schema BinGeometry

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `coordinates` | 是 | Array&lt;object&gt; | 最少項數 `2`；最多項數 `2` |
| `type` | 是 | `"Point"` | — |

<a id="schema-binread"></a>

### Schema BinRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `address` | 是 | string / null | — |
| `bin_type` | 是 | `"existing"`、`"proposed"` | — |
| `boundary_warning` | 是 | string / null | — |
| `compartments` | 是 | Array&lt;[CompartmentRead](#schema-compartmentread)&gt; | — |
| `created_at` | 是 | string (date-time) | — |
| `current_usage` | 是 | [UsageRead](#schema-usageread) / null | — |
| `demand_score` | 是 | number / null | — |
| `district` | 是 | string | — |
| `external_id` | 是 | string / null | — |
| `feasibility_status` | 是 | string / null | — |
| `id` | 是 | string (uuid) | — |
| `latitude` | 是 | number | — |
| `location_precision` | 是 | string / null | — |
| `longitude` | 是 | number | — |
| `name` | 是 | string | — |
| `note` | 是 | string | — |
| `placement_status` | 是 | string | — |
| `rank` | 是 | integer / null | — |
| `reason` | 是 | string / null | — |
| `scenario_id` | 是 | string / null | — |
| `source_file` | 是 | string / null | — |
| `source_row` | 是 | integer / null | — |
| `source_type` | 是 | string | — |
| `status` | 是 | string | — |
| `updated_at` | 是 | string (date-time) | — |

<a id="schema-binstatus"></a>

### Schema BinStatus

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `capacity_liters` | 是 | number / null | — |
| `classification_source` | 否 | string | 預設 `"legacy_assumed_general"` |
| `estimated_hours_to_90_pct` | 是 | number / null | — |
| `estimated_used_liters` | 是 | number / null | — |
| `fill_level_pct` | 是 | number / null | — |
| `fill_status` | 是 | `"hungry"`、`"half"`、`"full"`、`"unknown"` | — |
| `installed_at` | 是 | string (date-time) / null | — |
| `is_new` | 是 | boolean | — |
| `is_usable` | 是 | boolean | — |
| `last_emptied_at` | 是 | string (date-time) / null | — |
| `observed_at` | 是 | string (date-time) / null | — |
| `operational_status` | 是 | `"normal"`、`"repair"`、`"removed"` | — |
| `reading_source_type` | 是 | `"simulated"`、`"iot_sensor"` / null | — |
| `received_at` | 是 | string (date-time) / null | — |
| `removed_at` | 是 | string (date-time) / null | — |
| `risk_priority` | 是 | `"critical"`、`"high"`、`"medium"`、`"low"` / null | — |
| `unavailable_reasons` | 是 | Array&lt;string&gt; | — |
| `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

<a id="schema-binview"></a>

### Schema BinView

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `adopter` | 是 | [AdoptionPublic](#schema-adoptionpublic) / null | — |
| `can_apply_adoption` | 是 | boolean | — |
| `can_report` | 是 | boolean | — |
| `compartments` | 是 | Array&lt;[BinStatus](#schema-binstatus)&gt; | — |
| `latest_cleanup` | 是 | [Cleanup](#schema-cleanup) / null | — |
| `location` | 是 | [Location](#schema-location) | — |
| `my_adoption_id` | 是 | string (uuid) / null | — |
| `report_block_reason` | 是 | string / null | — |
| `status` | 是 | [BinStatus](#schema-binstatus) | — |

<a id="schema-body-upload-api-v1-media-post"></a>

### Schema Body_upload_api_v1_media_post

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `file` | 是 | string | — |
| `purpose` | 是 | string | — |

<a id="schema-cleanup"></a>

### Schema Cleanup

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `can_like` | 是 | boolean | — |
| `classification_source` | 否 | string | 預設 `"legacy_assumed_general"` |
| `completed_at` | 是 | string (date-time) | — |
| `id` | 是 | string (uuid) | — |
| `like_count` | 是 | integer | — |
| `liked_by_me` | 是 | boolean | — |
| `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |
| `work_order_id` | 是 | string (uuid) | — |

<a id="schema-clearcreate"></a>

### Schema ClearCreate

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `reading_id` | 是 | string (uuid) | — |

<a id="schema-clearresult"></a>

### Schema ClearResult

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `reading` | 是 | [TaskReading](#schema-taskreading) | — |
| `work_order` | 是 | [WorkRead](#schema-workread) | — |

<a id="schema-clockread"></a>

### Schema ClockRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `clock_id` | 是 | string | — |
| `clock_mode` | 是 | `"manual"` | — |
| `data_version` | 是 | string | — |
| `generation` | 是 | integer | — |
| `seed` | 是 | integer | — |
| `simulated_at` | 是 | string (date-time) | — |
| `simulation_status` | 是 | `"running"`、`"paused"` | — |
| `source_type` | 是 | `"simulated"` | — |
| `time_multiplier` | 是 | number | — |

<a id="schema-compartmentread"></a>

### Schema CompartmentRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `classification_source` | 是 | string | — |
| `current_usage` | 是 | [UsageRead](#schema-usageread) / null | — |
| `waste_type` | 是 | `"general"`、`"recycling"` | — |

<a id="schema-empty"></a>

### Schema Empty

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |

<a id="schema-errordetail"></a>

### Schema ErrorDetail

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `code` | 是 | string | — |
| `fields` | 是 | Array&lt;[ErrorField](#schema-errorfield)&gt; | — |
| `message` | 是 | string | — |
| `request_id` | 是 | string (uuid) | — |

<a id="schema-errorfield"></a>

### Schema ErrorField

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `code` | 是 | string | — |
| `field` | 是 | string | — |
| `message` | 是 | string | — |

<a id="schema-evidencecreate"></a>

### Schema EvidenceCreate

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `media_id` | 是 | string (uuid) | — |
| `purpose` | 是 | `"completion"`、`"site"` | — |

<a id="schema-evidenceread"></a>

### Schema EvidenceRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `created_at` | 是 | string (date-time) | — |
| `id` | 是 | string (uuid) | — |
| `media_id` | 是 | string (uuid) | — |
| `purpose` | 是 | `"completion"`、`"site"` | — |

<a id="schema-httpvalidationerror"></a>

### Schema HTTPValidationError

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `detail` | 否 | Array&lt;[ValidationError](#schema-validationerror)&gt; | — |

<a id="schema-hotspotread"></a>

### Schema HotspotRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `created_at` | 是 | string (date-time) | — |
| `district` | 是 | string | — |
| `id` | 是 | string (uuid) | — |
| `latitude` | 是 | number | — |
| `location_precision` | 是 | string | — |
| `longitude` | 是 | number | — |
| `name` | 是 | string | — |
| `note` | 是 | string | — |
| `reported_count` | 是 | integer | — |
| `source_file` | 是 | string / null | — |
| `source_row` | 是 | integer / null | — |
| `source_type` | 是 | string | — |
| `updated_at` | 是 | string (date-time) | — |

<a id="schema-lifecycle"></a>

### Schema Lifecycle

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `installed_at` | 是 | string (date-time) / null | — |
| `operational_status` | 是 | string | — |
| `placement_status` | 是 | string | — |
| `reason` | 是 | string / null | — |
| `removed_at` | 是 | string (date-time) / null | — |
| `version` | 是 | integer | — |

<a id="schema-location"></a>

### Schema Location

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `address` | 是 | string / null | — |
| `bin_status` | 是 | [BinStatus](#schema-binstatus) / null | — |
| `bin_type` | 是 | `"existing"`、`"proposed"` / null | — |
| `compartments` | 否 | Array&lt;[BinStatus](#schema-binstatus)&gt; | — |
| `distance_m` | 是 | number / null | — |
| `district` | 是 | string | — |
| `id` | 是 | string (uuid) | — |
| `kind` | 是 | `"bin"`、`"place"` | — |
| `label` | 是 | string | — |
| `latitude` | 是 | number | — |
| `location_precision` | 是 | string / null | — |
| `longitude` | 是 | number | — |
| `note` | 是 | string | — |
| `placement_status` | 是 | `"existing"`、`"proposed"`、`"installed"` / null | — |
| `reported_count` | 是 | integer / null | — |
| `source_file` | 是 | string / null | — |
| `source_row` | 是 | integer / null | — |
| `source_type` | 是 | string | — |
| `walking_estimate_seconds` | 是 | integer / null | — |

<a id="schema-locations"></a>

### Schema Locations

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[Location](#schema-location)&gt; | — |

<a id="schema-login"></a>

### Schema Login

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `account` | 是 | string | 最短字元 `1`；最長字元 `100` |
| `password` | 是 | string (password) | 最短字元 `1`；最長字元 `200` |

<a id="schema-mediaread"></a>

### Schema MediaRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `content_type` | 是 | string | — |
| `created_at` | 是 | string (date-time) | — |
| `id` | 是 | string (uuid) | — |
| `purpose` | 是 | `"report"`、`"completion"`、`"site"` | — |
| `size_bytes` | 是 | integer | — |
| `status` | 是 | `"ready"` | — |

<a id="schema-membership"></a>

### Schema Membership

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `approved_report_count` | 是 | integer | — |
| `available_points` | 是 | integer | — |
| `cumulative_points` | 是 | integer | — |
| `current_tier` | 是 | [Tier](#schema-tier) | — |
| `next_tier` | 是 | [Tier](#schema-tier) / null | — |
| `pending_points` | 是 | integer | — |
| `points_to_next_tier` | 是 | integer / null | — |
| `rejected_report_count` | 是 | integer | — |
| `reporting_suspended` | 是 | boolean | — |
| `rule_version` | 是 | string | — |

<a id="schema-namecreate"></a>

### Schema NameCreate

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `name` | 是 | string | 最短字元 `1`；最長字元 `30` |

<a id="schema-namereview"></a>

### Schema NameReview

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `approve` | 是 | boolean | — |
| `reason` | 否 | string / null | 最長字元 `500` |

<a id="schema-nearby"></a>

### Schema Nearby

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bins` | 是 | Array&lt;[Location](#schema-location)&gt; | — |
| `has_existing_bin_within_radius` | 是 | boolean | — |
| `nearest_installed_bin` | 是 | [Location](#schema-location) / null | — |
| `proposals` | 是 | Array&lt;[ProposalRead](#schema-proposalread)&gt; | — |
| `radius_m` | 是 | integer | — |

<a id="schema-notificationread"></a>

### Schema NotificationRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `created_at` | 是 | string (date-time) | — |
| `id` | 是 | string (uuid) | — |
| `message` | 是 | string | — |
| `read_at` | 是 | string (date-time) / null | — |
| `target` | 是 | [Target](#schema-target) | — |
| `title` | 是 | string | — |
| `type` | 是 | string | — |
| `waste_type` | 否 | `"general"`、`"recycling"` / null | — |

<a id="schema-origin"></a>

### Schema Origin

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `latitude` | 是 | number | 最小 `-90.0`；最大 `90.0` |
| `longitude` | 是 | number | 最小 `-180.0`；最大 `180.0` |
| `source` | 是 | `"demo_fixed"` | — |

<a id="schema-pageinfo"></a>

### Schema PageInfo

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `limit` | 是 | integer | — |
| `offset` | 是 | integer | — |
| `total` | 是 | integer | — |

<a id="schema-page-adoptionread-"></a>

### Schema Page_AdoptionRead_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[AdoptionRead](#schema-adoptionread)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-page-location-"></a>

### Schema Page_Location_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[Location](#schema-location)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-page-notificationread-"></a>

### Schema Page_NotificationRead_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[NotificationRead](#schema-notificationread)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-page-pointread-"></a>

### Schema Page_PointRead_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[PointRead](#schema-pointread)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-page-proposalread-"></a>

### Schema Page_ProposalRead_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[ProposalRead](#schema-proposalread)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-page-redemptionread-"></a>

### Schema Page_RedemptionRead_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[RedemptionRead](#schema-redemptionread)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-page-reportread-"></a>

### Schema Page_ReportRead_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[ReportRead](#schema-reportread)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-page-rewardread-"></a>

### Schema Page_RewardRead_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[RewardRead](#schema-rewardread)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-page-workread-"></a>

### Schema Page_WorkRead_

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `items` | 是 | Array&lt;[WorkRead](#schema-workread)&gt; | — |
| `page` | 是 | [PageInfo](#schema-pageinfo) | — |

<a id="schema-pointread"></a>

### Schema PointRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `amount` | 是 | integer | — |
| `balance_after` | 是 | integer | — |
| `created_at` | 是 | string (date-time) | — |
| `id` | 是 | string (uuid) | — |
| `redemption_id` | 是 | string (uuid) / null | — |
| `report_id` | 是 | string (uuid) / null | — |
| `source_type` | 是 | string | — |
| `type` | 是 | string | — |

<a id="schema-position"></a>

### Schema Position

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `latitude` | 是 | number | 最小 `-90.0`；最大 `90.0` |
| `longitude` | 是 | number | 最小 `-180.0`；最大 `180.0` |

<a id="schema-preferences"></a>

### Schema Preferences

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `dirty` | 是 | boolean | — |
| `dumping` | 是 | boolean | — |
| `full` | 是 | boolean | — |

<a id="schema-priorityread"></a>

### Schema PriorityRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `bin_type` | 是 | `"existing"`、`"proposed"` | — |
| `classification_source` | 是 | string | — |
| `estimated_hours_to_90_pct` | 是 | number / null | — |
| `fill_level_pct` | 是 | number | — |
| `last_updated_at` | 是 | string (date-time) | — |
| `name` | 是 | string | — |
| `priority` | 是 | `"critical"`、`"high"`、`"medium"`、`"low"` | — |
| `source_type` | 是 | string | — |
| `waste_type` | 是 | `"general"`、`"recycling"` | — |

<a id="schema-proposalcreate"></a>

### Schema ProposalCreate

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `confirmed_nearby` | 否 | boolean | 預設 `false` |
| `latitude` | 是 | number | 最小 `-90.0`；最大 `90.0` |
| `longitude` | 是 | number | 最小 `-180.0`；最大 `180.0` |
| `name` | 是 | string | 最短字元 `1`；最長字元 `200` |
| `reason` | 是 | string | 最短字元 `1`；最長字元 `500` |

<a id="schema-proposalcreated"></a>

### Schema ProposalCreated

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `proposal` | 是 | [ProposalRead](#schema-proposalread) | — |
| `quota` | 是 | [Quota](#schema-quota) | — |
| `warnings` | 是 | Array&lt;[ProposalWarning](#schema-proposalwarning)&gt; | — |

<a id="schema-proposalread"></a>

### Schema ProposalRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `approved_name` | 是 | string / null | — |
| `bin_id` | 是 | string (uuid) | — |
| `created_at` | 是 | string (date-time) | — |
| `district` | 是 | string | — |
| `id` | 是 | string (uuid) | — |
| `is_demo` | 是 | boolean | — |
| `latitude` | 是 | number | — |
| `longitude` | 是 | number | — |
| `mine` | 是 | boolean | — |
| `my_vote` | 是 | `"support"`、`"oppose"` / null | — |
| `name` | 是 | string | — |
| `name_status` | 是 | `"pending"`、`"approved"`、`"returned"` / null | — |
| `oppose` | 是 | integer | — |
| `outcome_reason` | 是 | string / null | — |
| `pending_name` | 是 | string / null | — |
| `reason` | 是 | string | — |
| `rule_version` | 是 | string | — |
| `status` | 是 | `"collecting"`、`"village"`、`"evaluation"`、`"survey"`、`"installed"`、`"declined"` | — |
| `support` | 是 | integer | — |
| `support_ratio` | 是 | number / null | — |
| `total_votes` | 是 | integer | — |
| `version` | 是 | integer | — |
| `voting_closed_at` | 是 | string (date-time) / null | — |

<a id="schema-proposalreview"></a>

### Schema ProposalReview

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `action` | 是 | `"village_approve"`、`"evaluation_approve"`、`"survey_approve"`、`"decline"` | — |
| `reason` | 否 | string / null | 最長字元 `500` |

<a id="schema-proposalwarning"></a>

### Schema ProposalWarning

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `code` | 是 | `"NEAR_EXISTING_BIN"` | — |
| `distance_m` | 是 | number | — |

<a id="schema-publicoutcomes"></a>

### Schema PublicOutcomes

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `completed_count` | 是 | integer | — |
| `district` | 是 | string | — |
| `like_count` | 是 | integer | — |
| `month` | 是 | string | — |
| `timezone` | 是 | `"Asia/Taipei"` | — |
| `waste_type` | 否 | `"general"`、`"recycling"` / null | — |

<a id="schema-quota"></a>

### Schema Quota

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `limit` | 是 | integer | — |
| `month` | 是 | string | — |
| `remaining` | 是 | integer | — |
| `timezone` | 是 | `"Asia/Taipei"` | — |
| `used` | 是 | integer | — |

<a id="schema-rank"></a>

### Schema Rank

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `average_processing_seconds` | 是 | number / null | — |
| `completed_count` | 是 | integer | — |
| `display_name` | 是 | string | — |
| `like_count` | 是 | integer | — |
| `rank` | 是 | integer | — |
| `staff_id` | 是 | string (uuid) | — |

<a id="schema-readingread"></a>

### Schema ReadingRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `classification_source` | 是 | string | — |
| `event_type` | 是 | `"measurement"`、`"collection"`、`"reset"` | — |
| `fill_level_pct` | 是 | number | — |
| `generation` | 是 | integer / null | — |
| `id` | 是 | string (uuid) | — |
| `recorded_at` | 是 | string (date-time) | — |
| `source_type` | 是 | string | — |
| `waste_type` | 是 | `"general"`、`"recycling"` / null | — |

<a id="schema-reason"></a>

### Schema Reason

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `reason` | 否 | string / null | 最長字元 `500` |

<a id="schema-redeem"></a>

### Schema Redeem

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `reward_id` | 是 | string (uuid) | — |

<a id="schema-redeemresult"></a>

### Schema RedeemResult

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `membership` | 是 | [Membership](#schema-membership) | — |
| `redemption` | 是 | [RedemptionRead](#schema-redemptionread) | — |
| `reward` | 是 | [RewardRead](#schema-rewardread) | — |

<a id="schema-redemptionread"></a>

### Schema RedemptionRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `cost` | 是 | integer | — |
| `created_at` | 是 | string (date-time) | — |
| `id` | 是 | string (uuid) | — |
| `is_demo` | 是 | `true` | — |
| `reward_id` | 是 | string (uuid) | — |
| `status` | 是 | `"demo_issued"` | — |
| `voucher_code` | 是 | string | — |

<a id="schema-remove"></a>

### Schema Remove

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `action` | 是 | `"remove"` | — |
| `reason` | 是 | string | 最短字元 `1`；最長字元 `500` |

<a id="schema-reportcreate"></a>

### Schema ReportCreate

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `description` | 否 | string | 最長字元 `500`；預設 `""` |
| `photo_ids` | 是 | Array&lt;string (uuid)&gt; | 最少項數 `1`；最多項數 `1` |
| `position` | 是 | [Position](#schema-position) | — |
| `quick` | 否 | boolean | 預設 `false` |
| `type` | 是 | `"full"`、`"dirty"`、`"dumping"`、`"broken"`、`"other"` | — |
| `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |

<a id="schema-reportread"></a>

### Schema ReportRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `accepted_at` | 是 | string (date-time) / null | — |
| `adopter` | 是 | boolean | — |
| `assignment_status` | 是 | `"assigned"`、`"unassigned"` | — |
| `awarded_points` | 是 | integer | — |
| `bin_id` | 是 | string (uuid) | — |
| `classification_source` | 否 | string | 預設 `"legacy_assumed_general"` |
| `created_at` | 是 | string (date-time) | — |
| `description` | 是 | string | — |
| `event_id` | 是 | string (uuid) | — |
| `event_status` | 是 | `"open"`、`"closed"` | — |
| `first_reporter` | 是 | boolean | — |
| `id` | 是 | string (uuid) | — |
| `pending_points` | 是 | integer | — |
| `photo_ids` | 是 | Array&lt;string (uuid)&gt; | — |
| `quick` | 是 | boolean | — |
| `rejection_reason` | 是 | string / null | — |
| `reviewed_at` | 是 | string (date-time) / null | — |
| `rule_version` | 是 | string | — |
| `settled_at` | 是 | string (date-time) / null | — |
| `status` | 是 | `"pending"`、`"processing"`、`"approved"`、`"rejected"` | — |
| `type` | 是 | `"full"`、`"dirty"`、`"dumping"`、`"broken"`、`"other"` | — |
| `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |
| `work_order_id` | 是 | string (uuid) / null | — |
| `work_status` | 是 | `"pending"`、`"processing"`、`"arrived"`、`"waiting_sensor"`、`"repair"`、`"completed"`、`"dismissed"` / null | — |

<a id="schema-requiredreason"></a>

### Schema RequiredReason

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `reason` | 是 | string | 最短字元 `1`；最長字元 `500` |

<a id="schema-requirements"></a>

### Schema Requirements

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `arrived` | 是 | boolean | — |
| `completion_photo` | 是 | boolean | — |
| `fresh_clear_reading` | 是 | boolean | — |
| `missing` | 是 | Array&lt;string&gt; | — |
| `reports_reviewed` | 是 | boolean | — |
| `work_submitted` | 是 | boolean | — |

<a id="schema-review"></a>

### Schema Review

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `decision` | 是 | `"approved"`、`"rejected"` | — |
| `reason` | 否 | string / null | 最長字元 `500` |

<a id="schema-reviewresult"></a>

### Schema ReviewResult

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `report` | 是 | [ReportRead](#schema-reportread) | — |
| `work_order` | 是 | [WorkRead](#schema-workread) | — |

<a id="schema-rewardread"></a>

### Schema RewardRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `available` | 是 | boolean | — |
| `category` | 是 | `"coupon"`、`"grand"` | — |
| `code` | 是 | string | — |
| `cost` | 是 | integer | — |
| `id` | 是 | string (uuid) | — |
| `is_demo` | 是 | boolean | — |
| `name` | 是 | string | — |
| `stock` | 是 | integer | — |

<a id="schema-routestops"></a>

### Schema RouteStops

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `generated_at` | 是 | string (date-time) | — |
| `origin` | 是 | [Origin](#schema-origin) | — |
| `stops` | 是 | Array&lt;[Stop](#schema-stop)&gt; | — |

<a id="schema-sessionread"></a>

### Schema SessionRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `access_token` | 是 | string | — |
| `expires_at` | 是 | string (date-time) | — |
| `token_type` | 是 | `"bearer"` | — |
| `user` | 是 | [UserRead](#schema-userread) | — |

<a id="schema-staffmonth"></a>

### Schema StaffMonth

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `average_processing_seconds` | 是 | number / null | — |
| `bonus_display_only` | 是 | `true` | — |
| `completed_count` | 是 | integer | — |
| `district` | 是 | string | — |
| `like_count` | 是 | integer | — |
| `month` | 是 | string | — |
| `ranking` | 是 | Array&lt;[Rank](#schema-rank)&gt; | — |
| `timezone` | 是 | `"Asia/Taipei"` | — |
| `waste_type` | 否 | `"general"`、`"recycling"` / null | — |

<a id="schema-stop"></a>

### Schema Stop

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `label` | 是 | string | — |
| `latitude` | 是 | number | 最小 `-90.0`；最大 `90.0` |
| `longitude` | 是 | number | 最小 `-180.0`；最大 `180.0` |
| `priority` | 是 | string | — |
| `waste_types` | 是 | Array&lt;`"general"`、`"recycling"`&gt; | — |
| `work_order_ids` | 是 | Array&lt;string (uuid)&gt; | — |

<a id="schema-target"></a>

### Schema Target

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `id` | 是 | string (uuid) | — |
| `kind` | 是 | `"report"`、`"work_order"`、`"proposal"`、`"adoption"` | — |

<a id="schema-taskreading"></a>

### Schema TaskReading

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `bin_id` | 是 | string (uuid) | — |
| `classification_source` | 否 | string | 預設 `"legacy_unclassified"` |
| `event_type` | 是 | `"collection"` | — |
| `fill_level_pct` | 是 | number | — |
| `id` | 是 | string (uuid) | — |
| `observed_at` | 是 | string (date-time) | — |
| `received_at` | 是 | string (date-time) | — |
| `source_type` | 是 | string | — |
| `waste_type` | 否 | `"general"`、`"recycling"` / null | — |
| `work_order_id` | 是 | string (uuid) | — |

<a id="schema-tier"></a>

### Schema Tier

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `code` | 是 | string | — |
| `name` | 是 | string | — |
| `threshold` | 是 | integer | — |

<a id="schema-usageread"></a>

### Schema UsageRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `capacity_liters` | 是 | number | — |
| `classification_source` | 是 | string | — |
| `estimated_hours_to_90_pct` | 是 | number / null | — |
| `estimated_used_liters` | 是 | number | — |
| `fill_level_pct` | 是 | number | — |
| `fill_rate_pct_per_hour` | 是 | number | — |
| `last_emptied_at` | 是 | string (date-time) / null | — |
| `priority` | 是 | `"critical"`、`"high"`、`"medium"`、`"low"` | — |
| `recorded_at` | 是 | string (date-time) | — |
| `source_type` | 是 | string | — |
| `waste_type` | 是 | `"general"`、`"recycling"` | — |

<a id="schema-userread"></a>

### Schema UserRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `auth_source` | 是 | `"demo"` | — |
| `display_name` | 是 | string | — |
| `districts` | 是 | Array&lt;string&gt; | — |
| `id` | 是 | string (uuid) | — |
| `roles` | 是 | Array&lt;`"citizen"`、`"staff"`、`"admin"`&gt; | — |

<a id="schema-validationerror"></a>

### Schema ValidationError

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `ctx` | 否 | object | — |
| `input` | 否 | object | — |
| `loc` | 是 | Array&lt;string / integer&gt; | — |
| `msg` | 是 | string | — |
| `type` | 是 | string | — |

<a id="schema-votecreate"></a>

### Schema VoteCreate

禁止未宣告欄位

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `vote` | 是 | `"support"`、`"oppose"` / null | — |

<a id="schema-workdetail"></a>

### Schema WorkDetail

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `completion_requirements` | 是 | [Requirements](#schema-requirements) | — |
| `evidence` | 是 | Array&lt;[EvidenceRead](#schema-evidenceread)&gt; | — |
| `latest_reading` | 是 | [TaskReading](#schema-taskreading) / null | — |
| `location` | 是 | [Location](#schema-location) | — |
| `reports` | 是 | Array&lt;[ReportRead](#schema-reportread)&gt; | — |
| `work_order` | 是 | [WorkRead](#schema-workread) | — |

<a id="schema-workread"></a>

### Schema WorkRead

—

| 欄位 | 必填 | 型別／允許值 | 限制／預設 |
| --- | --- | --- | --- |
| `accepted_at` | 是 | string (date-time) / null | — |
| `arrived_at` | 是 | string (date-time) / null | — |
| `assigned_staff_id` | 是 | string (uuid) / null | — |
| `bin_id` | 是 | string (uuid) | — |
| `blocked_by_removed_bin` | 是 | boolean | — |
| `classification_source` | 否 | string | 預設 `"legacy_assumed_general"` |
| `clear_reading_id` | 是 | string (uuid) / null | — |
| `completed_at` | 是 | string (date-time) / null | — |
| `completion_id` | 是 | string (uuid) / null | — |
| `confirmed_problem` | 是 | boolean / null | — |
| `created_at` | 是 | string (date-time) | — |
| `distance_m` | 是 | number / null | — |
| `district` | 是 | string | — |
| `event_id` | 是 | string (uuid) | — |
| `id` | 是 | string (uuid) | — |
| `is_fixture` | 是 | boolean | — |
| `is_overdue` | 是 | boolean | — |
| `photo_at` | 是 | string (date-time) / null | — |
| `priority` | 是 | `"immediate"`、`"high"`、`"normal"`、`"inspection"` | — |
| `reason` | 是 | string / null | — |
| `source` | 是 | `"citizen"`、`"sensor"`、`"inspection"` | — |
| `source_type` | 是 | `"demo"`、`"operational"` | — |
| `status` | 是 | `"pending"`、`"processing"`、`"arrived"`、`"waiting_sensor"`、`"repair"`、`"completed"`、`"dismissed"` | — |
| `submitted_at` | 是 | string (date-time) / null | — |
| `target_at` | 是 | string (date-time) / null | — |
| `type` | 是 | `"full"`、`"dirty"`、`"dumping"`、`"broken"`、`"other"` | — |
| `version` | 是 | integer | — |
| `waste_type` | 否 | `"general"`、`"recycling"` | 預設 `"general"` |
