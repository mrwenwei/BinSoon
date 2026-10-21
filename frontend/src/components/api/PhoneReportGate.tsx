import type { ReactNode } from "react";

import { isPhoneBrowser } from "../../data/phone";
export { isPhoneBrowser } from "../../data/phone";

export function PhoneReportGate({ children }: { children: ReactNode }) {
  if (isPhoneBrowser()) return <>{children}</>;
  return (
    <main className="page api-narrow">
      <h1>請使用手機現場回報</h1>
      <section className="card" aria-label="桌面回報限制">
        <p>
          拍照回報僅限手機瀏覽器。請攜帶手機到桶位附近，分享位置並使用現場拍照流程。
        </p>
        <p>桌面網頁無法拍照或送出回報，也不接受相簿照片。</p>
        <p className="tiny">
          目前手機端提供模擬位置與拍照的展示流程，不會啟動真實相機。
        </p>
      </section>
      <a className="button primary" href="#map">
        回到地圖
      </a>
    </main>
  );
}
