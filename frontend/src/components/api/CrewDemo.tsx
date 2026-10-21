import { useEffect, useState } from "react";
import {
  CREW_STORE,
  CREW_UPDATED,
  crewSignedIn,
  setCrewSignedIn,
  readCrewTasks,
  updateCrewTask,
  crewPhoto,
  crewModes,
  type CrewTask,
  type CrewStatus,
  type CrewMode,
} from "../../data/crewDemo";
import { isPhoneBrowser } from "../../data/phone";

const statusNames: Record<CrewStatus, string> = {
  pending: "待處理",
  processing: "處理中",
  done: "已完成",
};
function useCrewDemo() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((v) => v + 1);
    const storage = (event: StorageEvent) => {
      if (event.key === CREW_STORE || event.key === null) update();
    };
    window.addEventListener(CREW_UPDATED, update);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(CREW_UPDATED, update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return { signedIn: crewSignedIn(), tasks: readCrewTasks() };
}
export function CrewDemo({ section, id }: { section?: string; id?: string }) {
  const { signedIn, tasks } = useCrewDemo();
  const [error, setError] = useState("");
  if (!signedIn)
    return (
      <main className="page api-narrow login-page">
        <h1>清潔員管理入口</h1>
        <section className="card api-form">
          <h2>大安區清潔隊 · 清潔員端</h2>
          <p>
            以「模擬清潔員阿順」體驗今日派工、現場處理與建議路線，不需要帳號或密碼。
          </p>
          <p>全部是假資料與模擬照片，不會派出真實工單、啟動相機或寫入後端。</p>
          <button
            className="button primary"
            onClick={() => {
              try {
                setCrewSignedIn(true);
                setError("");
              } catch {
                setError("無法儲存模擬登入，請允許此頁使用瀏覽器儲存空間。");
              }
            }}
          >
            以模擬清潔員登入
          </button>
          {error && <p role="alert">{error}</p>}
        </section>
      </main>
    );
  return (
    <div className="crew-shell">
      <div className="crew-demo-notice">
        <span>模擬清潔員阿順 · 所有派工、照片、路線均為本機展示</span>
        <button onClick={() => setCrewSignedIn(false)}>登出清潔員</button>
      </div>
      {section === "task" && id ? (
        <CrewTaskPage key={id} task={tasks.find((task) => task.id === id)} />
      ) : section === "route" ? (
        <CrewRoute tasks={tasks} />
      ) : (
        <CrewList tasks={tasks} />
      )}
    </div>
  );
}
function CrewList({ tasks }: { tasks: CrewTask[] }) {
  const [filter, setFilter] = useState<CrewStatus>("pending");
  const routeTasks = tasks.filter(
    (task) => task.status === "pending" && !task.offline,
  );
  return (
    <main className="crew-demo crew-list">
      <header className="crew-list-header">
        <div className="crew-between">
          <div>
            <p>大安區清潔隊 · 清潔員端</p>
            <h1>今日派工</h1>
          </div>
          <span className="crew-kudos">本月 128 讚 · 示意</span>
        </div>
        <div className="crew-tabs" aria-label="派工狀態">
          {(Object.keys(statusNames) as CrewStatus[]).map((status) => (
            <button
              key={status}
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {statusNames[status]}{" "}
              {tasks.filter((task) => task.status === status).length}
            </button>
          ))}
        </div>
      </header>
      <div className="crew-task-list">
        {tasks
          .filter((task) => task.status === filter)
          .map((task) => (
            <a
              key={task.id}
              className={`crew-task-card ${task.urgent && task.status !== "done" ? "crew-urgent" : ""} ${task.offline ? "crew-offline" : ""}`}
              href={`#crew/task/${task.id}`}
            >
              <div className="crew-between">
                <span
                  className={`crew-issue ${task.urgent && task.status !== "done" ? "crew-issue-urgent" : ""}`}
                >
                  {task.status === "done" ? "已完成清運" : task.issue}
                </span>
                <span>
                  {task.minutes >= 60 ? "1 小時前" : `${task.minutes} 分鐘前`}
                </span>
              </div>
              <h2>{task.name}</h2>
              <p>
                {task.status === "done" ? "已完成 · 本機模擬紀錄" : task.detail}
              </p>
            </a>
          ))}
        {!tasks.some((task) => task.status === filter) && (
          <p>目前沒有{statusNames[filter]}的派工。</p>
        )}
      </div>
      <div className="crew-bottom">
        <a className="button primary" href="#crew/route">
          看今日建議路線（{routeTasks.length} 個桶 · 模擬）
        </a>
      </div>
    </main>
  );
}
function CrewTaskPage({ task }: { task?: CrewTask }) {
  const [error, setError] = useState("");
  if (!task)
    return (
      <main className="crew-demo">
        <h1>找不到此模擬派工</h1>
        <a href="#crew">返回今日派工</a>
      </main>
    );
  const phone = isPhoneBrowser();
  const apply = (change: Parameters<typeof updateCrewTask>[1]) => {
    try {
      updateCrewTask(task.id, change);
      setError("");
    } catch (error) {
      setError((error as Error).message);
    }
  };
  const processing = task.status === "processing";
  const ready =
    phone &&
    processing &&
    !!task.truth &&
    !!task.composition &&
    !!task.completionPhoto;
  return (
    <main className="crew-demo crew-detail">
      <header className="crew-page-header">
        <a href="#crew" className="crew-back" aria-label="返回今日派工">
          ←
        </a>
        <div>
          <h1>{task.name}</h1>
          <p className="crew-attention">
            {task.status === "done" ? "已完成 · 模擬清運結案" : task.issue}
          </p>
        </div>
      </header>
      <ol className="crew-progress" aria-label="派工進度">
        <li data-current={task.status === "pending"}>已派單</li>
        <li data-current={processing}>處理中</li>
        <li data-current={task.status === "done"}>完成</li>
      </ol>
      <section className="crew-task-card">
        <img
          className="crew-evidence"
          src={crewPhoto("report")}
          alt="民眾回報的模擬現場照片"
        />
        <p>
          {task.source === "citizen"
            ? "民眾回報 · 距桶 32 公尺 · 同事件另有 2 筆"
            : "感測器自動派工 · 附圖為模擬現場照片"}
        </p>
      </section>
      <a className="crew-task-card crew-between" href="#crew/route">
        <div>
          <h2>桶位：{task.name}</h2>
          <p>{task.distance} 公尺 · 今日建議路線</p>
        </div>
        <strong>看路線 →</strong>
      </a>
      {error && <p role="alert">{error}</p>}
      {task.status === "done" ? (
        <section className="crew-task-card" role="status">
          <h2>已完成清運</h2>
          <p>本機模擬結案，不會影響真實桶況或派工。</p>
          {task.completionPhoto && (
            <img
              className="crew-evidence"
              src={task.completionPhoto}
              alt="已保存的模擬完成照"
            />
          )}
          {task.interiorPhoto && (
            <img
              className="crew-evidence"
              src={task.interiorPhoto}
              alt="已保存的模擬桶內照"
            />
          )}
        </section>
      ) : !phone ? (
        <section className="crew-task-card" aria-label="桌面派工處理限制">
          <h2>請使用手機現場處理</h2>
          <p>
            桌面可查看派工與路線；到場確認、拍照及完成清運僅限手機瀏覽器。縮小桌面視窗也無法操作。
          </p>
          <p>手機只生成模擬照片，不會啟動相機或接受相簿上傳。</p>
        </section>
      ) : (
        <>
          {!processing && (
            <button
              className="button primary"
              onClick={() => apply({ status: "processing" })}
            >
              確認到場，開始處理（模擬）
            </button>
          )}
          <fieldset className="crew-work-fields" disabled={!processing}>
            <legend>現場處理</legend>
            <h2>回報是否屬實？</h2>
            <div className="crew-choice" role="group" aria-label="回報是否屬實">
              {(["yes", "no"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={task.truth === value}
                  onClick={() => apply({ truth: value })}
                >
                  {value === "yes" ? "屬實" : "不實"}
                </button>
              ))}
            </div>
            <fieldset className="crew-composition">
              <legend>桶裡主要是什麼？（必選）</legend>
              <div className="crew-choice" role="group" aria-label="垃圾組成">
                {(["street", "household", "mixed"] as const).map(
                  (value, index) => (
                    <button
                      key={value}
                      aria-pressed={task.composition === value}
                      onClick={() => apply({ composition: value })}
                    >
                      {["行人垃圾", "家戶垃圾", "混合"][index]}
                    </button>
                  ),
                )}
              </div>
              <p>家戶垃圾會標記為本機稽查示意；桶內照可選填。</p>
            </fieldset>
            <div className="crew-choice">
              <button
                onClick={() =>
                  apply({ completionPhoto: crewPhoto("completion") })
                }
              >
                拍完成照（模擬）
              </button>
              <button
                onClick={() => apply({ interiorPhoto: crewPhoto("interior") })}
              >
                加拍桶內照（模擬・選填）
              </button>
            </div>
            <p className="crew-demo-caption">
              只產生 DEMO 假照片，不使用真實相機或相簿。
            </p>
            <div className="crew-photo-grid">
              {task.completionPhoto && (
                <figure>
                  <img src={task.completionPhoto} alt="待確認的模擬完成照" />
                  <figcaption>模擬完成照已就緒</figcaption>
                </figure>
              )}
              {task.interiorPhoto && (
                <figure>
                  <img src={task.interiorPhoto} alt="待確認的模擬桶內照" />
                  <figcaption>模擬桶內照已就緒</figcaption>
                </figure>
              )}
            </div>
          </fieldset>
          <div className="crew-bottom">
            <button
              className="button primary"
              disabled={!ready}
              onClick={() => apply({ status: "done" })}
            >
              完成清運
            </button>
            <p>需確認到場、是否屬實、垃圾組成及模擬完成照，才能結案。</p>
          </div>
        </>
      )}
    </main>
  );
}
function CrewRoute({ tasks }: { tasks: CrewTask[] }) {
  const [mode, setMode] = useState<CrewMode>("walk");
  const [started, setStarted] = useState(false);
  const stops = tasks.filter(
    (task) => task.status === "pending" && !task.offline,
  );
  const route = crewModes[mode];
  const points = [
    [145, 205],
    [145, 65],
    [255, 65],
    [255, 205],
  ];
  return (
    <main className="crew-demo crew-route">
      <header className="crew-page-header">
        <a className="crew-back" href="#crew" aria-label="返回今日派工">
          ←
        </a>
        <div>
          <h1>今日建議路線</h1>
          <p>
            {stops.length} 個桶 · {stops.length ? route.distance : "0"} 公里 ·
            約 {stops.length ? route.minutes : 0} 分鐘 · 示意
          </p>
        </div>
      </header>
      <div className="crew-mode-switch" role="group" aria-label="交通方式">
        {(Object.keys(crewModes) as CrewMode[]).map((value) => (
          <button
            key={value}
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              setStarted(false);
            }}
          >
            {crewModes[value].label}
          </button>
        ))}
      </div>
      <p className="crew-demo-caption">
        固定模擬路線，不使用 GPS
        或外部道路服務；待處理且讀值正常的桶列入順路清單。
      </p>
      <svg
        className="crew-route-map"
        viewBox="0 0 360 335"
        role="img"
        aria-label={`${route.label}模擬清運路線，${stops.length} 個停靠點`}
      >
        <rect width="360" height="335" fill="var(--map)" />
        <path
          d="M65 0V335 M145 0V335 M255 0V335 M300 0V335 M0 65H360 M0 205H360 M0 285H360"
          stroke="var(--map-road)"
          strokeWidth="10"
        />
        {stops.length > 0 && (
          <>
            <polyline
              className="crew-route-line"
              points={route.points}
              fill="none"
              stroke="var(--teal-on-mint)"
              strokeWidth="5"
              strokeDasharray="2 9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="95"
              cy="285"
              r="10"
              fill="var(--text-on-light)"
              stroke="var(--map-road)"
              strokeWidth="3"
            />
            {stops.map((task, index) => (
              <g key={task.id}>
                <circle
                  cx={points[index][0]}
                  cy={points[index][1]}
                  r="12"
                  fill="var(--teal-on-mint)"
                  stroke="var(--map-road)"
                  strokeWidth="3"
                />
                <text
                  x={points[index][0]}
                  y={points[index][1] + 4}
                  fill="var(--map-road)"
                  textAnchor="middle"
                  fontSize="12"
                >
                  {index + 1}
                </text>
              </g>
            ))}
          </>
        )}
      </svg>
      <ol className="crew-route-stops">
        {stops.map((task, index) => (
          <li key={task.id}>
            <span className="crew-stop-number">{index + 1}</span>
            <a href={`#crew/task/${task.id}`}>{task.name}</a>
            <strong>
              {task.id === "A-012"
                ? "堆放"
                : task.id === "C-004"
                  ? "稽查"
                  : task.issue}
            </strong>
          </li>
        ))}
      </ol>
      {started && (
        <section className="crew-task-card" role="status">
          <h2>{route.label}模擬導航已開始</h2>
          <p>第 1 站：{stops[0]?.name}。請在手機確認到場後處理。</p>
          <a className="button primary" href={`#crew/task/${stops[0]?.id}`}>
            前往第一張派工單
          </a>
        </section>
      )}
      {!stops.length && <p role="status">今日沒有待處理的建議停靠點。</p>}
      <div className="crew-bottom">
        <button
          className="button primary"
          disabled={!stops.length || started}
          onClick={() => setStarted(true)}
        >
          開始導航（模擬）
        </button>
      </div>
    </main>
  );
}
