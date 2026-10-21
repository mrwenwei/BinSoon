import { useEffect, useMemo, useState } from "react";
import {
  CREW_STORE,
  CREW_UPDATED,
  crewSignedIn,
  setCrewSignedIn,
  readCrewTasks,
  updateCrewTask,
  crewPhoto,
  crewRanking,
  crewTaskLocation,
  type CrewTask,
  type CrewStatus,
} from "../../data/crewDemo";
import { DEMO_STORE_KEY, DEMO_UPDATED } from "../../data/demoMode";
import { taipeiMonth } from "../../data/calendar";
import { districts } from "../../data/locations";
import { type CrewVehicle } from "../../data/crewRouting";
import { CrewRoutePlanner } from "../CrewRoutePlanner";
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
      if (
        event.key === CREW_STORE ||
        event.key === DEMO_STORE_KEY ||
        event.key === null
      )
        update();
    };
    window.addEventListener(CREW_UPDATED, update);
    window.addEventListener(DEMO_UPDATED, update);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(CREW_UPDATED, update);
      window.removeEventListener(DEMO_UPDATED, update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return { signedIn: crewSignedIn(), tasks: readCrewTasks() };
}
export function CrewDemo({ section, id }: { section?: string; id?: string }) {
  const { signedIn, tasks } = useCrewDemo();
  const [error, setError] = useState("");
  if (!signedIn || section === "login")
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
                window.location.hash = "crew";
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
        <CrewTaskPage
          key={id}
          task={tasks.find((task) => task.id === id)}
          nextTask={tasks.find(
            (task) => task.id !== id && task.status !== "done" && !task.offline,
          )}
        />
      ) : section === "ranking" ? (
        <CrewRanking />
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
          <a className="crew-kudos" href="#crew/ranking">
            本月{" "}
            {crewRanking("大安區", taipeiMonth()).find((row) => row.current)
              ?.likes || 0}{" "}
            讚 · 示意
          </a>
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
        {[
          {
            title: "即刻處理",
            match: (task: CrewTask) => task.urgent && !task.offline,
          },
          {
            title: "一般派工",
            match: (task: CrewTask) => !task.urgent && !task.offline,
          },
          {
            title: "讀值異常 · 不列入評分",
            match: (task: CrewTask) => task.offline,
          },
        ].map((group) => {
          const rows = tasks.filter(
            (task) => task.status === filter && group.match(task),
          );
          return (
            rows.length > 0 && (
              <section className="crew-dispatch-group" key={group.title}>
                <h2>{group.title}</h2>
                {rows.map((task) => (
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
                        {task.minutes >= 60
                          ? "1 小時前"
                          : `${task.minutes} 分鐘前`}
                      </span>
                    </div>
                    <h2>{task.name}</h2>
                    <p>
                      {task.status === "done"
                        ? "已完成 · 本機模擬紀錄"
                        : task.detail}
                    </p>
                  </a>
                ))}
              </section>
            )
          );
        })}
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
function CrewTaskPage({
  task,
  nextTask,
}: {
  task?: CrewTask;
  nextTask?: CrewTask;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!task)
    return (
      <main className="crew-demo">
        <h1>找不到此模擬派工</h1>
        <a href="#crew">返回今日派工</a>
      </main>
    );
  const phone = isPhoneBrowser();
  const apply = async (change: Parameters<typeof updateCrewTask>[1]) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await updateCrewTask(task.id, change);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
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
          src={task.reportPhoto || crewPhoto("report")}
          alt="民眾回報的模擬現場照片"
        />
        <p>
          {task.source === "citizen"
            ? `民眾回報 · 同事件 ${task.reportCount || 1} 筆 · 本機模擬照片`
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
          <h2>結案完成</h2>
          <p>
            已完成清運 · {task.truth === "yes" ? "查證屬實" : "查證不實"}
            {task.eventId ? "，市民回報紀錄已同步更新" : " · 本機展示紀錄"}
          </p>
          <p>
            本機模擬結案，不會影響真實桶況或派工；讀值異常及不實案件不列入排名。
          </p>
          {nextTask ? (
            <a className="button primary" href={`#crew/task/${nextTask.id}`}>
              下一張工單：{nextTask.name}
            </a>
          ) : (
            <a className="button primary" href="#crew">
              返回今日工單
            </a>
          )}
          <a className="back-link" href="#crew/route">
            查看清運進度
          </a>
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
          <fieldset className="crew-work-fields" disabled={!processing || busy}>
            <legend>現場處理</legend>
            <h2>回報是否屬實？</h2>
            <div className="crew-choice" role="group" aria-label="回報是否屬實">
              {(["yes", "no"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={task.truth === value}
                  disabled={busy || !!task.truth}
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
              disabled={!ready || busy}
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
const crewTaskHref = (id: string) => `#crew/task/${id}`;
function CrewRoute({ tasks }: { tasks: CrewTask[] }) {
  const [vehicle, setVehicle] = useState<CrewVehicle>("scooter");
  const plan = useMemo(() => {
    const groups = new Map<
      string,
      { location: ReturnType<typeof crewTaskLocation>; tasks: CrewTask[] }
    >();
    for (const task of tasks.filter((t) => !t.offline)) {
      const location = crewTaskLocation(task);
      const group = groups.get(location.id);
      if (group) group.tasks.push(task);
      else groups.set(location.id, { location, tasks: [task] });
    }
    const all = [...groups.values()];
    const completed = all.filter((g) =>
      g.tasks.every((t) => t.status === "done"),
    );
    const pending = all.filter((g) => g.tasks.some((t) => t.status !== "done"));
    return { all, completed, pending };
  }, [tasks]);
  return (
    <main className="page api-route-page demo-crew-road">
      <a className="back-link" href="#crew">
        ← 返回今日工單
      </a>
      <p className="tiny">
        固定展示起點與模擬派工，沒有即時 GPS；沿用 Valhalla
        地圖道路規劃，未做順序最佳化。
      </p>
      <CrewRoutePlanner
        title="今日清運路線"
        vehicle={vehicle}
        onVehicleChange={setVehicle}
        origin={[25.033, 121.5358]}
        bins={plan.pending.map((g) => g.location)}
        tasks={plan.pending.flatMap((g) =>
          g.tasks
            .filter((t) => t.status !== "done")
            .map((t) => ({
              id: t.id,
              locationId: g.location.id,
              label: t.issue,
            })),
        )}
        taskHref={crewTaskHref}
        backHref="#crew"
        stopNotes={Object.fromEntries(
          plan.pending.map((g) => [
            g.location.id,
            g.tasks.map((t) => t.detail).join("；"),
          ]),
        )}
        afterMap={
          <section
            className="crew-route-progress-section"
            aria-label="清運進度"
          >
            <h2>今日清運進度</h2>
            <p>
              已完成 {plan.completed.length} / {plan.all.length} 個桶 · 剩{" "}
              {plan.pending.length} 個桶
            </p>
            <progress
              aria-label="已完成清運桶數"
              value={plan.completed.length}
              max={Math.max(1, plan.all.length)}
            />
            <p className="tiny">
              同點多張工單全數完成才計為完成一個桶；讀值異常不列入此路線。
            </p>
            <h3>已完成的桶</h3>
            <ul className="crew-completed-bins">
              {plan.completed.map((g) => (
                <li key={g.location.id}>
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>{g.location.label}</strong>
                    <small>已完成 · 本機展示</small>
                  </div>
                  <a href={crewTaskHref(g.tasks[0].id)}>查看結案</a>
                </li>
              ))}
            </ul>
            {!plan.completed.length && <p>還沒有已完成的桶。</p>}
          </section>
        }
      />
    </main>
  );
}
function CrewRanking() {
  const [district, setDistrict] = useState("大安區");
  const [month, setMonth] = useState(taipeiMonth);
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const ranking = valid
    ? crewRanking(district, month).filter((row) => row.completed || row.likes)
    : [];
  return (
    <main className="crew-demo crew-ranking">
      <header className="crew-page-header">
        <div>
          <h1>清潔隊榮譽榜</h1>
          <p>依已完成且查證屬實件數排名，讚數另外列出。</p>
        </div>
      </header>
      <div className="card api-form">
        <label>
          月份
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label>
          行政區
          <select
            aria-label="行政區"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {districts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      {!valid && <p role="status">請選擇有效月份。</p>}
      <ol className="crew-ranking-list" aria-label="清潔員榮譽榜">
        {ranking.map((row) => (
          <li
            className={`card ${row.current ? "current" : ""}`}
            key={row.staffId}
          >
            <strong className="numeral-md">{row.rank}</strong>
            <div>
              <h2>
                {row.name}
                {row.current ? "（你）" : ""}
              </h2>
              {row.rank <= 3 && (
                <span className="status-pill">專案加給 · 示意</span>
              )}
              <p>市民給的讚 {row.likes}</p>
            </div>
            <strong className="numeral-md">
              {row.completed}
              <small> 件</small>
            </strong>
          </li>
        ))}
      </ol>
      {valid && !ranking.length && <p>此行政區與月份尚無展示成果。</p>}
      <aside className="member-how">
        <p>
          本機展示：每月前三名標示專案加給，不發放款項。U3
          對處理清潔員的讚會同步顯示；每次完成限讚一次，按讚不改變件數排名。不實與讀值異常案件不列入計件。
        </p>
      </aside>
    </main>
  );
}
