import { useEffect, useMemo, useState } from "react";
import { useDemoStore, type DemoState } from "../../data/demoStore";
import {
  applyWorkAction,
  initializeTasks,
  orderedTasks,
  staffStats,
  taskClosed,
  taskPriority,
  taipeiMonth,
  workLabels,
  type WorkAction,
  type WorkOrder,
} from "../../data/workOrders";
import { locations } from "../../data/locations";
import { binDemo, demoDistance, distanceLabel } from "../../data/binDemo";
import {
  formatDemoTime,
  reportAward,
  reportInfo,
  reportIsFinal,
  type DemoReport,
} from "../../data/reports";
import { StaffRoutePage } from "./StaffRoutePage";
import type { CrewVehicle } from "../../data/crewRouting";
import { useParticipationStore } from "../../data/participation";
import { Mascot } from "../Mascot";
const priorityLabels = ["即刻處理", "優先", "一般", "稽查情境"];
const binFor = (task: WorkOrder) =>
  locations.find((p) => p.id === task.locationId)!;

function Verification({
  report,
  act,
}: {
  report: DemoReport;
  act: (action: WorkAction) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <article className="staff-evidence" aria-label={`回報證據：${report.id}`}>
      <span className="demo-tag">
        {report.reporter === "fixture" ? "其他市民 · 虛構紀錄" : "本機示範市民"}{" "}
        · {report.firstReporter ? "原首報" : "同事件後報"}
      </span>
      <div className="evidence-preview" role="img" aria-label="回報示意證據">
        ▧{" "}
        {report.photo
          ? "市民現場照片（示意）"
          : "舊版紀錄未保存照片，不補造證據"}
      </div>
      <p>{report.description || reportInfo(report.type).label}</p>
      <small>
        {formatDemoTime(report.createdAt)} · 送出時
        {report.adopter ? "有效認養" : "一般身份"}
      </small>
      {reportIsFinal(report) ? (
        <p className="staff-verdict">
          {report.status === "approved"
            ? `查證屬實 · ${report.reporter === "fixture" ? "虛構市民，不影響本機點數" : `+${reportAward(report)} 點已結算`}`
            : `判定不實 · ${report.rejectionReason || "舊版判定"}`}
        </p>
      ) : (
        <>
          <label className="field-label">
            不實原因（判不實時必填）
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </label>
          <div className="action-row">
            <button
              className="button secondary"
              onClick={() =>
                act({
                  type: "verify",
                  taskId: report.eventId!,
                  reportId: report.id,
                  verdict: "approved",
                  reason: "",
                })
              }
            >
              確認屬實
            </button>
            <button
              className="button secondary"
              disabled={!reason.trim()}
              onClick={() =>
                act({
                  type: "verify",
                  taskId: report.eventId!,
                  reportId: report.id,
                  verdict: "rejected",
                  reason,
                })
              }
            >
              確認不實
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function TaskDetail({
  task,
  state,
  act,
}: {
  task: WorkOrder;
  state: DemoState;
  act: (action: WorkAction) => void;
}) {
  const [reason, setReason] = useState("");
  const reports = state.reports.filter((r) => r.eventId === task.id);
  const allReviewed = reports.every(reportIsFinal);
  const closed = taskClosed(task);
  const reading = state.readings[task.locationId];
  const bin = binFor(task);
  const next = orderedTasks(state).find(
    (t) =>
      t.id !== task.id &&
      !taskClosed(t) &&
      t.status !== "repair" &&
      t.status !== "waiting_sensor",
  );
  return (
    <>
      <a className="back-link" href="#staff/tasks">
        ← 返回派工清單
      </a>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ONE TASK, EVERY DETAIL.</span>
          <h1>{bin.label}</h1>
          <p>
            {reportInfo(task.type).label} · {bin.district} ·{" "}
            {task.fixture ? "種子情境" : "市民回報"}
          </p>
        </div>
        <span
          className={`staff-status ${task.status}`}
          data-testid="task-status"
        >
          {workLabels[task.status]}
        </span>
      </div>
      <ol className="staff-progress" aria-label="工單進度">
        <li className="done">建單 {formatDemoTime(task.createdAt)}</li>
        <li className={task.acceptedAt ? "done" : ""}>
          接單 {task.acceptedAt ? formatDemoTime(task.acceptedAt) : "尚未接單"}
        </li>
        <li className={task.arrivedAt ? "done" : ""}>
          到場 {task.arrivedAt ? formatDemoTime(task.arrivedAt) : "尚未到場"}
        </li>
        <li className={closed ? "done" : ""}>
          {closed
            ? `結案 ${formatDemoTime(task.completedAt!)}`
            : "工作尚未結案"}
        </li>
      </ol>
      <div className="staff-detail-grid">
        <div>
          <section className="card">
            <h2>現場回報與查證</h2>
            <p>
              共 {reports.length}{" "}
              筆回報。逐筆確認，首報不實不遞補獎勵。查證不等於清運完成。
            </p>
            {task.status === "pending" && (
              <button
                className="button primary"
                onClick={() => act({ type: "accept", taskId: task.id })}
              >
                接單
              </button>
            )}
            {task.status === "processing" && (
              <button
                className="button primary"
                onClick={() => act({ type: "arrive", taskId: task.id })}
              >
                示範已到場
              </button>
            )}
            {!reports.length && (
              <p className="muted">
                感測器來源情境，沒有市民回報，不發市民點數；提交完成證據即確認現場問題。
              </p>
            )}
            {reports.map((report) => (
              <fieldset
                key={report.id}
                disabled={!task.arrivedAt || closed}
                className="verification-group"
              >
                <Verification report={report} act={act} />
              </fieldset>
            ))}
          </section>
          <section className="card">
            <h2>{closed ? "工作處理結果" : "工作完成證據"}</h2>
            <div
              className="evidence-preview"
              role="img"
              aria-label="完成照片示意"
            >
              ▧{" "}
              {task.photoAt
                ? `完成／現況示意照片 · ${formatDemoTime(task.photoAt)}`
                : "尚無完成照片；未啟用真實相機"}
            </div>
            {closed ? (
              <p>
                {task.status === "dismissed"
                  ? `現場無需處理：${task.reason}`
                  : "已完成對應工作，完成紀錄只計一次。"}
                {task.reason &&
                  task.status !== "dismissed" &&
                  ` · ${task.reason}`}
              </p>
            ) : (
              <>
                <p>
                  到場後請先完成所有回報查證。提交即確認現場工作已完成；滿桶另需本次有效清空回傳。
                </p>
                <button
                  className="button secondary"
                  disabled={!task.arrivedAt || Boolean(task.photoAt)}
                  onClick={() => act({ type: "photo", taskId: task.id })}
                >
                  {task.photoAt ? "已附示意照片" : "拍一張完成示意照片"}
                </button>
                <div className="action-row">
                  <button
                    className="button primary"
                    disabled={
                      !task.arrivedAt ||
                      !allReviewed ||
                      !task.photoAt ||
                      Boolean(task.submittedAt)
                    }
                    onClick={() => act({ type: "finish", taskId: task.id })}
                  >
                    提交完成證據
                  </button>
                </div>
                {task.status === "waiting_sensor" && (
                  <p className="staff-notice" role="status">
                    待感測確認：完成照已提交，尚未收到本次清空回傳。沒有讀值不代表0%。
                  </p>
                )}
                {task.status === "repair" && (
                  <p className="staff-notice">
                    待修繕：{task.reason}
                    。修復後由本示範隊員提交證據，未通知其他單位。
                  </p>
                )}
                <details>
                  <summary>現場例外：無需處理／待修繕</summary>
                  <label className="field-label">
                    現況說明或待修繕原因
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                    />
                  </label>
                  <div className="action-row">
                    <button
                      className="button secondary"
                      disabled={
                        !task.arrivedAt ||
                        !task.photoAt ||
                        !allReviewed ||
                        !reason.trim()
                      }
                      onClick={() =>
                        act({ type: "dismiss", taskId: task.id, reason })
                      }
                    >
                      確認無需處理
                    </button>
                    {task.type === "broken" && (
                      <button
                        className="button secondary"
                        disabled={
                          !task.arrivedAt ||
                          !reason.trim() ||
                          task.status === "repair"
                        }
                        onClick={() =>
                          act({ type: "repair", taskId: task.id, reason })
                        }
                      >
                        記錄待修繕
                      </button>
                    )}
                  </div>
                </details>
              </>
            )}
          </section>
        </div>
        <aside>
          <section className="card">
            <span className="eyebrow">BIN OBSERVATION</span>
            <h2>桶內感測回傳</h2>
            <strong className="staff-capacity">
              {reading?.capacity === null || reading?.capacity === undefined
                ? "未知"
                : `${reading.capacity}%`}
            </strong>
            <p className="tiny">
              {reading
                ? `示範量測 ${formatDemoTime(reading.observedAt)} · 接收 ${formatDemoTime(reading.receivedAt)}`
                : "沒有感測回傳；不可把未知當清空"}
            </p>
            <p>
              本次以展示操作代替聯網回傳。容量更新不會替堆放、髒污或損壞工單結案。
            </p>
            {!closed && (
              <button
                className="button secondary wide"
                disabled={!task.arrivedAt || Boolean(task.clearReadingId)}
                onClick={() =>
                  act({
                    type: "clear",
                    taskId: task.id,
                    readingId: crypto.randomUUID(),
                  })
                }
              >
                {task.clearReadingId
                  ? "本次清空回傳已收到"
                  : "示範收到清空回傳"}
              </button>
            )}
          </section>
          <section className="card">
            <h2>位置與下一站</h2>
            <p>{bin.address || bin.label}</p>
            <p>
              固定大安森林公園示意起點 · 直線 {distanceLabel(demoDistance(bin))}
            </p>
            <a href="#staff/route" className="button secondary wide">
              查看清運路線
            </a>
            <a href={`#bin/${bin.id}`} className="back-link">
              切回市民桶詳情
            </a>
            {closed && (
              <a
                className="button primary wide"
                href={next ? `#staff/tasks/${next.id}` : "#staff/tasks"}
              >
                {next ? "下一張待辦工單" : "已無下一站，返回清單"}
              </a>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export function HonorPage({
  state,
  citizen = false,
}: {
  state: DemoState;
  citizen?: boolean;
}) {
  const stats = staffStats(state);
  const now = new Date().toISOString();
  const rows = [
    { name: "大安區示範隊員", count: stats.count },
    { name: "示範隊員 B", count: 0 },
    { name: "示範隊員 C", count: 0 },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THANK YOU FOR SHOWING UP.</span>
          <h1>{citizen ? "清潔隊整體成果" : "清潔隊榮譽榜"}</h1>
          <p>{taipeiMonth(now)} · 大安區 · 示範資料</p>
        </div>
        <Mascot />
      </div>
      <div className="staff-metrics">
        <section className="card">
          <span>本月確認完成</span>
          <strong>{stats.count} 件</strong>
        </section>
        <section className="card">
          <span>本機完成紀錄感謝</span>
          <strong>{stats.likes} 讚</strong>
        </section>
        <section className="card">
          <span>平均接單至完成</span>
          <strong>
            {stats.average === null ? "無資料" : `${stats.average} 分`}
          </strong>
        </section>
      </div>
      {!citizen && (
        <section className="card">
          <h2>本月個人示意排名</h2>
          <p>依已完成且有現場問題的工單計件，同分並列；讚數不列排名。</p>
          <ol className="staff-ranking">
            {rows.map((row) => (
              <li key={row.name}>
                <span>
                  第 {1 + rows.filter((p) => p.count > row.count).length} 名
                </span>
                <strong>{row.name}</strong>
                <span>{row.count} 件</span>
                <small>前三名專案加給（示範）</small>
              </li>
            ))}
          </ol>
          <p className="tiny">
            示意歷史基數 {stats.baseline} 件，本次完成{" "}
            {stats.count - stats.baseline}{" "}
            件；不虛構歷史明細。月底名單僅展示，無金額或實際發放。
          </p>
        </section>
      )}
      <section className="card">
        <h2>每一次處理，都值得被看見</h2>
        <p>
          市民感謝不換點數、不折現，也不改變排名。歷史按桶讚{" "}
          {state.likes.length} 筆保留，未轉作新工單績效。
        </p>
      </section>
    </>
  );
}

export function StaffApp({ route }: { route: string }) {
  const { state, setState, storageError } = useDemoStore();
  const participation = useParticipationStore();
  const [tab, setTab] = useState("pending");
  const [vehicle, setVehicle] = useState<CrewVehicle>("scooter");
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);
  const [, section = "tasks", id] = route.split("/");
  const task = state.tasks.find((t) => t.id === id);
  const act = (action: WorkAction) =>
    setState((previous) => applyWorkAction(previous, action));
  const open = useMemo(
    () => orderedTasks(state).filter((t) => !taskClosed(t)),
    [state],
  );
  const routeTasks = useMemo(
    () =>
      open.filter(
        (t) =>
          !["repair", "waiting_sensor"].includes(t.status) &&
          !binDemo(binFor(t), participation.state.removedBinIds).removed,
      ),
    [open, participation.state.removedBinIds],
  );
  const routeBins = useMemo(
    () => [
      ...new Map(routeTasks.map((t) => [t.locationId, binFor(t)])).values(),
    ],
    [routeTasks],
  );
  const selectedTasks = orderedTasks(state).filter((t) =>
    tab === "done"
      ? taskClosed(t)
      : tab === "processing"
        ? !taskClosed(t) && t.status !== "pending"
        : t.status === "pending",
  );
  return (
    <div className="staff-shell">
      <header className="staff-header">
        <a href="#staff/tasks" className="staff-brand">
          <Mascot />
          <span>
            BinSoon <strong>清潔隊工作台</strong>
          </span>
        </a>
        <span>大安區 · {state.staffLoggedIn ? "示範隊員" : "身份選擇"}</span>
        <a href="#map">切換市民介面 ↗</a>
      </header>
      <nav className="staff-nav" aria-label="工作台選單">
        <a
          href="#staff/tasks"
          aria-current={section === "tasks" ? "page" : undefined}
        >
          派工清單
        </a>
        <a href="#staff/notifications">工單通知</a>
        <a href="#staff/route">清運路線</a>
        <a href="#staff/honor">榮譽榜</a>
        {state.staffLoggedIn && (
          <button
            onClick={() =>
              setState((prev) => ({ ...prev, staffLoggedIn: false }))
            }
          >
            退出示範隊員
          </button>
        )}
      </nav>
      <main className="staff-main" key={route}>
        <p className="staff-demo-note">
          D FLOW · 本機展示 · 照片、起點與感測回傳均為示意，未連線真實清潔隊
        </p>
        {storageError && (
          <p role="alert" className="storage-warning">
            {storageError}
          </p>
        )}
        {!state.staffLoggedIn ? (
          <section className="staff-login card">
            <span className="eyebrow">READY FOR YOUR SHIFT?</span>
            <h1>進入清潔隊工作台</h1>
            <p>
              使用獨立的「大安區示範隊員」，不需登入市民。切換身份不清除回報、點數或認養資料。
            </p>
            <button
              className="button primary"
              onClick={() =>
                setState((prev) => ({
                  ...initializeTasks(prev),
                  staffLoggedIn: true,
                }))
              }
            >
              使用大安區示範隊員
            </button>
            <p className="tiny">
              此為展示身份選擇，不是正式認證。首次會建立少量虛構工單。
            </p>
          </section>
        ) : section === "honor" ? (
          <HonorPage state={state} />
        ) : section === "route" ? (
          <StaffRoutePage
            bins={routeBins}
            tasks={routeTasks}
            vehicle={vehicle}
            onVehicleChange={setVehicle}
          />
        ) : section === "notifications" ? (
          <>
            <h1>工單通知（站內示範）</h1>
            <p>未傳送LINE。通知保留建單紀錄，完成狀態以工單為準。</p>
            <div className="staff-task-list">
              {orderedTasks(state).map((t) => (
                <a
                  className="staff-task-card"
                  key={t.id}
                  href={`#staff/tasks/${t.id}`}
                >
                  <span className="eyebrow">
                    {priorityLabels[taskPriority(t, state)]} ·{" "}
                    {workLabels[t.status]}
                  </span>
                  <h2>{binFor(t).label}</h2>
                  <p>
                    {reportInfo(t.type).label} · {formatDemoTime(t.createdAt)}
                  </p>
                  <span>查看工單 →</span>
                </a>
              ))}
            </div>
          </>
        ) : section === "tasks" && task ? (
          <TaskDetail task={task} state={state} act={act} />
        ) : section === "tasks" && id ? (
          <section className="card">
            <h1>找不到工單</h1>
            <p>此工單可能不在目前瀏覽器紀錄。</p>
            <a href="#staff/tasks">返回清單</a>
          </section>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">A CLEANER CITY, TOGETHER.</span>
                <h1>今日派工</h1>
                <p>大安區示範隊員 · 每一張工單，都有清楚的下一步。</p>
              </div>
              <span className="staff-shift">本機示範班次</span>
            </div>
            <div className="staff-metrics">
              <section className="card">
                <span>待接單</span>
                <strong>
                  {state.tasks.filter((t) => t.status === "pending").length}
                </strong>
              </section>
              <section className="card">
                <span>處理中</span>
                <strong>
                  {
                    state.tasks.filter(
                      (t) => !taskClosed(t) && t.status !== "pending",
                    ).length
                  }
                </strong>
              </section>
              <section className="card">
                <span>本月完成件數</span>
                <strong>{staffStats(state).count}</strong>
              </section>
            </div>
            <div className="staff-toolbar">
              <div className="filter-chips" role="group" aria-label="派工狀態">
                {[
                  ["pending", "待處理"],
                  ["processing", "處理中"],
                  ["done", "已完成"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <a className="button secondary" href="#staff/route">
                查看示範路線 →
              </a>
            </div>
            <div className="staff-task-list">
              {selectedTasks.map((t) => {
                const priority = taskPriority(t, state);
                const overdue =
                  priority === 0 &&
                  !taskClosed(t) &&
                  Date.now() - Date.parse(t.createdAt) > 30 * 60000;
                return (
                  <a
                    className={`staff-task-card priority-${priority}`}
                    href={`#staff/tasks/${t.id}`}
                    key={t.id}
                  >
                    <div className="section-heading">
                      <span className="eyebrow">
                        {priorityLabels[priority]}
                      </span>
                      <span className="staff-status">
                        {workLabels[t.status]}
                      </span>
                    </div>
                    <h2>{binFor(t).label}</h2>
                    <p>
                      {reportInfo(t.type).label} ·{" "}
                      {t.source === "sensor"
                        ? "靜態感測器情境"
                        : t.source === "inspection"
                          ? "示範稽查"
                          : "市民回報"}{" "}
                      · {state.reports.filter((r) => r.eventId === t.id).length}{" "}
                      筆
                    </p>
                    <p className="tiny">
                      示意直線距離 {distanceLabel(demoDistance(binFor(t)))} ·
                      建單 {formatDemoTime(t.createdAt)}
                    </p>
                    {priority === 0 && !taskClosed(t) && (
                      <p className={overdue ? "staff-overdue" : "tiny"}>
                        {overdue
                          ? "已超過示範目標"
                          : "示範目標：建單後30分鐘內處理"}{" "}
                        · 不承諾實際到場
                      </p>
                    )}
                    <strong>查看與處理 →</strong>
                  </a>
                );
              })}
            </div>
            {!selectedTasks.length && (
              <section className="card">
                <h2>這個分類目前沒有工單</h2>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
