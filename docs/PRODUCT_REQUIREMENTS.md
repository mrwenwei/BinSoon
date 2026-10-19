# PM 產品需求與使用者流程

本頁集中提供 PM 使用 Claude 產生的產品文件，供組員與可存取本儲存庫的讀者查閱。根目錄 [README](../README.md) 提供本頁入口。

## PM 原始文件

以下連結由使用者於 2026-10-18 提供。後續已透過已登入瀏覽器核對「1018」版 PRD 的 A flow 相關規則、Web／手機 P1–P9 及 User Flow 的 Story 1；匿名存取權限仍未驗證。新版與現有實作的差異見 [A flow 1018 盤點](A_FLOW_1018_GAP_ANALYSIS.md)，使用者已確認採用三項建議，於 `feat/frontend-v0` 實作。

| 文件 | 閱讀用途 | 原始連結 |
| --- | --- | --- |
| PRD | 查閱 PM 產品需求 | [開啟 PRD](https://claude.ai/artifact/2K68x1RzGGiqZCFeXEK2i2#42996e66-512d.mffekfma0dy.24403) |
| Web flow | 查閱網頁版流程 | [開啟 Web flow](https://claude.ai/artifact/KB6pHmz23RY1EmUNYCtfk4#page-d63f1065a6ff) |
| 手機 App flow | 查閱手機 App 流程 | [開啟手機 App flow](https://claude.ai/artifact/KB6pHmz23RY1EmUNYCtfk4#page-ed25c7b30423) |
| 新增 User flow | 查閱此次補充的使用者流程 | [開啟新增 User flow](https://claude.ai/artifact/KB6pHmz23RY1EmUNYCtfk4#page-227cd962ddd2) |

## 與目前實作文件的關係

- [A flow 規格](A_FLOW.md)：已確認的 1018 P1–P9 展示範圍與資料界線。
- [B flow 規格](B_FLOW.md)：使用者已確認的 P10–P16 本機展示、投票、認養與 A flow 接合規則；前端本機展示已加入，驗證見 [B flow 驗證紀錄](B_FLOW_VALIDATION.md)。
- [B flow 討論與決策紀錄](B_FLOW_OPEN_QUESTIONS.md)：PRD／Web／User flow 差異、程式查核及16項已確認決策。
- [D flow 規格](D_FLOW.md)：2026-10-19四輪確認的P17–P22本機工作台、查證／事件／工單、清空回傳、排名及A／B整合；前端本機展示已實作，驗證見 [D flow 驗證紀錄](D_FLOW_VALIDATION.md)。
- [D flow 整合盤點與討論](D_FLOW_OPEN_QUESTIONS.md)：原文與程式查核、四輪答覆及IoT／獎勵規則的收斂紀錄。
- [專案背景與架構](PROJECT_CONTEXT.md)：目前系統能力、領域規則、資料限制與 API 契約。
- [A flow 驗證紀錄](A_FLOW_VALIDATION.md)：既有展示流程的驗證結果。
- [A flow 1018 更新差異](A_FLOW_1018_GAP_ANALYSIS.md)：實作前缺漏、點數規則差異及三項已確認決策的歷史盤點。

收錄 PM 文件不代表其中所有功能均已確認納入本次開發或已完成。若新文件與既有實作規格有差異，需先確認採用範圍，再同步更新對應規格與驗收條件；既有清潔箱、場所代表點與候選點的資料語意仍須維持。

## 讓所有讀者都能查閱

儲存庫內的入口不會變更 Claude 文件的分享權限。文件擁有者需確認上述連結已公開分享，並以未登入的無痕視窗逐一檢查四個連結是否能開啟正確頁面。

若希望不依賴 Claude 帳號、外部連結或後續內容變動，建議將確認版 PRD 與流程匯出後納入 `docs/`，保留版本日期與原始來源，並更新本頁連結。若讀者沒有儲存庫存取權，仍需另提供公開文件入口。
