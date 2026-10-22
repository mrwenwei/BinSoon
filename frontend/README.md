## 手機 sheet 與穩定性（2026-10-22）

手機 M1 的搜尋、分類、篩選、提醒回到底部 sheet。地圖資源、重載及 WebKit 檢查詳見 [手機地圖穩定性](../docs/MOBILE_MAP_STABILITY.md)；桌面保留上方控制列。

## BinU 修正（2026-10-21）

前端統一稱 BinU；M5 新增吉祥物 hero、私人命名與單一可選的吃飽了（80% 以上）通知。示範建議點保留穩定基礎票，V2 不顯示建立／我的提案入口；歷史回報呈現不同清潔員，登入帳號仍僅阿順。DEMO 照片改為垃圾桶造型；既有點數、私人桶名及投票保留。詳見 M／B／C 文件。

## B／C flow 更新（2026-10-21）

已接 V1–V2、U1–U4、S1–S4，L1／G1 不新增。U1「我的」提供功能卡；U2 為 3 點咖啡展示券；U3 的讚給該次完成清潔員並同步 S4；U4 每個 BinU的回報鍵直接進 M4。清潔員端採工單／路線／榮譽榜三分頁，S3 沿用 `CrewRoutePlanner` 道路地圖並在下方顯示桶數進度及已完成桶。市民本機回報已連到本機示範派工與一次結算；未串接真實派工、GPS、相機、LINE 或後端 staff 權限。契約與資料隔離細節見 [B／C flow](../docs/BC_FLOW.md)，本節優先於下方舊展示描述。

## M flow 更新（2026-10-21）

市民採手機底部、桌面頂部三分頁（地圖／要桶投票／我的）；Demo 身份切換先顯示既有一鍵登入頁，登入後到市民地圖或清潔員派工首頁，取代漢堡選單。M1 搜尋、垃圾種類與篩選移到地圖上方，新增可暫停及支援減少動態效果的提示跑馬燈。建議點獨立於 `#vote` 地圖，原列表保留於 `#vote/all`。M3 採道路地圖與資訊面板，滿桶可確認改導至同種類最近可用桶；M4 手機模擬拍照後有 1.6 秒本機 AI 判讀 loading、預選問題及手動修正。未使用真實 AI、GPS 或相機，後端回報模式不自動判讀。詳見 [M flow 範圍與限制](../docs/M_FLOW.md)。下文舊導覽敘述為歷史。

# BinSoon 前端：API 地圖、回報、查證與現場處理

2026-10-21 清潔隊選單整合為單一「清潔員管理入口」`#crew`。以模擬清潔員阿順一鍵登入，不需要後端帳密；P18 今日派工含待處理 5／處理中 1／已完成 9 的假資料。P19 可檢視民眾模擬照片及桶位；只有手機 UA＋觸控能力才可確認到場、選屬實／不實與垃圾組成、產生模擬完成照／選填桶內照並完成清運，桌面縮窄也阻擋。照片為帶 DEMO 標記的 SVG 假圖，無真實相機、GPS 或相簿。P20 今日建議路線用固定示意路網，可切換步行、機車、汽車，含起點、順路清單與模擬開始導航；不呼叫外部路線或底圖服務。清潔員登入僅保存在該分頁 sessionStorage，派工進度與假照在獨立 localStorage 帳本保存，不取得真實 staff 權限、不送 API、不更動市民帳本。舊 `#staff/*`／`#admin/*` 後端工具保留直連供既有驗證，但不再列在公開選單中。 畫面參考 P18／P19／P20 版面配置，UI 沿用既有 design system：深色 panel／chrome、薄荷選中、青綠 CTA、橘色僅警示，字體／間距／圓角使用現有 token。

2026-10-21 市民本機展示：點「認領這位 BinU」→取私人桶名→確認認領，立即可在本機體驗認養功能。每位認領者均可各自自由命名及更名，無須命名審核，私人名稱不影響其他人或公開 Bin 名稱。有效及待審認領合計至多 5 個，提交時再次檢查（含跨分頁），結束後釋出名額。預設提供「全家炸雞桶」、「下班等公車桶」、「早餐店轉角桶」三個認領；既有本機帳本會保留案件、投票及已結束認領並補入新展示。私人桶名僅登入展示身份後顯示於認領、地圖及桶詳情，不會送往後端；不是多帳號雲端儲存。下方後端模式的單一公開認養及提案人命名為舊契約，尚未遷移或部署。

合併驗證（2026-10-21）：`typecheck`、`data:check`、`build` 通過。完整桌面／手機 E2E 424 項先通過 422 項；另兩項仍要求舊直角虛線的斷言，已同步為路線服務失敗不畫線，`--last-failed` 重跑 2 項全通過。P12 支持／失敗重試／重整、步行／機車／汽車道路路線、QR 移除、桌面直接回報及窄視窗阻擋、手機先分享模擬座標才可模擬拍照、無相簿入口與不呼叫真實相機／GPS 均已驗證。桌面與手機模擬畫面已檢視，API 及路線服務使用攔截資料；未驗實體手機與正式外部服務，未部署。


2026-10-21 市民導航改為 Google Map 式「只有步行」：移除步行／機車／汽車切換，請求固定 Valhalla pedestrian costing，沿用 polyline6 解析；路線為橘色（`--route`）粗線加深色外框，走過的路段變淡；底部資訊卡顯示預估分鐘、距離、桶名與種類、「開始導航」與可展開的逐步轉彎指示（Valhalla 沒有中文敘述，請求仍用 en-US，由前端依 maneuver 類型與街名組成中文）；開始後頂部指示條隨模擬前進（固定速度，`prefers-reduced-motion` 時改為定時跳到下一個轉彎點）更新，結束顯示「已抵達」。起點仍是大安森林公園固定展示點，不取真實 GPS；換種類或替代桶時取消舊請求並移除舊路線，服務失敗可手動重試，不畫假路線。清潔員路線（機車／汽車）不變。實作依 [Valhalla 官方契約](https://valhalla.github.io/valhalla/api/route/api-reference/)。

2026-10-21 普通回報與認養快捷通報限手機瀏覽器（手機 UA＋觸控能力；縮小桌面視窗仍阻擋）。本輪只做 happy path 展示：先按「分享目前位置（模擬）」明示以桶座標模擬授權，再驗證 50 公尺內，才可按「現場拍照（模擬）」產生 DEMO 圖。移除相簿／檔案上傳、手動座標及舊測試工具；不呼叫真實相機或 GPS。前端入口與送出都檢查手機能力；這是介面限制，不是後端裝置認證。清潔隊照片及後端契約維持。


2026-10-21 新增 P12 投票完成頁 `#vote-done/<proposal_id>`：地圖與提案詳情按支持，只有指令成功且回傳本人支持票時才導向；上方返回原點位／提案，底部僅「回到地圖」。頁面只讀最新提案票數與狀態，重整不重送投票；反對／撤票留在原頁，失敗或未知結果也留在原頁重試原命令。單欄票數卡、設置流程時間軸及支持紀錄提示參考 P12，沿用既有色票；不新增分享或我的投票進度 CTA，不虛構已催生桶數。60 人門檻只用於本機展示，後端模式依伺服器狀態呈現。


2026-10-21 建議設置點已整合要桶投票：從地圖／清單選取 `placement_status=proposed` 的 Bin，在原地圖面板直接顯示支持／反對票數、支持率、待現勘狀態與支持／反對／改票／撤票；手機保留上方地圖。未登入先登入再回到原 Bin。未設置點不顯示槽位滿度、導航、回報、認養或清運紀錄。

預設本機展示會替已載入、尚無提案關聯的建議 Bin 推導零票展示提案，使用穩定的 Bin ID 關聯；投票後與「要桶投票／我的投票」共用原本機帳本，重整不重複計票，也不消耗市民新增點額度。未保存的推導提案，直接分享其展示詳情網址時會先重讀原 Bin。原始點位、來源欄位與後端資料不改寫；模型推薦分數不轉成票數。後端模式僅以 Bin ID 對應既有提案（跨分頁查找），無關聯時明示尚無可投票提案，不自動建立。

Playwright 可用 `PLAYWRIGHT_PORT=5184 npm run test:e2e` 指定獨立本機測試連接埠，避免沿用其他開發伺服器的快取。

本輪驗證：`typecheck`、`data:check`、`build` 通過；完整桌面／手機 E2E 418 項，首輪 417 通過、1 項返回清單焦點競態失敗。已修正延遲標題聚焦搶走地圖標記焦點，並讓投票卡標題在資料讀取期間保持同一 DOM；修正後重跑新投票、地圖焦點、種類切換、導覽與窄版版面的 16 項全部通過。最後未再重跑全部 418 項。已檢視桌面與手機模擬畫面；使用 API 攔截，未驗實體手機或正式服務，未部署。


React＋TypeScript＋Vite，Leaflet／MapLibre 地圖。地圖位置與後台仍串接後端，市民預設使用下述本機展示。保留的後端整合模式範圍為 GitHub [#6](https://github.com/mrwenwei/BinSoon/issues/6)、[#7](https://github.com/mrwenwei/BinSoon/issues/7)、[#8](https://github.com/mrwenwei/BinSoon/issues/8)、[#9](https://github.com/mrwenwei/BinSoon/issues/9)、[#10](https://github.com/mrwenwei/BinSoon/issues/10)、[#11](https://github.com/mrwenwei/BinSoon/issues/11)、[#12](https://github.com/mrwenwei/BinSoon/issues/12)、[#13](https://github.com/mrwenwei/BinSoon/issues/13)、[#14](https://github.com/mrwenwei/BinSoon/issues/14)、[#15](https://github.com/mrwenwei/BinSoon/issues/15)、[#16](https://github.com/mrwenwei/BinSoon/issues/16)、[#17](https://github.com/mrwenwei/BinSoon/issues/17)、[#18](https://github.com/mrwenwei/BinSoon/issues/18)、[#19](https://github.com/mrwenwei/BinSoon/issues/19)、[#20](https://github.com/mrwenwei/BinSoon/issues/20)。

## 預設市民展示模式（2026-10-21）

市民側邊選單只保留找垃圾桶、要桶投票、會員中心；我的回報、集章等級、獎品兌換及站內通知由會員中心進入。桌面頂欄也不再重複我的回報入口。認養申請從地圖桶詳情的「待認養」進入，沿用該桶 ID 與既有權限檢查；未登入先登入；市民本機展示容許其他人各自認領同一桶，已撤除或未設置的桶不可認領。站內通知是回報查證與完工、提案、認養及異常的站內收件匣，非手機推播；清潔隊及管理員通知入口保留。

會員中心首頁 `#member` 只呈現等級、點數摘要、升級進度、六級徽章與集點說明；底部不再放回報摘要、點數明細、兌換或通知卡。共用分頁列可切換集章與等級、我的回報（`#reports`）、點數歷史紀錄（`#point-history`）、我的兌換（`#redemptions`）、通知與進度（`#notifications`）。「點數台帳」改稱「點數歷史紀錄」，獨立頁按每頁 20 筆呈現日期、增減、餘額及關聯案件／券碼。各頁換頁回到頂端，保留會員中心導覽與舊深連結；等級卡的「兌換獎品」仍開啟 `#rewards` 選獎品。

依使用者確認，市民端改為本機展示：

- 位置仍讀後端 `/map/locations`、`/bins/:id/view`；滿度在前端以點位 ID＋垃圾種類固定產生 0、18、35、50、66、79、85、96、100% 或未知，不會每次輪詢亂跳。地圖、清單、詳情、可用篩選及導航共用同一份滿度投影；維修、撤除與尚未設置仍不可用。冷啟動導航會先完整讀取 API 點位，再找展示中可用的替代桶。
- 點桶後的 bottom sheet／桌面面板移除「滿度與清運歷史」及「公布桶位置」詳情區塊，也不再輪詢歷史。兩槽、來源分類說明、提案待現勘與場所代表點的限制仍保留，沒有更改來源 CSV 或刪除 API 欄位。
- 市民按「以展示市民登入」即可使用「展示市民小安」，不用帳號或密碼。會員中心預設累積 128／可用 93 點，含示意案件、點數明細與兌換券；這些不是後端會員紀錄。
- 回報（含示意照片與 50 公尺展示距離）、提案、支持／反對／撤票、認養偏好與撤回／結束、通知已讀、獎品兌換均只寫瀏覽器。回報不派工、不自動查證或發可用點數；新提案仍是 `bin_type=proposed` 的待現勘展示點，不代表已設置。
- 本機帳本與照片使用獨立 `binsoon-citizen-demo-v1` localStorage；重新整理保留，不讀寫舊展示帳本，也不覆寫後端資料。展示登入記號只在此分頁 sessionStorage，不是真實 token，絕不傳給 API；登出只結束展示身份，帳本仍保留。清除本網站儲存資料會重新載入預設展示資料。
- 跨分頁寫入以 Web Locks 序列化並重新讀取帳本，避免重複花點；不支援 Web Locks 的瀏覽器僅保證同頁寫入序列。儲存失敗會明示錯誤，絕不改送後端。頂欄點數隨本機操作更新。
- 所有介面「電子雞」用語改為「BinU」，資料模型仍為 Bin／bins。

清潔隊與管理員繼續使用真正後端登入及既有流程，不會收到本機展示市民建立的案件。完整範圍與驗證見 [展示模式驗證](../docs/FRONTEND_CITIZEN_DEMO_VALIDATION.md)。下列串接能力說明及既有操作章節保留作為**後端模式**的說明。

### 後端整合驗證模式

前端保留後端契約供整合測試：此分頁的 sessionStorage `binsoon-data-mode=backend` 可啟用後端資料模式；測試 `apiFixture` 預設明確選此模式，市民展示測試則選 demo。後端隊員／管理員成功登入也會選 backend；回到市民登入頁仍可按免密碼的展示市民按鈕切回 demo。後端身份的私有 API 維持原 session／角色與 ETag 限制；不使用假 token 代替身份驗證。

## 目前可操作範圍

- 訪客地圖：十二區、搜尋、來源／桶況篩選、全部分頁、最近可用桶、桶詳情、分頁歷史與三種交通方式道路導航。未知維持 null，導航依後端 is_usable。
- 市民：帳號密碼登入、限手機的模擬現場拍照與座標分享、五類回報、案件進度、會員摘要與點數台帳。
- 隊員：責任區工單分類／篩選、接單、到場、逐筆查證。工單每步讀最新版本，衝突重讀後再次確認；查證入帳與完工分開。
- 隊員滿桶完工：到場後上傳 purpose=completion 照片、掛 evidence，再提交 finish。缺查證時不能提交；未收到清空回傳時為 waiting_sensor，不能視為結案。
- 隊員非滿桶處理：dirty／dumping／other 具備全部查證與完成照後提交 finish，不要求清空；broken 可填原因留待修繕，再依最新版本掛照及提交完成修復。桶況是否恢復可用由後端決定，不自行歸零或解除其他工單的維修限制。
- 無需處理：到場後上傳 purpose=site 的獨立現況照、掛 evidence、完成全部查證、填原因後 dismiss；與完成照草稿分開。顯示無需處理的原因與證據，不計 completed、不產生本次可讚成果。回報不實仍可有現場工作，不自行結案或關閉其他工單。
- 管理員：`/#admin` 輸入工單 UUID，或使用隊員工單提供的另開分頁連結；以獨立 admin session 讀版本、確認「非真實 IoT」後送出 demo-clear。清空先到仍須完成照、全部查證與明確 finish 才能結案。每次保留 reading_id 與命令識別供未知結果重試。
- 市民：桶詳情只呈現後端有效完成紀錄；對最新 completion.id 感謝一次，顯示後端 like_count／liked_by_me，不增加點數或排名。桶況、歷史、最近桶、導航及案件持續重新讀取後端，容量歸零本身不代表完工。
- 隊員道路指引：`#staff/route` 讀後端 origin 與有序站點，同桶合站、工單 UUID 各自保留；可篩一般／回收並選機車／汽車，手動請求既有 Valhalla 道路幾何與逐段指引。前景每 10 秒重讀站點、背景停止；工單／站點／車種變動取消舊指引，不以直線替代。起點固定示範，沒有即時 GPS、交通或順序最佳化。
- 會員兌換：`#member` 讀後端帳本，`#rewards` 分類／分頁選獎品 UUID 及確認兌換，`#redemptions`／`#redemptions/<id>` 查自己的 DEMO 展示券。未知結果保留原命令重送，沒有前端扣點／扣庫存。
- 月份成果：訪客／市民 `#outcomes` 看公開整隊成果；隊員 `#staff/statistics` 看責任區本人件數、平均時間、讚及後端並列排名。台北曆月、區及種類可切換，空值不填假基數，加給只展示說明。
- 提案投票：`#vote` 列表、`#vote/create` 選點查周邊與建立、`#vote/mine`／`#vote/votes` 追蹤自己的提案與投票、`#proposals/<id>` 分享詳情。周邊查詢不受找桶篩選影響，50m 鄰近案須明確確認不同需求，150m 已設置桶是提醒；額度及大安區界由後端判定。支持／反對／改票／撤票、票數及關票只使用後端結果。
- 提案審查／命名：`#admin/proposals` 分頁進入管理員審查，依最新 ETag 及合法階段操作；原提案人於 `#proposals/<id>` 在示範設置後送命名，管理員核准／附原因退回。
- 認養：桶詳情依後端可申請狀態進入 `#adopt/apply/<bin.id>`；市民 `#adopt`／`#adopt/<id>` 查看歷史、偏好、撤回與結束；管理員 `#admin/adoptions`／`#admin/adoptions/<id>` 分頁審核。pending 沒有權益；公開認養與命名分開。
- 認養快捷回報：有效認養於 `#adopt/<adoption.id>` 進入 `#quick-report/<adoption.id>`，仍需用手機分享模擬位置及完成模擬現場拍照，送出同一 `/reports` API。認養、種類及普通回報各自保留草稿；後端決定資格、首報與結算，不由前端補倍或追扣。認養詳情另讀台北曆月月報，含部分月份與零值。
- 站內通知：`#notifications`、`#staff/notifications`、`#admin/notifications` 依當前 session 讀自己的分頁／未讀資料；標已讀可重送原命令，再依 target.kind/id 進入案件。隊員／管理員入口仍需對應身份；無 LINE 或系統推播。
- 撤桶：管理員從桶詳情或 `#admin/bins` 輸入桶 UUID，於 `#admin/bins/<bin.id>` 讀獨立 lifecycle ETag、填原因並確認撤除。地圖預設依後端顯示近七日撤除標記，也可查全部撤除紀錄；其他分頁重新讀取後停止權益／回報，未完成工單受阻且路線排除此桶，歷史與既有結算保留。沒有通用更新／刪除或復原功能。
- #18–#20 的流程、測試與限制見 [快捷回報／通知／撤桶驗證](../docs/FRONTEND_FINAL_FLOWS_VALIDATION.md)。#12–#14 見 [會員／投票驗證](../docs/FRONTEND_ENGAGEMENT_VALIDATION.md)；#15–#17 的入口、版本衝突與資料限制見 [審查／命名／認養驗證](../docs/FRONTEND_STEWARDSHIP_VALIDATION.md)。

## 一般垃圾／資源回收

- 找桶、詳情、導航與回報可選一般垃圾（general）或資源回收（recycling）；預設一般垃圾。同一 Bin UUID 仍是一個位置，兩槽不增加公布桶位置數。
- 地圖、最近桶、詳情與歷史查詢帶 waste_type，切換後重新讀取，不沿用另一槽的滿度或維修限制。詳情列出後端 compartments，未知仍為未知，不平均、累加或複製滿度。
- 導航與回報深連結保留所選種類。回報 body 明確送 waste_type，照片／草稿按 bin_id 與種類隔離；未知結果及同帳號重登入沿用原 key／body，不改成另一槽重送。
- 歷史預設只查所選槽；「歷史種類」可選舊未分類（legacy_unknown），保留 waste_type=null，不混成一般垃圾。classification_source 與 simulated 讀值來源分開顯示；CSV 沒有分類證據，兩槽是展示假設。
- 回報清單與隊員工單可篩種類，案件、工作證據及完成紀錄顯示後端種類。管理員清空依 work_order_id 的種類，不讓前端覆寫；最新完成與按讚待重試命令按種類分開，會員點數不乘二。

新契約與資料限制見 [WASTE_STREAMS](../backend/docs/WASTE_STREAMS.md)。認養快捷回報也按種類及認養 UUID 隔離草稿。

## 背景更新與手動驗收

桶詳情與清單前景每 10 秒讀後端，保留現有內容直到新資料到達；有資料時不插入會推動版面的載入提示，首次載入及更新失敗仍有提示。地圖按位置 ID 更新標記，只有外觀改變才替換圖示；桶況更新不重設使用者縮放／拖曳，查詢位置集合改變時才重新框選範圍。背景停止、離頁取消與操作版本檢查維持原規則。

提案列表為空時，可從「建立提案」開始；逐步流程與單帳號可驗收的範圍見 [提案投票操作手冊](../docs/PROPOSAL_VOTING_WALKTHROUGH.md)。桶詳情更新修正見 [驗證紀錄](../docs/FRONTEND_REFRESH_VALIDATION.md)。

## 串接後端的回報模擬測試

使用手機瀏覽器進入正常入口選桶 → 回報問題；桌面（包含窄視窗）會顯示手機限定說明，無表單、拍照或送出控制項。認養快捷通報共用相同限制。

1. 選擇一般垃圾或資源回收，按「分享目前位置（模擬）」；明示用所選桶座標模擬距離 0 公尺，不讀取裝置 GPS。
2. 前端核對座標有限值、範圍及距桶 50 公尺內，才啟用「現場拍照（模擬）」；產生 DEMO PNG，不開啟實際相機，也沒有相簿／檔案入口。
3. 以市民帳號送出。照片、座標與草稿按桶、垃圾種類及快捷認養分開；未知結果沿用原命令重試。預設本機模式只寫此瀏覽器。

**在後端模式，模擬流程只生成輸入，送出會在目前連接的後端建立資料**（未設定 URL 時為 Cloud Run）。模擬照片／位置會在回報說明自動附加模擬標記，計入 500 字上限；不會冒充現場 GPS 或自動查證、發點、結案。權限、認養與停權限制仍由後端判斷。自動化測試攔截 API，不會建立雲端回報。詳見 [驗證與限制](../docs/FRONTEND_REPORT_DEMO_VALIDATION.md)。

## 清潔隊工單的一鍵模擬資料

在 `http://127.0.0.1:5173/#staff/tasks` 以隊員登入，接單 → 確認到場 → 開啟工單：

- 逐筆查證區的「填入模擬屬實資料／填入模擬不實資料」會預填結果與明示測試說明；另按「確認查證」才送出。查證屬實可能實際發點，不實可能累計停權；請使用測試案件。後端目前只在不實時保存 `rejection_reason`，屬實的測試說明不會另存成 demo 標記。
- 完成照片、現況照片各有「產生模擬完成照／產生模擬現況照」，產生用途分開、有 DEMO／非現場照片浮水印的 PNG。預覽不會上傳；按原「上傳並掛上…」才經 `/media` 與工單 evidence API 寫入後端。
- 損壞工單可「填入模擬待修繕原因」；無需處理區可「填入模擬無需處理原因」。只預填帶 `[模擬測試]` 標記的原因，保留原確認操作及證據條件。

未到場、非本人接單、撤桶或原命令待重試時，模擬工具沿用原限制；不自動接單、到場、查證、發點、掛照或結案。滿桶仍需管理員獨立示範清空。查證不需要另外提供 GPS。範圍及驗證見 [工單模擬工具驗證](../docs/FRONTEND_STAFF_DEMO_VALIDATION.md)。

## API 設定與身份

`frontend/.env.example` 提供公開 `VITE_API_BASE_URL`，未設定時使用已部署的 Cloud Run `/api/v1`。可改成本機 API；變更後重啟 dev／preview，正式網站則重新 build。本機 localhost／127.0.0.1／IPv6 loopback 一律請求同源 `/api/v1`，由 Vite dev 及 preview 代理至該 URL，支援 5180 等不同預覽埠；直接以靜態檔案伺服器開啟 dist 時也須提供此代理。這是公開 URL，密碼／token 絕不放入 VITE_* 或 Git。

後端模式帳號為 demo-citizen／demo-staff／demo-admin，密碼由維運私下提供，於後端登入表單輸入。預設市民展示模式不需密碼，使用上述本機展示身份。沒有 TaipeiPass／手機 OTP。後端 Session 只存在本頁記憶體，有效期由後端 expires_at 決定（目前 60 分鐘）；重整／關頁後須重新登入。各分頁身份互不覆蓋。登出清個人快取與草稿；不清後端資料。

尚未送出的照片／表單與未確認結果的命令僅保留於同頁記憶體，重新登入同一帳號可重試原命令；重試保留 key、body、ETag。重新整理會失去這些暫存，應先重新讀取案件確認結果，不把逾時當成失敗重建。

正式前端使用 https://binsoon.app/，保留 https://binsoon.pages.dev/（Cloudflare Pages）。後端允許 https://binsoon.app、https://binsoon.pages.dev、http://localhost:5173、http://127.0.0.1:5173。本機 loopback 的 Vite dev／preview 已使用同源代理，不需逐一新增埠號。其他非 loopback 的預覽 origin 或自訂網域仍需後端另設 CORS；API URL 無法取代 CORS。

桶況皆為 simulated，歷史 recorded_at 為模擬時鐘。照片及查證時間為後端 UTC 實際作業時間；兩者不混比。場所 reported_count 是統計，proposed 仍須依 placement_status 區分待現勘／示範設置。

## 歷史展示與測試

舊 A／B／D 展示完整保存在開發專用 `tests/legacy/index.html`，保留原 86 項歷史回歸；此入口不是正式產品入口，Vite production build 不包含它。它的 localStorage 帳本不會由正式首頁讀取、遷移或寫入。

新 API 測試攔截 HTTP 邊界，驗證目前流程；歷史回歸只驗證舊展示。兩者的通過數不能當成雲端整合或未串接功能已完成。新的驗證結果見 [串接驗證紀錄](../docs/FRONTEND_API_INTEGRATION_VALIDATION.md)。

下方 A／B／D 操作章節為歷史展示說明；正式首頁以本節列出的串接範圍為準。

## Clone 後在本機查看

先安裝 Git、Node.js 24（含 npm）；建議所有組員統一使用 Node 24。`package.json` 的支援範圍為 `^22.12.0 || >=24.0.0`。可用 `node --version`、`npm --version` 確認環境。前端 build 不需 Docker 或資料庫；正式首頁操作需要可用的後端 API 與允許的 CORS origin。底圖需要網路及瀏覽器 WebGL 支援。

### 第一次下載與 build

直接從原儲存庫的 `main` 下載：

```sh
git clone --branch main https://github.com/mrwenwei/BinSoon.git
cd BinSoon/frontend
npm ci
npm run build
npm run preview
```

開啟 [本機預覽](http://127.0.0.1:4173/)（以終端機顯示的 Local URL 為準）。終端機需保持執行，按 `Ctrl+C` 停止。開發／build 都在 `frontend/` 執行，不在 repo 根目錄執行 npm。

### 已下載專案，更新到最新 main

先保存／處理 `git status --short` 顯示的本機改動，再從儲存庫根目錄執行：

```sh
git switch main
git pull --ff-only origin main
cd frontend
npm ci
npm run build
npm run preview
```

若 `--ff-only` 提示分支分歧，先保留本機 commit 並請組員協助處理分支，不使用重設或強制推送。`npm ci` 依已提交的 `package-lock.json` 安裝依賴；每次拉取更新後重新執行即可。不需 clone fork，也不需切到功能分支。

### 開發模式

在 `frontend/` 執行：

```sh
npm run dev
```

瀏覽器開啟 http://127.0.0.1:5173/。終端機需保持執行，修改程式會自動更新；按 `Ctrl+C` 停止。預設固定使用 5173；被占用時可明確指定其他 port，本機同源 API 代理不受埠號影響。

### 建置並預覽正式產物

在 `frontend/` 執行：

```sh
npm run build
npm run preview
```

`build` 會先檢查 TypeScript，再產生 `frontend/dist/`；`preview` origin 也需後端允許 CORS；它提供本機 HTTP 服務，預設開啟 http://127.0.0.1:4173/（以終端機輸出為準）。保持終端機執行，按 `Ctrl+C` 停止。請透過此網址查看，不要直接雙擊 `dist/index.html`。更新程式後需重新執行 `build`，才能預覽新的產物。

## 常見本機問題

| 情況 | 處理方式 |
| --- | --- |
| `npm` 找不到、Node 版本不支援或 `EBADENGINE` | 安裝／切換到 Node 24，重新開啟終端機，再確認 `node --version` 與 `npm --version`。 |
| `ENOENT`、找不到 `package.json` | 確認目前目錄為 `BinSoon/frontend`。 |
| `npm ci` 下載失敗 | 確認可連到 npm registry 與網路代理設定後重試；保留已提交的 lockfile。 |
| 5173／4173 連接埠被占用 | 使用終端機顯示的下一個 Local URL，或指定 `npm run dev -- --port 5175`／`npm run preview -- --port 4175`。 |
| 雙擊 `dist/index.html` 是空白頁 | 改以 `npm run preview` 啟動 HTTP 預覽，再打開 Local URL。 |
| 更新後仍看到舊畫面 | 停止預覽、重新執行 `npm run build`，再執行 `npm run preview` 並重新整理瀏覽器。 |
| 地圖空白或字型載入失敗 | 底圖／字型需要外網，地圖需要 WebGL；檢查連線及瀏覽器硬體加速。清單和來源資料仍可查閱。 |

一般 build 不需要下載 Playwright 瀏覽器；只有執行下方 E2E 測試時才需要。手機版可先用瀏覽器開發者工具模擬；另一支手機不能連到這台電腦的 `127.0.0.1` 網址。

## A flow 1018 操作

預設大安區 47 筆公布桶位置，保留全市 811 筆位置紀錄與來源精度。P1–P9 已更新為找桶 → 詳情 → 導航 → 回報 → 審核 → 會員／兌換。

- 地圖提供最近三個可用示意桶、步行估算，以及餓了／還能裝／新設篩選。新設 30 天、撤除保留 7 天以固定的示意天數展示，並非原始資料的設置日期。撤除桶不能回報，滿桶／未知桶可改導其他可用桶。
- 站內導航顯示示意折線與轉彎提示，可「模擬目的桶吃飽」改導及「模擬抵達」。起點固定大安森林公園；時間為直線距離 × 1.3／每分鐘 75 公尺估算，未取得 GPS 或實際路網，不可作為實際通行指引。
- 桌面導航及回報入口提供本機生成的 QR Code；回報另有「在電腦體驗示範回報」。手機直接顯示表單。手機掃碼需可連線的部署網址，不能連另一台電腦的 localhost；帳本不會跨裝置同步。
- 回報共五類，需內建示意照片、32 公尺定位情境及登入；選「其他」需文字。78 公尺或定位失敗不能送出。認養身分在送出時依 B flow 最新核准關係判定；同事件第一位／後續回報者由事件紀錄自動判定。相同問題僅在未結案期間阻擋重複，結案後再次發生可新增事件。
- 「台北通登入（示範）」或虛構手機 0912345678，驗證碼固定 **123456**。不傳簡訊、不保存手機號碼、不啟用相機或真實定位。登入返回原頁並保留記憶體草稿；重新整理不保存未送出草稿。
- 送出後查看唯讀審核結果，切至 D 隊員介面接單、到場後查證通過／不實。確認屬實一般 +1、認養者 +2；同事件後續回報者 +0；待確認不能使用。通過或不實為最終結果，只結算一次。累積不實三次暫停本機帳號回報資格。
- 新版會員帳本從累積／可用各 **63 點**、48 次示意屬實回報起始。六級門檻 0／10／50／150／500／1000；會員等級依累積點數。兌換只扣可用點數，不降級。
- 獎品頁有全部／超商券／大獎分類。7-11 50 元券需 30 點、全家 50 元券需 50 點、日本機票 1000 點、iPhone Duo 3000 點；面額、成本及庫存皆為假資料。確認時檢查點數與庫存並儲存示意序號，不能用於真實商店。
- 帳號、完成按讚、案件、工單與兌換保存在 `binsoon-demo-1019-v3` localStorage；舊 `binsoon-a-flow-1018-v2` 只讀遷移並保持原樣；舊 v1 集章資料保持原樣，不讀寫、不混用。舊 `#stamps` 改顯示會員中心，舊掃碼入口改接回報。儲存不可用時會提示。
- B flow 已加入投票、認養與快捷通報；D flow 已加入獨立清潔隊工作台。已移除小車、車上垃圾、遛狗及桶印章 UI。原始 CSV、後端與資料庫保持不變，地圖維持沒有 150m 圈線。

完整規格見 [A_FLOW.md](../docs/A_FLOW.md)，來源差異見 [1018 盤點](../docs/A_FLOW_1018_GAP_ANALYSIS.md)。本版本在 `feat/frontend-v0` 開發，尚未合併時請使用 `git switch --track origin/feat/frontend-v0`（已有該分支則 `git switch feat/frontend-v0`）取得新版；上方 main 安裝／建置方法同樣適用。

## D flow 清潔隊工作台

開啟 `/#staff/tasks`（或頁尾「清潔隊工作台」入口），點「使用大安區示範隊員」。隊員登入與市民身份分開，採專屬選單：派工、通知、路線與個人榮譽榜。示範資料只初始化一次；重新整理保留已處理結果。

- 市民 A 回報或 B 認養快捷回報會加入同桶同問題的開放事件與工單。接單 → 示範已到場 → 逐筆查證。屬實首報一般 +1／送出時有效認養 +2，後報 +0；不實須填原因，結果只結算一次。
- 滿桶須到場查證、完成照及本次新清空回傳齊備才完成。照片先到會停在「待感測確認」；點「示範收到清空回傳」後，市民桶況立即更新為 0%，條件齊備自動結案。這是前端示範按鈕，沒有接收真實裝置訊息。
- 髒污／堆放依現場工作證據完成，清空不能代替清理；損壞可留待修繕。維修中／撤除桶即使 0% 仍不列可用桶。「無需處理」須原因與現況照片，不計工作件數。
- 通知連回該工單。清運路線可選「機車（一般機車）」或「汽車」，點「產生路線指引」後依道路繪製路線、顯示里程、預估時間與每站轉彎指引。同桶合站但各工單分開完成，車種選擇在工作台頁面切換間保留；變更車種或站點後須重算。起點仍固定大安森林公園，順序依派工，未做排程最佳化。
- 道路指引需連線公開 Valhalla／FOSSGIS 服務，不需金鑰。失敗或限流時保留站點／工單，不以直線冒充導航；估時不含即時路況及作業時間。可在 build 時以 `VITE_VALHALLA_URL` 指定相容 `/route` API（須支援跨來源、機車與汽車），範例見 `.env.example`；只放公開網址，勿放憑證。使用與正式部署限制見 [CREW_ROUTING.md](../docs/CREW_ROUTING.md)。
- 隊員排名依台北曆月完成件數，歷史基數與本次增量分開，前三名專案加給僅為展示。市民榮譽榜顯示隊整體成果。按讚關聯最新有證據的清運／清潔完成紀錄，每次最多一次，不影響排名或點數。
- 同一來源的瀏覽器分頁共用最新帳本，Web Locks 保護點數／工單等寫入，透過 storage 事件更新另一分頁；需 HTTPS 或 localhost 及支援 Web Locks 的新版瀏覽器。不跨裝置同步，示範身份不是權限控管。
- 舊 A v2 與 B v1 帳本保留；無效／不相容帳本顯示提示，不用空帳本覆蓋。儲存失敗不顯示已成功送出或兌換。未送出草稿仍僅存記憶體。

完整規格與驗證見 [D_FLOW.md](../docs/D_FLOW.md)、[D_FLOW_VALIDATION.md](../docs/D_FLOW_VALIDATION.md)。

## B flow 1018 操作

從「這裡需要桶」、會員中心「認養電子雞」或桶詳情認養入口開始；也可使用 `#nearby`、`#vote`、`#vote-progress`、`#adopt`。

- P10 在選定位置周圍300m搜尋全市既有桶，場所與提案不算桶，滿桶／未知仍算桶，示意移除桶不算。距離為直線；預設起點固定，並非GPS。
- P11 可點地圖、拖曳＋標記或輸入經緯度；棕框緯度25.012–25.048、經度121.525–121.570只是大安區展示矩形，不是精準行政區界。150m內有桶只提示，50m內有提案需確認不同需求才新增；每台北曆月最多3點，提案自帶支持票，不提供提案編輯／刪除。
- 每提案每人一票，累積期間可改票／撤票。門檻為60人且支持率至少60%（示意），支持47／反對3應是50/60、94%。人數足但支持不足送里長確認；達標或里長確認後結束該輪投票。
- 三個初始提案為示意：信義路可體驗一般投票；和平東路支持後剛好60%達標；市民大道反對後可體驗需里長確認。和平東路是歷史的本人提案，不占本月額度。從「展示控制」可調整其他市民示意票數，讓自行新增提案也能演示達標；並推進評估、會勘及命名，未通過需填原因。這些數字不代表真實投票，也不建立多帳號。
- 示範設置只在B呈現成果卡，不改681/130筆資料、不連後端；命名與認養者公開名稱分開。分享或複製連結不會把本機新增資料同步給其他裝置。
- P14／P15 選既有、未被認養的桶，填認養身分、公開名稱、店家選填介紹及通知設定。待審沒有加倍；以展示控制核准後才取得認養權益。可以認養多桶，一桶同時一名認養者；已有其他示意認養者或已移除的桶不能申請。
- 可撤回待審、結束認養及重新申請；歷史保留，重申仍需核准，不承諾3個工作天。三種通知可全部關閉，通知與月報是站內示意。認養不需自己清運。展示控制「移除此桶」只改本機展示，立即停止認養權益與新回報。
- P16「一鍵通報」是共用回報入口，仍須示意照片、距桶50m內及登入；已結束或未核准者改用一般回報。屬實首報一般+1、認養+2，送出時保存資格；後報0，首報不實不遞補。三次不實只停回報，仍可投票／提案／認養。
- B 的提案、認養、通知設定及移除情境存於 `binsoon-b-flow-1018-v1`，與A／D的v3共用作業帳本分開；A原帳本可讀入，既有點數／兌換保留。登出及重整不清除資料；不同瀏覽器／裝置沒有雲端同步。尚無真實登入、照片、定位、LINE、評分或派工。

完整規格見 [B_FLOW.md](../docs/B_FLOW.md)，驗證紀錄見 [B_FLOW_VALIDATION.md](../docs/B_FLOW_VALIDATION.md)。

## 驗證

完整回歸包含開發專用的 `tests/legacy/`，必須使用 Vite dev server。若 5173 正在執行 `npm run preview`，先停止該預覽再跑完整測試，避免 Playwright 誤用不含歷史入口的 production 產物。

另開終端機，在 `frontend/` 執行：

```sh
npm run typecheck
npm run data:check
npm run build
npx playwright install chromium
npm run test:e2e
```

桌面 Chromium 與 Pixel 7 尺寸測試涵蓋原始資料／十二區／來源區分、找桶／按讚、登入返回與回報草稿、拍照／距離驗證、審核及發點去重、三次不實停權、150 點升級、兌換不降級與重新整理保留、導航改導、舊帳本隔離，以及底圖失敗／無效儲存恢復。B flow另驗證投票雙門檻、月界線與額度、認養審批／退出／移除、命名、A/B獎勵接合及事件重開。另檢查 320px、768px 畫面無水平溢出並保存各頁截圖。手機為瀏覽器模擬，尚非實體手機驗證；真實外部登入、相機、定位、派工與兌換不在展示範圍。

## 資料與調整位置

- `src/data/locations.json`：811 筆快照，原始資料在 `../backend/data/`；更新 CSV 後於 repo 完整 checkout 執行 `npm run data:generate`，再執行 `data:check`。一般 Vercel build 不需存取 backend。
- `scripts/generate-data.mjs`：以 BOM-aware CSV parser 辨識欄位，驗證筆數、座標、十二區及追溯欄位，保留原始精度。後兩個 CSV 檔名與內容對調，只有真正的 130 筆場所資料可進入快照。
- `src/components/`：共用角色、位置詳情與 A／B flow 各頁；`src/data/binDemo.ts`、`demoStore.ts`、`reports.ts`、`rewards.ts`、`participation.ts`：獨立的示意資料、投票／認養規則與本機帳本；`src/map/`：Leaflet／MapLibre 與位置標記；`src/App.tsx`：篩選與頁面；`src/styles.css`：視覺及 RWD。

681 筆公布桶位置＋130 筆場所代表點稱為 **811 筆位置紀錄**。代表點並非個別桶，reported_count 是周邊統計，不展開、不混入缺口分析。所有資料均為公開資料快照，沒有即時桶況與現勘保證；部分來源座標相同或相近，縮小時標記會重疊，可放大或從清單選取每一筆。

## Cloudflare Pages

GitHub 連接 `mrwenwei/BinSoon`，Production branch 為 `main`；main 更新（含 PR merge）觸發正式部署。Root directory 設 `frontend`、Build command 為 `npm run build`、Output directory 為 `dist`。建置環境設定 `NODE_VERSION=24` 及公開 `VITE_API_BASE_URL=https://binsoon-api-887203439341.asia-east1.run.app/api/v1`。正式自訂網域為 https://binsoon.app/，保留 https://binsoon.pages.dev/；其他預覽及自訂網域需另外加入後端 CORS。此設定僅部署前端，不會部署 Cloud Run 後端。

## Vercel（替代方案，未部署）

Import `mrwenwei/BinSoon`，Framework 選 Vite，Root Directory 設 `frontend`，Build Command `npm run build`，Output Directory `dist`。Node 選 24.x。不需環境變數。Production Branch 使用 `main`；功能分支 PR 可另外產生 Preview deployment。是否能建立部署取決於 repo 的 Vercel 存取權限，本機 build 不需要 Vercel。

底圖及 Google Fonts 需要外網；瀏覽器需支援 WebGL。失敗時位置清單仍可查閱，字型有系統 fallback。MapLibre 引擎較大，build 可能提示 chunk 大於 500 kB，手機初次載入時間依網路而異。

[共用專案背景](../docs/PROJECT_CONTEXT.md) · [V0 與 PM 規格來源](../docs/FRONTEND_V0.md) · [Issue #1](https://github.com/mrwenwei/BinSoon/issues/1)

## 圖示致謝

「一般垃圾」「資源回收」的圖示取自 [Lucide](https://lucide.dev)（lucide-static v0.468.0，`trash-2`、`recycle`，未修改），內嵌在 `src/components/Icon.tsx`。

ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
