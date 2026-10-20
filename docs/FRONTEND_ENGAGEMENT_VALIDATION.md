# #12–#14：會員兌換、月份成果與提案投票

2026-10-20（Asia/Taipei）。本輪只修改前端；以 Playwright 操作正式入口並攔截 API 驗證，沒有部署、修改雲端資料、贈點、造票或建立雲端資源。

## 正式操作入口與契約

- `#member`／`#stamps`：讀會員等級、累積／可用／待確認點數、我的回報總數與點數台帳。零資料維持 0；不沿用歷史展示的 63 點／48 次。點數台帳可連回回報及展示券。
- `#rewards`：分類及 limit/offset 分頁；獎品 UUID、名稱、成本、庫存與可兌換狀態均來自 `/rewards`。靜態商品只用 code 對照圖示，絕不提供成本或庫存 fallback。確認後僅 POST `{reward_id}`＋Idempotency-Key，使用 `RedeemResult` 顯示成功及後端餘額／庫存，並重新 GET；前端沒有自行扣點或扣庫存。不實停回報不阻擋兌換。
- `#redemptions`／`#redemptions/<id>`：市民自己的分頁紀錄與可直接連結展示券。券碼明示 DEMO，無核銷按鈕或真實使用能力。
- `#outcomes`：訪客／市民只讀 `/public/outcomes`，顯示選定台北曆月／行政區的整隊 completed_count、like_count；公開 API 沒有個人平均時間及排名，不補造這些欄位。
- `#staff/statistics`：只有隊員可讀 `/staff/statistics`，行政區選單限 session 責任區；呈現本人 completed_count／like_count／average_processing_seconds 與後端 ranking。null 平均時間顯示無資料；同分名次使用後端 rank，讚與速度不破同分。加給只有展示說明，沒有金額與發放。
- 成果頁依 Asia/Taipei 決定初始月份，支援月份、行政區及種類切換，前景每 10 秒與「更新成果」重讀；切背景停止，離頁／切條件 abort，舊回應不能覆蓋新月份。
- `#vote`：依行政區／狀態分頁查公開提案；`#vote/mine`、`#vote/votes` 分別讀自己的提案及投票。`#proposals/<id>` 是可重新載入的後端詳情與分享連結。
- `#vote/create`：市民填名稱、需求原因、數值座標，或在地圖選點／拖曳。經緯度檢查有限值與全球範圍，實際大安區多邊形仍由後端驗證；不使用 demoBounds、不調整座標來假裝通過。先讀 `/me/proposal-quota` 及不帶任何行政區／來源／桶況篩選的 `/map/availability?latitude&longitude`。已設置桶包含滿桶、未知、維修；場所及未設置 proposed 不當作既有桶。
- 150m 已設置桶顯示參考提醒及成功回應的 warnings，不阻擋提案。409 `NEARBY_PROPOSAL` 顯示附近提案與不同需求確認，使用者確認後才用原內容＋`confirmed_nearby=true` 建立新 key。區外／超額拒絕保留原輸入。建立成功不再補送支持票；proposal.id 用於提案，proposal.bin_id 用於點位。
- 支持／反對／改票／撤票只 POST `{vote}` 並使用回應與後續 GET。support_ratio 乘 100 顯示百分比，null 顯示無資料；關票與狀態全部讀伺服器，沒有前端加票、60 人造票或跳關控制。409 `VOTING_CLOSED` 重讀進度，不偷偷用新 key 重送。

## 命令與身份

兌換、提案建立及投票沿用共用記憶體命令儲存。未知結果／5xx／401 保留原 key、序列化 body、ETag 及帳號 ID；同頁重新登入原帳號後可明確重試。重複點擊有同步鎖。不同帳號不能重送別人的命令；登出清除命令與草稿。提案輸入可跨同頁登入失效保留，明確登出或更換帳號清除。重新整理會失去記憶體命令，應先查自己的紀錄，不能把斷網視為未成功。

## 驗證範圍

測試：`api-rewards.spec.ts`、`api-outcomes.spec.ts`、`api-proposals.spec.ts`、`api-engagement-responsive.spec.ts`，fixture 在 `api-engagement-fixture.ts`。

涵蓋兌換成功、UUID／body、售罄／不足、重複點擊、未知成功與重登入同 key；分類分頁、自己的展示券列表／深連結；公開／私有成果分離、並列、null／空資料、快速月份切換、重新讀取；不帶篩選的周邊檢查、50m 確認的新 key、150m warnings、區外／額度拒絕保留輸入、提案重登入重送、三種提案列表分頁、詳情重載、改票／撤票及關票。60 人只使用本機 fixture。畫面驗證含桌面 1440、手機 393 與窄螢幕 320、橫向溢出、鍵盤輸入，以及明確的 API 失敗／403／404。

`typecheck`、`data:check`、`build` 已通過；資料仍是 811 筆位置紀錄（681 公布桶位置＋130 場所代表點），大安區 47＋18。build 保留既有大型 bundle 提醒，未以改門檻隱藏。

已檢視桌面與手機的獎品、展示券、公開成果、提案列表／詳情／空白建立表單，以及隊員並列排名與周邊位置查詢截圖。320px 檢查沒有橫向溢出，鍵盤可填表，地圖有來源署名及清單替代操作；外部底圖未完整載入的截圖不當作真實圖磚服務驗證。截圖保存在本機 `.scratch/frontend-engagement/`，未加入 Git。

完整 `npm run test:e2e` 共 238 項，首次 **236 通過／2 失敗（5.8 分鐘）**；失敗是同一個舊測試仍要求 vote 入口「尚未開放」的桌面與手機版本。依 #14 更新預期後，重跑整份 `api-staff.spec.ts`，**10 項全數通過（21.1 秒）**，包含該兩項。三張票新增的 32 項都在完整執行中通過。最後 build／typecheck、Prettier 與 git diff --check 亦通過。

執行中觀察到 MapLibre／Leaflet 整合套件快速卸載後的偶發 getZoom 空值回呼錯誤，堆疊位於套件 `_transitionEnd`；未造成這輪測試失敗，但本輪未修補此第三方套件問題。這與大型 bundle 提醒、外部底圖服務限制一併保留，不能把測試通過解讀為已排除所有地圖執行期警告。

## Standards

以開始前 `bf0d042e75e87b87ac03bbba8709de28299e6172` 為基準，獨立子代理依 AGENTS、前端指引、設計系統及程式異味基線審查。初次指出卡片獨立連結觸控範圍不足 44px（1 項規範問題），另有投票標籤三元式重複（1 項非阻擋判斷）。已加入共用 `.api-action-link` 並整理 voteOptions；複核無剩餘發現。

## Spec

另一獨立子代理依 #12–#14 及後端實作契約審查，找到鄰近提案拒絕後地圖重新選點未清除舊錯誤（1 項）。已修正、開放空白表單直接地圖選點，並補「首次選點→鄰近拒絕→重新選點→成功送出」回歸，桌面／手機通過；複核無剩餘發現。

審查結果：Standards 1 項規範問題及 1 項非阻擋判斷、Spec 1 項問題均已處理，兩軸目前各 0 項未解決。

## 未驗證與資料限制

未以真人密碼或真實雲端執行這些流程，API 攔截不能證明真實 CORS／雲端整合；未使用實體手機。底圖、字型與外部網路仍依服務可用性，地圖保留來源署名及清單替代入口。所有滿度及容量仍為 simulated；CSV 無雙種類證據，分類仍屬 demo_assumption。提案不代表已實際設置；展示券不能真實核銷。認養、命名與通知等後續票仍未串接。
