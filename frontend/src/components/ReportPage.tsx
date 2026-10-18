import { useEffect, useState } from "react";
import { useQrCode } from "./useQrCode";
import type { LocationRecord } from "../data/locations";
import {
  reportAward,
  reportIsFinal,
  reportTypes,
  type DemoReport,
  type ReportDraft,
} from "../data/reports";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";
import { binDemo } from "../data/binDemo";
import { ReportHistory } from "./ReportHistory";
function useMobileLayout() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const change = () => setMobile(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return mobile;
}
export function ReportPage({
  location,
  demoOnDesktop,
  loggedIn,
  draft,
  onChange,
  onSubmit,
  reports,
  loginHref,
  suspended,
  quick = false,
  removed = false,
}: {
  location: LocationRecord;
  demoOnDesktop: boolean;
  loggedIn: boolean;
  draft: ReportDraft;
  onChange: (value: ReportDraft) => void;
  onSubmit: () => void;
  reports: DemoReport[];
  loginHref: string;
  suspended: boolean;
  quick?: boolean;
  removed?: boolean;
}) {
  const mobile = useMobileLayout();
  const reportUrl = `${window.location.origin}${window.location.pathname}#report/${location.id}`;
  const qr = useQrCode(reportUrl, 232);
  const info = reportTypes.find((item) => item.id === draft.type);
  const duplicate = reports.find(
    (report) =>
      report.locationId === location.id &&
      report.type === draft.type &&
      !reportIsFinal(report),
  );
  const ready = Boolean(
    loggedIn &&
    !suspended &&
    info &&
    draft.photo &&
    draft.proximity === "near" &&
    (draft.type !== "other" || draft.description.trim()) &&
    !duplicate,
  );
  const set = (patch: Partial<ReportDraft>) => onChange({ ...draft, ...patch });
  if (removed || binDemo(location).removed)
    return (
      <main className="page">
        <h1>這個桶已撤除（示意）</h1>
        <p>請改用其他可用桶。</p>
        <a className="button primary" href={`#nav/${location.id}`}>
          尋找其他可用桶
        </a>
      </main>
    );
  if (quick && !draft.adopter)
    return (
      <main className="page">
        <h1>快捷通報需要有效認養資格</h1>
        <p>申請待審或已結束時，仍可使用一般回報。</p>
        <a className="button primary" href={`#report/${location.id}?demo=1`}>
          改用一般回報
        </a>
        <a className="back-link" href="#adopt">
          查看認養狀態
        </a>
      </main>
    );
  if (!mobile && !demoOnDesktop)
    return (
      <main className="page">
        <a className="back-link" href={`#bin/${location.id}`}>
          <Icon name="back" />
          返回桶詳情
        </a>
        <div className="page-heading">
          <div>
            <span className="eyebrow">A LITTLE CARE GOES A LONG WAY</span>
            <h1>回報要在現場，用手機拍</h1>
            <p>{location.label}</p>
          </div>
          <span className="demo-tag">目前為展示模式</span>
        </div>
        <div className="qr-grid">
          <section className="card qr-card">
            {qr ? (
              <img src={qr} width="232" height="232" alt="手機回報 QR Code" />
            ) : (
              <p>QR Code 產生中，亦可開啟下方連結。</p>
            )}
            <h2>用手機掃碼，接著完成回報</h2>
            <p>
              正式流程需現場拍照，並在桶 50 公尺內。
              <br />
              本次使用示意照片與定位，可在手機試走流程。
            </p>
            <a className="tiny qr-link" href={reportUrl}>
              {reportUrl}
            </a>
            {/^(localhost|127\.)/.test(window.location.hostname) && (
              <p className="local-notice">
                這是本機網址；手機掃碼須先部署至可連線的網址。
              </p>
            )}
            <a
              className="button secondary"
              href={`#report/${location.id}?demo=1`}
            >
              在電腦體驗示範回報
              <Icon name="arrow" />
            </a>
          </section>
          <section className="qr-explanation">
            <h2>一個小回報，讓城市順一點。</h2>
            <ol className="steps">
              <li>
                <span>01</span>
                <div>
                  <strong>選擇問題類型</strong>
                  <p>桶滿了、很髒，或桶旁出現堆放。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>現場拍照與確認位置</strong>
                  <p>本次可直接使用內建展示情境。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>送出並查看案件進度</strong>
                  <p>點數待確認後入帳；展示不會真的派工。</p>
                </div>
              </li>
            </ol>
            <div className="card">
              <h3>可以回報什麼？</h3>
              {reportTypes.map((item) => (
                <div className="point-row" key={item.id}>
                  <span>{item.label}</span>
                  <strong>
                    {item.points ? `+${item.points} 點` : "文字說明"}
                  </strong>
                </div>
              ))}
            </div>
            <a className="back-link" href="#member">
              查看我的回報紀錄
              <Icon name="arrow" />
            </a>
          </section>
        </div>
        <ReportHistory reports={reports} />
      </main>
    );
  return (
    <main className="page report-page">
      <a className="back-link" href={`#bin/${location.id}`}>
        <Icon name="back" />
        返回桶詳情
      </a>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THANK YOU FOR LOOKING OUT</span>
          <h1>{quick ? "快捷通報：先完成現場驗證" : "回報這個桶"}</h1>
          <p>{location.label}</p>
        </div>
        <span className="demo-tag">示範回報 · 不會真的派工</span>
      </div>
      {suspended && (
        <p className="account-warning suspended" role="alert">
          不實回報已累積三次，本機示範帳號已暫停回報資格。
        </p>
      )}
      <form
        className="report-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onSubmit();
        }}
      >
        <div className="report-stack">
          <section className="card">
            <h2>
              <span className="step-number">01</span>發生什麼事？
            </h2>
            <div className="report-types" role="group" aria-label="問題類型">
              {reportTypes.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={draft.type === item.id}
                  onClick={() => set({ type: item.id })}
                >
                  <span className="type-symbol" aria-hidden="true">
                    {item.icon}
                  </span>
                  <strong>{item.label}</strong>
                  <small>
                    {item.points ? `+${item.points} 點` : "文字說明"}
                  </small>
                  <span className="type-hint">{item.hint}</span>
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="description">
              補充說明{draft.type === "other" ? "（必填）" : "（選填）"}
            </label>
            <textarea
              id="description"
              rows={3}
              maxLength={500}
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
              placeholder="描述一下你看到的情況…"
            />
            <span className="tiny">{draft.description.length} / 500</span>
          </section>
          <section className="card">
            <h2>
              <span className="step-number">02</span>現場拍照
            </h2>
            <div
              className={`photo-preview ${draft.photo ? "captured" : ""}`}
              role="img"
              aria-label={draft.photo ? "已拍攝的示意照片" : "尚未拍攝示意照片"}
            >
              {draft.photo ? (
                <>
                  <div className="photo-scene">
                    <Mascot />
                    <span className="demo-bag">▧</span>
                  </div>
                  <span>內建示意圖 · 非真實現場照片</span>
                </>
              ) : (
                <>
                  <Icon name="camera" />
                  <span>用一張照片，幫清潔隊看見狀況</span>
                </>
              )}
            </div>
            <button
              className="button secondary wide"
              type="button"
              onClick={() => set({ photo: true })}
            >
              <Icon name="camera" />
              {draft.photo ? "重拍示意照片" : "拍一張示意照片"}
            </button>
            <p className="tiny">
              展示模式不啟用相機，也不讀取相簿。正式版需頁面內相機現場拍攝。
            </p>
          </section>
        </div>
        <aside className="report-stack">
          <section className="card">
            <h2>
              <span className="step-number">03</span>確認位置與帳號
            </h2>
            <label className="field-label" htmlFor="proximity">
              示意定位情境
            </label>
            <select
              id="proximity"
              value={draft.proximity}
              onChange={(event) =>
                set({
                  proximity: event.target.value as ReportDraft["proximity"],
                })
              }
            >
              <option value="unchecked">選擇一個展示情境</option>
              <option value="near">在桶旁 · 32 公尺</option>
              <option value="far">距離太遠 · 78 公尺</option>
              <option value="denied">無法取得定位</option>
            </select>
            <p
              className={`location-check ${draft.proximity === "near" ? "valid" : ""}`}
              role="status"
            >
              <Icon name="pin" />
              {draft.proximity === "near"
                ? "示意距離 32 公尺，符合 50 公尺限制。"
                : draft.proximity === "far"
                  ? "示意距離 78 公尺，超過 50 公尺限制。"
                  : draft.proximity === "denied"
                    ? "無法取得定位，請選擇其他示意情境。"
                    : "請確認示意距離在 50 公尺內。"}
            </p>
            <div className="login-check">
              <Icon name="user" />
              {loggedIn ? (
                "已使用示範帳號登入"
              ) : (
                <a href={loginHref}>登入後繼續回報</a>
              )}
            </div>
            <p className="tiny">所有定位均為示意，不會讀取你的真實位置。</p>
            <div className="scenario-fields">
              <p className="field-label">回報身分（依核准認養）</p>
              <p>
                {draft.adopter
                  ? "這個桶的核准認養者 · 屬實首報 +2 點"
                  : "一般民眾 · 屬實首報 +1 點"}
              </p>
              <a href={`#adopt/${location.id}`}>查看認養申請與資格</a>
              <label className="field-label" htmlFor="reporter-order">
                示範回報順序
              </label>
              <select
                id="reporter-order"
                value={draft.firstReporter ? "first" : "later"}
                onChange={(event) =>
                  set({ firstReporter: event.target.value === "first" })
                }
              >
                <option value="first">同事件第一位回報者</option>
                <option value="later">同事件後續回報者 · 不重複獎勵</option>
              </select>
              <p className="tiny">
                回報順序為展示情境；認養資格由本機核准紀錄決定。
              </p>
            </div>
          </section>
          <section className="card report-summary">
            <span className="eyebrow">YOUR LITTLE ACT MATTERS</span>
            <h2>{info?.label || "先選擇問題類型"}</h2>
            <div className="points-preview">
              +{info ? reportAward(draft) : 0}
              <span>待確認點數</span>
            </div>
            <p>
              清潔員確認屬實後才入帳。
              <br />
              本次為展示，可在審核結果頁操作示意審核。
            </p>
            {duplicate && (
              <p className="form-error" role="status">
                這個問題已有示範回報，請勿重複送出。
                <a href={`#review/${duplicate.id}`}>查看回報</a>
              </p>
            )}
            <button
              className="button primary wide"
              type="submit"
              disabled={!ready}
            >
              送出示範回報
              <Icon name="arrow" />
            </button>
            <p className="tiny">需完成類型、照片、50m 內示意定位與登入。</p>
          </section>
        </aside>
      </form>
      <ReportHistory reports={reports} />
    </main>
  );
}
