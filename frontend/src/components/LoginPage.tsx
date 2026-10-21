import { useState } from "react";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";
export function LoginPage({
  loggedIn,
  onLogin,
  onLogout,
}: {
  loggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [requestedPhone, setRequestedPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="page login-page">
      <a className="back-link" href="#map">
        <Icon name="back" />
        返回地圖
      </a>
      <div className="login-grid">
        <section className="login-story">
          <span className="eyebrow">A SMALL ACT. A BETTER CITY.</span>
          <div className="login-mascot">
            <Mascot />
            <span>嗨，很高興認識你！</span>
          </div>
          <h1>
            先讓Bin友
            <br />
            認識你<span className="dot">。</span>
          </h1>
          <p>
            一起讓台北的日常，再順一點。
            <br />
            登入後，就能回報、集點，累積你的城市小善意。
          </p>
          <div className="privacy-notes">
            <h2>這個展示會用到哪些資料？</h2>
            <p>
              <Icon name="user" />
              手機號碼僅當次表單驗證，不儲存、不傳送。
            </p>
            <p>
              <Icon name="pin" />
              使用示意距離，不讀取真實定位。
            </p>
            <p>
              <Icon name="camera" />
              使用內建示意圖，不啟用相機。
            </p>
          </div>
        </section>
        <section className="card login-card">
          <span className="demo-tag">示範帳號 · 不連接真實服務</span>
          <h2>{loggedIn ? "你好，示範市民！" : "登入或綁定"}</h2>
          {loggedIn ? (
            <>
              <p className="muted">
                你的回報、會員點數和兌換紀錄保留在這個瀏覽器。
              </p>
              <button className="button primary wide" onClick={onLogin}>
                繼續體驗
              </button>
              <button className="text-button" onClick={onLogout}>
                登出示範帳號
              </button>
            </>
          ) : (
            <>
              <button className="button primary wide" onClick={onLogin}>
                <Icon name="user" />
                用台北通登入（示範）
              </button>
              <div className="divider">或用手機號碼</div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!requestedPhone || requestedPhone !== phone) return;
                  if (code !== "123456") {
                    setError("示範驗證碼為 123456，請重新輸入。");
                    return;
                  }
                  onLogin();
                }}
              >
                <label className="field-label" htmlFor="phone">
                  手機號碼
                </label>
                <div className="phone-row">
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="0912345678"
                    maxLength={10}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setRequestedPhone("");
                      setCode("");
                      setError("");
                    }}
                  />
                  <button
                    type="button"
                    className="button small"
                    disabled={!/^09\d{8}$/.test(phone)}
                    onClick={() => {
                      setRequestedPhone(phone);
                      setError("");
                    }}
                  >
                    傳送示範驗證碼
                  </button>
                </div>
                {requestedPhone && (
                  <p className="code-hint" role="status">
                    沒有發送簡訊。請輸入示範驗證碼：123456
                  </p>
                )}
                <label className="field-label" htmlFor="otp">
                  簡訊驗證碼
                </label>
                <input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="6 位數字"
                  maxLength={6}
                  disabled={!requestedPhone}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError("");
                  }}
                />
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button primary wide"
                  type="submit"
                  disabled={!requestedPhone || !/^\d{6}$/.test(code)}
                >
                  驗證並綁定
                </button>
              </form>
              <p className="tiny login-footnote">
                僅供 A flow 介面展示。請使用虛構手機號碼，例如
                0912345678。沒有建立真實帳號。
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
