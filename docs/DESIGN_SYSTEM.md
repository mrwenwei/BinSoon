# BinSoon 設計系統 v1（初步 design guideline）

2026-10-19 起前端全面換成設計者提供的「BinSoon 色票」。本文件是前端實作的規範與對照表；設計權威來源是設計者的 BinSoon 色票設計系統（README、tokens、MapMarker／StationCard／SingleBinCard／NearestList 元件說明）與 style-a／style-b 設計稿。兩者有出入時以設計系統 README 為準，並記錄在文末「待決事項」。

一句話：**任務控制台的骨架，加上像素電子雞的親切感。** 深炭灰的頂欄、面板和卡片，中間放灰綠色的地圖；青綠代表「可以去」，訊號橘只代表「吃飽了」。

## 1. 設計原則

1. **深炭灰骨架＋灰綠地圖。** 頂欄、卡片、圖例列用 `chrome`，面板和頁面底用 `panel`，輸入框用 `field`；地圖（含 MapLibre 底圖）用 `map` 系列。
2. **青綠是「去」，橘色是「換一個」。** 主要行動一律 `teal`（文字 `text-on-light`）。`signal` 只用在吃飽了的色帶、斜紋警示條、滿度數字、警示框線與問號點綴，**永遠不做按鈕**，就算整張卡片是橘色，主按鈕仍是青綠。
3. **用色塊和線分層，不用陰影。** 區塊分隔線 `divider`（2px）、清單列之間 `hairline`（1px）、卡片內 `line`（1px）。唯一例外是地圖電子雞的 2px 像素投影（MapMarker 規格）。
4. **薄荷底上不放 #4aba94 文字。** 薄荷底上的青綠文字一律用 `teal-on-mint`；一般文字用 `text-on-light`。
5. **失聯一定加虛線外框。** `status-offline` 灰與青綠亮度接近，不能只靠顏色。
6. **不放的東西：** MISSION、SYS、編號導覽、統計數字列（811／681／32）、DEMO FEED 標籤、卡片頂端 STATION／FULL 列。資料揭露（simulated、示意、demo_assumption）仍要保留，用小標或說明句呈現。
7. **手機優先（390×844）。** 先確保手機沒有橫向捲動、觸控目標至少 44px、輸入框字級 16px（避免 iOS 放大），再調桌面（1440×900）。

## 2. 色彩 token 與用途

所有顏色只來自 `frontend/src/styles/tokens.css`（設計系統產生、勿手改）。需要淡色時用 `color-mix()` 混 token，不寫死色碼。

| 角色 | Token | 用途 |
| --- | --- | --- |
| 深色骨架 | `chrome` #232826 | 頂欄、卡片、圖例列、縮放鈕、點數按鈕底 |
| | `panel` #181d1c | 頁面底、桌面左側面板、側邊選單 |
| | `field` #222827 | 輸入框、深色面板裡的次要色塊 |
| 選中 | `mint` #bfd9c5 | 已選分頁切換、已選篩選膠囊、Logo 底塊、會員等級卡、清潔隊篩選列 |
| 地圖 | `map`、`map-block`、`map-park`、`map-road` | 地圖底、街區、公園、道路（MapLibre 自訂底圖也用這組） |
| 文字（深底） | `text`、`text-muted`、`text-body` | 主要文字與大數字、次要文字與英文小標、卡片說明句 |
| 文字（淺底） | `text-on-light`、`text-on-light-muted` | mint／map／teal／signal 底上的文字；電子雞外框 |
| 線 | `line`、`line-control`、`line-input`、`divider`、`hairline` | 卡片內線、外框按鈕、輸入框框線、區塊分隔、清單細線 |
| 主要行動 | `teal` #4aba94 | 主按鈕、目前分頁底線、編號與分鐘數、可以丟、焦點色 |
| | `teal-on-mint` #1d6650 | 薄荷底上的青綠文字 |
| 吃飽了／注意 | `signal` #f2673a、`signal-on-light` | 吃飽了色帶、斜紋、滿度數字、警示左框；淺底上的橘字、地圖準線 |
| 桶況 | `status-hungry`、`status-full`、`status-offline` | 電子雞身體、色帶、圖例 |
| 電子雞 | `mascot-eye`、`mascot-blush`、`place` | 眼白、腮紅、場所代表點身體 |
| 焦點 | `focus-ring` | 鍵盤焦點 2px 外框 |

`styles.css` 開頭另有少量**衍生 token**（全部由上表混出）：`--tint-teal`、`--tint-signal`、`--tint-place`（卡片內淡色底）、`--scrim`（側邊選單遮罩）、`--marker-shadow`（電子雞投影）。舊樣式沿用的 `--ink`、`--green`、`--muted`、`--paper` 只是指回色票的別名，新程式不要再用。

**允許的非 token 色碼（例外清單）**

- `frontend/index.html` 的 `<meta name="theme-color" content="#232826">`：瀏覽器頂欄色無法讀 CSS 變數，數值等於 `chrome`。
- MapLibre 底圖與 Leaflet 路線、QR Code 需要實際色值：`src/map/basemapStyle.ts` 的 `token()` 在執行時讀 `:root` 的 token；水域色由 `map-park` 混 `teal-on-mint` 算出。程式內沒有寫死色碼。

## 3. 字體與字級

四套 Google Fonts，在 `styles.css` 第一行 `@import` 載入：

- **Chakra Petch**（`--font-display`）：數字與英文品牌字（滿度、計數、分鐘數、BinSoon、點數）。
- **IBM Plex Mono**（`--font-mono`）：全大寫英文小標（AVAILABLE · 示意、FILL LEVEL、STATUS、FROM 大安森林公園）。
- **Noto Sans TC**（`--font-sans`）：所有中文，也是 body 預設字。
- **Silkscreen**（`--font-pixel`）：像素點綴，極少量；目前未使用。

字級一律用 token：`--text-numeral-xl/lg/md/sm`、`--text-label`、`--text-label-lg`、`--text-title`、`--text-card-title`、`--text-heading`、`--text-status`、`--text-caption`。tokens.css 同時提供 `.numeral-xl`、`.label` 等工具 class，`.label` 已用在面板小標與側邊選單分組。頁面 h1：桌面 30px／手機 22px（Noto Sans TC 700）；地圖面板大標用 `--text-title`（手機縮成 24px）。

## 4. 間距與圓角

- 間距：`--space-1` 4、`--space-2` 8、`--space-3` 12、`--space-4` 16（手機左右邊界）、`--space-5` 18（卡片左右內距）、`--space-6` 28（桌面面板與地圖浮層邊距）。
- 圓角：`--radius-xs` 2（分頁切換內按鈕、圖示框）、`--radius-sm` 4（按鈕、輸入框、標籤、點數按鈕）、`--radius-md` 6（卡片、桶況卡）、`--radius-pill`（篩選膠囊）。圓形只用在等級徽章與失聯／選中的圓框。舊樣式的圓角已全部換成這四個 token。

## 5. 元件

| 元件 | class／檔案 | 規則 |
| --- | --- | --- |
| 主按鈕 | `.button.primary` | teal 底、`text-on-light`、高 44、圓角 sm；卡片內主按鈕文字靠左、箭頭靠右 |
| 外框按鈕 | `.button.secondary` | 透明底、`line-control` 框、`text` 字（設計稿「回報狀況」） |
| 文字按鈕 | `.text-button` | teal 底線文字，至少 44×44 |
| 卡片 | `.card` | chrome 底、1px `line` 框、圓角 md、無陰影 |
| 篩選膠囊 | `.filter-chips button` | pill、`line-input` 框；已選為 mint 底＋`text-on-light` |
| 分頁切換 | `.tabs` | 外框 sm、內按鈕 xs；已選為 mint 底 |
| 頂欄分頁 | `.primary-tabs`、`.desktop-nav` | 未選 `text-muted`；目前頁 `aria-current="page"`，白字＋3px teal 底線 |
| 輸入框 | `input`、`select`、`textarea` | field 底、`line-input` 框、高 44；手機 16px 字 |
| 回報哪一桶 | `WastePicker`（`components/WasteType.tsx`）、`.segmented` | 兩格單選（原生 radio），選中為 2px teal 框＋teal 字 |
| 種類標籤 | `WasteTag`、`.waste-icon` | 一般垃圾（垃圾桶圖示）／資源回收（♻），只用圖示和文字區分，不加顏色 |
| 桶況卡片 | `StationCard`（`components/StationCard.tsx`）、`.station-card` | 見第 6 節 |
| 最近的可用小夥伴 | `.nearest-card`（API 地圖頁） | 2px divider 標題線、1px hairline 列線；編號與分鐘數 teal、`numeral-sm`，不加深色底塊 |
| 地圖標記 | `mascotSvg()`、`markerIcon()`、`.pixel-marker` | 見第 7 節 |
| 圖例 | `MapLegend`、`.map-legend` | 地圖底部 chrome 列：餓了／吃飽了／失聯（虛線）／場所代表點 |
| 地區標籤 | `.map-district` | 地圖左上 chrome 小牌＋7px teal 方塊 |
| 頂欄＋側邊選單 | `AppNav`（`components/AppNav.tsx`）、`.topbar`、`.drawer` | 見第 8 節 |
| 狀態膠囊 | `.status-pill.state-*` | 青綠／橘色字與框；失聯是虛線框 |

## 6. 桶況：前端三態、後端四態與雙桶

**前端只有三態**（`src/data/binState.ts`，唯一定義）：

| 前端 BinState | 文案 | 條件 | 視覺 |
| --- | --- | --- | --- |
| `hungry` | 餓了 | 0–79% | `status-hungry` 青綠 |
| `full` | 吃飽了 | 80% 以上 | `status-full` 橘，滿度條加斜紋 |
| `offline` | 失聯 | 沒有讀值、維修中或撤除 | `status-offline` 灰＋虛線外框 |

**後端 API 仍回四態 `fill_status`**（hungry <50、half 50–79、full ≥80、unknown＝未知／維修／撤除）。前端只在 API 轉接層對照，不改後端與 API 契約：`src/data/api.ts` 的 `apiBinState()`：`hungry`、`half` → hungry；`full` → full；`unknown` → offline。狀態列文字由 `components/api/Waste.tsx` 的 `statusText()` 產生（撤除→「已撤除」、維修→「維修中」、無讀值→「失聯」、其餘「餓了 · 62%」）。視覺對照（token、虛線、class）集中在 `src/components/binVisual.ts` 的 `stateVisual`，CSS 用 `.state-hungry/.state-full/.state-offline`。

**一個點兩個桶**（與 `backend/docs/WASTE_STREAMS.md` 一致）：

- 每個公布桶點位都有 `general`（一般垃圾）與 `recycling`（資源回收）兩槽；CSV 沒有分類證據，屬 `demo_assumption`（舊單槽資料對應 general，`legacy_assumed_general`）。場所代表點沒有桶槽。仍是 811 筆位置紀錄、681 個公布桶位置，兩槽是同一位置底下的示意子桶，不新增地圖點、不改快照。
- **點位整體狀態**（`stationState()`）：任一桶能丟 → 餓了；沒有能丟的桶但至少一桶吃飽了 → 吃飽了；兩桶都沒有讀值 → 失聯。
- **API 模式**：讀 `Location.compartments`／`BinView.compartments`（`apiCompartments()` 依 general、recycling 排序）。舊回應沒有 compartments 時安全降級成單槽（以選定種類的 `status` 當一般垃圾），卡片改用 SingleBinCard 樣式並註明「後端未提供分槽資料」。
- **示意模式**（`tests/legacy` 歷史展示）：`src/data/binDemo.ts` 產生兩槽；一般槽沿用原本的單一示意讀值，回收槽讀值另存 `readings["<位置 id>:recycling"]`，維修只限制對應槽。
- **StationCard**（預設）：色帶顯示「幾桶能丟」0/2、1/2、2/2（`numeral-lg`），色帶左側 `AVAILABLE · 示意` 與總結句（兩桶都還能丟／資源回收還能丟／兩桶都吃飽了／兩桶都失聯）；吃飽了時色帶下加斜紋警示條。下方一般垃圾、資源回收各一列：圖示、狀態字、`numeral-md` 滿度、6px 滿度條（餓了實心青綠、吃飽了橘色斜紋、失聯虛線空條）。手機版兩列左右並排。
- **SingleBinCard**（備用）：`numeral-xl` 滿度＋`FILL LEVEL · 示意`。目前所有桶點都是兩槽，只有在 API 沒回 compartments 時才會出現。設計規範要求單桶點要提醒最近的另一種桶，未來若出現真正的單槽點要補上。
- **按鈕**：兩桶都能丟或一般能丟 →「導航過去」；只有回收能丟 →「導航過去丟回收」（`#nav/<id>?waste_type=recycling`，導航與替代桶查詢都帶 waste_type）；都不能丟 →「尋找可用桶並導航」。三種都是 teal 主按鈕。
- **回報與工單**：回報表單一定要選是哪一桶（預設一般垃圾），API body 送 `waste_type`；示意流程同一位置同一問題但不同種類是不同事件與工單。清潔隊清單與工單詳情用 `WasteTag` 標出種類。**認養仍以點位為單位**，涵蓋兩槽。
- **篩選**：「餓了的桶」（示意模式為「只看餓了的」）＝點位整體是餓了，也就是至少一桶還能丟；API 模式在前端依 compartments 篩選，「新設的桶」仍交後端。舊的「還能裝的桶」與「餓了」在三態下相同，已合併。

## 7. 地圖與標記

- **底圖**：`src/map/basemapStyle.ts` 的 `binsoonBasemapStyle()`，來源仍是 OpenFreeMap 的 openmaptiles 向量圖磚與字型；只畫街區、公園、水域、建築、道路、少量路名與地名，配色全取自 map 系列 token。保留 Leaflet 署名（OpenFreeMap · OpenMapTiles · © OpenStreetMap）與載入失敗提示（圖磚來源錯誤或 15 秒未讀到 TileJSON 時顯示 `.map-warning`）。
- **電子雞標記**（MapMarker）：32×36 像素圖（手機 26×29），底部中心對準位置，外框 `text-on-light`、眼白 `mascot-eye`、腮紅 `mascot-blush`，身體色依點位整體狀態；2px 像素投影。一個點只放一隻，不加 ♻ 或數字徽章。
- 失聯：1.5px 虛線圓框。場所代表點：`place` 身體＋頭上星星，沒有腮紅。
- 選中：2.5px `signal` 圓環＋橘色虛線十字準線（`.marker-crosshair`）。新設／撤除的小牌保留（新＝mint 底，撤＝虛線框）。
- 示意起點「起」：`text-on-light` 底、mint 字的小方塊；示意路線為 `text-on-light` 虛線。

## 8. 手機優先規則與導覽

- **頂欄（手機）**：最左漢堡按鈕｜「地圖｜要桶投票」兩個分頁｜右上點數按鈕（＝會員中心，顯示可用點數與 PTS；未登入時是「登入」，隊員／管理員顯示角色）。不放 Logo，**沒有底部導覽列**。
- **頂欄（桌面）**：漢堡＋Logo 底塊（mint）＋原有主選單（找垃圾桶、我的回報、會員中心、清潔隊工作台、管理員）＋點數按鈕＋帳號／登出。
- **左側側邊選單**（手機、桌面共用）：從左滑出、遮罩、Esc 與點遮罩可關閉、焦點鎖在側邊欄、關閉後焦點回到漢堡按鈕、點連結後自動關閉；`prefers-reduced-motion` 時不做滑動動畫。所有入口都在這裡：找垃圾桶、要桶投票、我的回報、會員中心、集章與等級、兌換獎勵、認養電子雞、清潔隊工作台、小車道路指引、管理員、各角色登入、帳號與登出。未開放的功能標「（尚未開放）」但入口保留。
- 地圖頁（手機）：地圖在上（56dvh，左上地區標籤、底部圖例列），下方接深色面板（標題、搜尋、篩選、最近的可用小夥伴、位置清單）。桶詳情是獨立頁，桶況卡在最上方。
- 觸控目標至少 44px；手機左右邊界 16px；輸入框 16px 字；不得有橫向捲動（e2e 會檢查 `scrollWidth <= innerWidth`）。

## 9. 程式對照

| 項目 | 位置 |
| --- | --- |
| 色票 token（設計系統產生，勿手改） | `frontend/src/styles/tokens.css` |
| 全站樣式 | `frontend/src/styles.css`：開頭 `@import` 字體與 tokens、衍生 token、頂欄與側邊選單、按鈕／膠囊／輸入框／卡片、地圖首頁、Leaflet 控制項、電子雞標記、一般頁面、桶況卡片、手機版媒體查詢；之後是舊 A／B／D 展示頁樣式（已全數改用 token）；最後是 API 正式流程樣式 |
| 三態與雙桶定義 | `frontend/src/data/binState.ts` |
| API 四態 → 三態、compartments | `frontend/src/data/api.ts`（`apiBinState`、`apiCompartments`、`apiStationState`） |
| 示意雙桶資料 | `frontend/src/data/binDemo.ts`（`binDemo().compartments`、`readingKey`） |
| 桶況視覺對照 | `frontend/src/components/binVisual.ts` |
| 電子雞 | `frontend/src/components/mascotSvg.ts`、`Mascot.tsx`、`frontend/src/map/marker.ts` |
| 桶況卡片 | `frontend/src/components/StationCard.tsx` |
| 種類圖示、回報選桶、種類標籤 | `frontend/src/components/WasteType.tsx` |
| 頂欄與側邊選單 | `frontend/src/components/AppNav.tsx`（正式入口 `App.tsx`、歷史展示 `tests/legacy/App.tsx` 共用） |
| 底圖樣式 | `frontend/src/map/basemapStyle.ts` |

## 10. 和設計稿仍有落差的待決事項

1. 地圖首頁：設計稿選桶後在地圖右上（桌面）或地圖下方（手機）浮出桶況卡；目前沿用現有流程，點桶進入獨立的桶詳情頁（場所代表點仍在地圖上浮出詳情）。
2. 頂欄分頁「要桶投票」：正式入口已串接提案／投票，分頁連到後端提案列表；選點及座標輸入都可用。
3. 桌面主選單：設計稿為找垃圾桶／這裡需要桶／認養電子雞／清潔隊榮譽榜；正式入口保留現有的找垃圾桶／我的回報／會員中心／清潔隊工作台／管理員（後三項設計稿未涵蓋但不可移除）。
4. 「最近的可用小夥伴」依所選一般垃圾／資源回收種類查後端 nearest-usable，不將兩槽滿度平均；面板註明目前查詢種類。
5. 會員中心、回報完成、認養、獎勵頁：設計稿的等級徽章、+1 點色塊、月報等版面只在歷史展示頁有完整對應；正式入口的會員中心與回報完成頁目前只換視覺（等級卡改薄荷色塊、加電子雞），資料欄位維持 API 現有內容。
6. 設計稿 Adopt 頁的「一鍵通報附近清潔隊」是橘色按鈕，違反「橘色不做按鈕」；實作一律用 teal／外框按鈕。
7. 設計稿 Stamps 頁仍有底部導覽列，與 README「手機沒有底部導覽列」衝突；依 README 拿掉，改用漢堡選單。
8. 失聯標記虛線框：預覽用 #4c5a53（非 token），實作改用 `text-on-light-muted`。
9. 頁尾的 simulated 說明、桶詳情的來源／座標詳情與歷史清單是資料揭露需求，設計稿沒有，保留但用小字。
10. SingleBinCard 的「提醒最近的另一種桶」：目前所有桶點都是兩槽，沒有實作；若未來後端出現單槽點需補上。
11. 回報表單仍是 API 版的下拉選單與座標欄位；設計稿的五格問題類型按鈕與頁內相機只在歷史展示頁。

## 與 API 流程整合（#10／#11）

StationCard 在正式桶詳情可選取各槽（原生 button、aria-pressed），維持本站整體可用數與三態視覺，導航、回報、歷史及清運感謝以目前種類查詢。回報 WastePicker 切換種類時保留各槽獨立照片草稿，重試不改原命令種類。一般槽不可用但回收可用時，另提供明確「導航過去丟回收」選項，不將一般垃圾需求默默改成回收。API 三態對照先依營運狀態、未知讀值及 is_usable 排除不可使用的餓了狀態，避免未設置／維修桶被描述成能丟。

清運道路入口已開放，手機與桌面的側邊選單可進入；後端有序站點與兩車種道路指引使用相同 token。桶詳情的歷史、來源及地圖保留分區，窄螢幕可用，分類假設／simulated 提示不移除。
