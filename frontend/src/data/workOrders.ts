import { binDemo } from "./binDemo";
import { locations } from "./locations";
import { reportIsFinal, type DemoReport, type ReportType } from "./reports";

export type WorkStatus =
  | "pending"
  | "processing"
  | "arrived"
  | "waiting_sensor"
  | "repair"
  | "completed"
  | "dismissed";
export const workLabels: Record<WorkStatus, string> = {
  pending: "待接單",
  processing: "處理中",
  arrived: "已到場",
  waiting_sensor: "待感測確認",
  repair: "待修繕",
  completed: "處理完成",
  dismissed: "無需處理",
};
export interface WorkOrder {
  id: string;
  locationId: string;
  type: ReportType;
  source: "citizen" | "sensor" | "inspection";
  status: WorkStatus;
  createdAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  photoAt?: string;
  submittedAt?: string;
  completedAt?: string;
  clearReadingId?: string;
  reason?: string;
  confirmedProblem?: boolean;
  fixture?: boolean;
  historical?: boolean;
}
export interface BinReading {
  id: string;
  capacity: number | null;
  observedAt: string;
  receivedAt: string;
  source: "demo";
  taskId: string;
}
export interface OperationalState {
  staffLoggedIn: boolean;
  initialized: boolean;
  tasks: WorkOrder[];
  reports: DemoReport[];
  readings: Record<string, BinReading>;
  completionLikes: string[];
}
export const emptyOperations = (): OperationalState => ({
  staffLoggedIn: false,
  initialized: false,
  tasks: [],
  reports: [],
  readings: {},
  completionLikes: [],
});
export const taskClosed = (task: WorkOrder) =>
  ["completed", "dismissed"].includes(task.status);
export function reportEventOpen(
  state: Pick<OperationalState, "tasks">,
  report: DemoReport,
) {
  const task = state.tasks.find((t) => t.id === report.eventId);
  return task ? !taskClosed(task) : !reportIsFinal(report);
}
export function submitCitizenReport<T extends OperationalState>(
  state: T,
  report: DemoReport,
): T {
  if (
    state.reports.some(
      (r) =>
        r.id === report.id ||
        (r.reporter !== "fixture" &&
          r.locationId === report.locationId &&
          r.type === report.type &&
          reportEventOpen(state, r)),
    )
  )
    return state;
  const bin = locations.find(
    (p) => p.id === report.locationId && p.kind === "bin",
  );
  if (!bin) return state;
  const open = state.tasks.find(
    (t) => t.locationId === bin.id && t.type === report.type && !taskClosed(t),
  );
  const eventId = open?.id || `event-${report.id}`;
  const firstReporter = !state.reports.some((r) => r.eventId === eventId);
  return {
    ...state,
    reports: [
      ...state.reports,
      { ...report, eventId, reporter: "member", firstReporter },
    ],
    tasks:
      open || bin.district !== "大安區"
        ? state.tasks
        : [
            ...state.tasks,
            {
              id: eventId,
              locationId: bin.id,
              type: report.type,
              source: "citizen",
              status: "pending",
              createdAt: report.createdAt,
            },
          ],
  };
}
export type WorkAction =
  | { type: "accept" | "arrive" | "photo" | "finish"; taskId: string }
  | {
      type: "verify";
      taskId: string;
      reportId: string;
      verdict: "approved" | "rejected";
      reason: string;
    }
  | { type: "clear"; taskId: string; readingId: string }
  | { type: "repair" | "dismiss"; taskId: string; reason: string };
function readyToFinish(state: OperationalState, task: WorkOrder) {
  return Boolean(
    task.arrivedAt &&
    task.photoAt &&
    state.reports.filter((r) => r.eventId === task.id).every(reportIsFinal),
  );
}
function completeIfReady<T extends OperationalState>(
  state: T,
  id: string,
  now: string,
): T {
  return {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === id &&
      t.submittedAt &&
      readyToFinish(state, t) &&
      (t.type !== "full" || t.clearReadingId)
        ? {
            ...t,
            status: "completed",
            completedAt: now,
            confirmedProblem: true,
          }
        : t,
    ),
  };
}
export function applyWorkAction<T extends OperationalState>(
  state: T,
  action: WorkAction,
  now = new Date().toISOString(),
): T {
  if (!Number.isFinite(Date.parse(now))) return state;
  const task = state.tasks.find((t) => t.id === action.taskId);
  if (!state.staffLoggedIn || !task || taskClosed(task)) return state;
  if (action.type === "accept") {
    if (task.status !== "pending") return state;
    return {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === task.id ? { ...t, status: "processing", acceptedAt: now } : t,
      ),
      reports: state.reports.map((r) =>
        r.eventId === task.id && !reportIsFinal(r)
          ? { ...r, status: "processing", acceptedAt: now }
          : r,
      ),
    };
  }
  if (action.type === "arrive") {
    if (task.status !== "processing") return state;
    return {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === task.id ? { ...t, status: "arrived", arrivedAt: now } : t,
      ),
    };
  }
  if (!task.arrivedAt) return state;
  if (action.type === "verify") {
    const report = state.reports.find(
      (r) => r.id === action.reportId && r.eventId === task.id,
    );
    if (
      !report ||
      reportIsFinal(report) ||
      (action.verdict === "rejected" && !action.reason.trim())
    )
      return state;
    return completeIfReady(
      {
        ...state,
        reports: state.reports.map((r) =>
          r.id === report.id
            ? {
                ...r,
                status: action.verdict,
                reviewedAt: now,
                rejectionReason: action.reason.trim(),
              }
            : r,
        ),
      },
      task.id,
      now,
    );
  }
  if (action.type === "clear") {
    const previous = state.readings[task.locationId];
    if (
      task.clearReadingId ||
      !action.readingId ||
      state.tasks.some((t) => t.clearReadingId === action.readingId) ||
      Object.values(state.readings).some((r) => r.id === action.readingId) ||
      (previous && previous.observedAt >= now) ||
      now < task.arrivedAt
    )
      return state;
    const reading: BinReading = {
      id: action.readingId,
      capacity: 0,
      observedAt: now,
      receivedAt: now,
      source: "demo",
      taskId: task.id,
    };
    return completeIfReady(
      {
        ...state,
        readings: { ...state.readings, [task.locationId]: reading },
        tasks: state.tasks.map((t) =>
          t.id === task.id ? { ...t, clearReadingId: reading.id } : t,
        ),
      },
      task.id,
      now,
    );
  }
  if (action.type === "photo") {
    return task.photoAt
      ? state
      : {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === task.id ? { ...t, photoAt: now } : t,
          ),
        };
  }
  if (action.type === "repair") {
    if (
      task.type !== "broken" ||
      !action.reason.trim() ||
      task.status === "waiting_sensor"
    )
      return state;
    return {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === task.id
          ? { ...t, status: "repair", reason: action.reason.trim() }
          : t,
      ),
    };
  }
  if (!readyToFinish(state, task)) return state;
  if (action.type === "dismiss") {
    if (!action.reason.trim()) return state;
    return {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: "dismissed",
              completedAt: now,
              reason: action.reason.trim(),
              confirmedProblem: false,
            }
          : t,
      ),
    };
  }
  return completeIfReady(
    {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              submittedAt: now,
              status:
                t.type === "full" && !t.clearReadingId
                  ? "waiting_sensor"
                  : t.status,
            }
          : t,
      ),
    },
    task.id,
    now,
  );
}

export function initializeTasks<T extends OperationalState>(
  state: T,
  now = new Date().toISOString(),
): T {
  if (state.initialized) return state;
  const bins = locations
    .filter(
      (p) =>
        p.kind === "bin" &&
        p.district === "大安區" &&
        !state.tasks.some((t) => t.locationId === p.id) &&
        [...p.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 19 !== 0,
    )
    .slice(-6);
  let result = { ...state, initialized: true };
  const types: ReportType[] = [
    "dumping",
    "full",
    "dirty",
    "broken",
    "full",
    "dirty",
  ];
  bins.forEach((bin, index) => {
    const id = `fixture-${bin.id}`;
    const time = new Date(Date.parse(now) - (index + 1) * 60000).toISOString();
    const task: WorkOrder = {
      id,
      locationId: bin.id,
      type: types[index],
      source: index === 1 || index === 4 ? "sensor" : "citizen",
      status: "pending",
      createdAt: time,
      fixture: true,
    };
    if (index === 3)
      Object.assign(task, {
        status: "repair",
        acceptedAt: time,
        arrivedAt: time,
        reason: "示範：桶蓋需修繕",
      });
    if (index === 5)
      Object.assign(task, {
        status: "completed",
        acceptedAt: time,
        arrivedAt: time,
        photoAt: now,
        submittedAt: now,
        completedAt: now,
        confirmedProblem: true,
        historical: true,
      });
    const reports: DemoReport[] =
      task.source === "citizen"
        ? Array.from({ length: index === 0 ? 3 : 1 }, (_, n) => ({
            id: `${id}-report-${n}`,
            eventId: id,
            locationId: bin.id,
            type: task.type,
            description: "其他市民的虛構示範回報，未影響會員帳本。",
            createdAt: time,
            status: index === 5 ? "approved" : "pending",
            ...(index === 5 ? { reviewedAt: now } : {}),
            firstReporter: n === 0,
            adopter: false,
            photo: true,
            reporter: "fixture" as const,
          }))
        : [];
    result = {
      ...result,
      tasks: [...result.tasks, task],
      reports: [...result.reports, ...reports],
    };
    if (task.source === "sensor")
      result = {
        ...result,
        readings: {
          ...result.readings,
          [bin.id]: {
            id: `${id}-initial`,
            taskId: id,
            capacity: 94,
            observedAt: time,
            receivedAt: time,
            source: "demo",
          },
        },
      };
  });
  return result;
}
export function taskPriority(task: WorkOrder, state: OperationalState) {
  const location = locations.find((p) => p.id === task.locationId);
  const capacity = location ? binDemo(location, [], state).capacity : null;
  if (
    task.type === "dumping" ||
    (capacity !== null && capacity !== undefined && capacity >= 90)
  )
    return 0;
  if (
    task.type === "full" ||
    (capacity !== null && capacity !== undefined && capacity >= 80) ||
    state.reports.some((r) => r.eventId === task.id && r.quick)
  )
    return 1;
  return task.source === "inspection" ? 3 : 2;
}
export function orderedTasks(state: OperationalState) {
  return [...state.tasks].sort(
    (a, b) =>
      taskPriority(a, state) - taskPriority(b, state) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}
export function latestCleanup(state: OperationalState, binId: string) {
  return state.tasks
    .filter(
      (t) =>
        t.locationId === binId &&
        t.status === "completed" &&
        t.photoAt &&
        ["full", "dirty", "dumping"].includes(t.type),
    )
    .sort(
      (a, b) =>
        b.completedAt!.localeCompare(a.completedAt!) ||
        a.id.localeCompare(b.id),
    )[0];
}
export function taipeiMonth(date: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(date));
}
export function staffStats(
  state: OperationalState,
  now = new Date().toISOString(),
) {
  const completed = state.tasks.filter(
    (t) =>
      t.status === "completed" &&
      t.confirmedProblem &&
      t.photoAt &&
      t.completedAt &&
      taipeiMonth(t.completedAt) === taipeiMonth(now),
  );
  const durations = completed
    .filter((t) => t.acceptedAt && t.completedAt! >= t.acceptedAt)
    .map(
      (t) => (Date.parse(t.completedAt!) - Date.parse(t.acceptedAt!)) / 60000,
    );
  return {
    count: completed.length,
    baseline: completed.filter((t) => t.historical).length,
    likes: state.completionLikes.length,
    average: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null,
  };
}
