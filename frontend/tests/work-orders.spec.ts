import { test, expect } from "@playwright/test";
import {
  emptyOperations,
  submitCitizenReport,
  applyWorkAction,
  staffStats,
  latestCleanup,
} from "../src/data/workOrders";
import { locations } from "../src/data/locations";
import { binDemo, isUsableBin } from "../src/data/binDemo";
const bin = locations.find(
  (p) => p.kind === "bin" && p.district === "大安區" && !binDemo(p).removed,
)!;
const start = "2026-10-18T08:00:00.000Z";
test("verification settles a report but keeps its event open until a new clear reading and photo complete the work", () => {
  let state = submitCitizenReport(emptyOperations(), {
    id: "report-1",
    locationId: bin.id,
    type: "full",
    description: "",
    createdAt: start,
    status: "pending",
    adopter: false,
    firstReporter: true,
    photo: true,
  });
  const id = state.tasks[0].id;
  state = { ...state, staffLoggedIn: true };
  state = applyWorkAction(state, { type: "accept", taskId: id }, start);
  state = applyWorkAction(state, { type: "arrive", taskId: id }, start);
  state = applyWorkAction(
    state,
    {
      type: "verify",
      taskId: id,
      reportId: "report-1",
      verdict: "approved",
      reason: "",
    },
    start,
  );
  expect(state.reports[0].status).toBe("approved");
  expect(state.tasks[0].status).toBe("arrived");
  const duplicate = submitCitizenReport(state, {
    ...state.reports[0],
    id: "report-2",
    status: "pending",
  });
  expect(duplicate.reports).toHaveLength(1);
  state = applyWorkAction(state, { type: "photo", taskId: id }, start);
  state = applyWorkAction(state, { type: "finish", taskId: id }, start);
  expect(state.tasks[0].status).toBe("waiting_sensor");
  state = applyWorkAction(
    state,
    { type: "clear", taskId: id, readingId: "reading-1" },
    "2026-10-18T08:01:00.000Z",
  );
  expect(state.tasks[0].status).toBe("completed");
  expect(state.readings[bin.id].capacity).toBe(0);
  expect(
    applyWorkAction(
      state,
      { type: "clear", taskId: id, readingId: "reading-1" },
      "2026-10-18T08:02:00.000Z",
    ),
  ).toEqual(state);
  expect(
    submitCitizenReport(state, {
      ...state.reports[0],
      id: "report-2",
      status: "pending",
      createdAt: "2026-10-18T09:00:00.000Z",
    }).tasks,
  ).toHaveLength(2);
});

test("a clear reading cannot resolve dumping or repair, false first reports do not promote later reporters", () => {
  let state = submitCitizenReport(emptyOperations(), {
    id: "first",
    locationId: bin.id,
    type: "dumping",
    description: "",
    createdAt: start,
    status: "pending",
    adopter: false,
    firstReporter: true,
  });
  const id = state.tasks[0].id;
  state.reports.push({
    ...state.reports[0],
    id: "later",
    firstReporter: false,
    reporter: "fixture",
  });
  state = { ...state, staffLoggedIn: true };
  state = applyWorkAction(state, { type: "arrive", taskId: id }, start);
  expect(state.tasks[0].status).toBe("pending");
  state = applyWorkAction(state, { type: "accept", taskId: id }, start);
  state = applyWorkAction(state, { type: "arrive", taskId: id }, start);
  state = applyWorkAction(
    state,
    {
      type: "verify",
      taskId: id,
      reportId: "first",
      verdict: "rejected",
      reason: "",
    },
    start,
  );
  expect(state.reports[0].status).toBe("processing");
  state = applyWorkAction(
    state,
    {
      type: "verify",
      taskId: id,
      reportId: "first",
      verdict: "rejected",
      reason: "照片與現況不符",
    },
    start,
  );
  state = applyWorkAction(
    state,
    {
      type: "verify",
      taskId: id,
      reportId: "later",
      verdict: "approved",
      reason: "",
    },
    start,
  );
  state = applyWorkAction(
    state,
    { type: "clear", taskId: id, readingId: "clear" },
    "2026-10-18T08:01:00.000Z",
  );
  expect(state.tasks[0].status).toBe("arrived");
  expect(state.reports[1].firstReporter).toBe(false);
  state = applyWorkAction(state, { type: "photo", taskId: id }, start);
  state = applyWorkAction(state, { type: "finish", taskId: id }, start);
  expect(state.tasks[0].status).toBe("completed");
});

test("a reused or invalid sensor message never satisfies a different work order", () => {
  let state = submitCitizenReport(emptyOperations(), {
    id: "one",
    locationId: bin.id,
    type: "full",
    description: "",
    createdAt: start,
    status: "pending",
    adopter: false,
    firstReporter: true,
  });
  state = { ...state, staffLoggedIn: true };
  const first = state.tasks[0].id;
  for (const type of ["accept", "arrive"] as const)
    state = applyWorkAction(state, { type, taskId: first }, start);
  state = applyWorkAction(
    state,
    { type: "clear", taskId: first, readingId: "unique-message" },
    "2026-10-18T08:01:00.000Z",
  );
  state = submitCitizenReport(state, {
    id: "two",
    locationId: bin.id,
    type: "dirty",
    description: "",
    createdAt: start,
    status: "pending",
    adopter: false,
    firstReporter: true,
  });
  const second = state.tasks[1].id;
  for (const type of ["accept", "arrive"] as const)
    state = applyWorkAction(state, { type, taskId: second }, start);
  const before = state;
  state = applyWorkAction(
    state,
    { type: "clear", taskId: second, readingId: "unique-message" },
    "2026-10-18T08:02:00.000Z",
  );
  expect(state).toEqual(before);
  expect(
    applyWorkAction(
      state,
      { type: "clear", taskId: second, readingId: "bad-date" },
      "invalid",
    ),
  ).toEqual(before);
});

test("clear-first work waits for evidence, counts once in the Taipei completion month, and resets likes for the next completion", () => {
  const submit = (state: ReturnType<typeof emptyOperations>, id: string) =>
    submitCitizenReport(state, {
      id,
      locationId: bin.id,
      type: "full",
      description: "",
      createdAt: start,
      status: "pending",
      adopter: false,
      firstReporter: true,
      photo: true,
    });
  let state = submit(
    { ...emptyOperations(), staffLoggedIn: true },
    "month-end",
  );
  const id = state.tasks[0].id;
  for (const type of ["accept", "arrive"] as const)
    state = applyWorkAction(state, { type, taskId: id }, start);
  state = applyWorkAction(
    state,
    { type: "clear", taskId: id, readingId: "clear-first" },
    "2026-10-31T15:59:00.000Z",
  );
  expect(binDemo(bin, [], state).capacity).toBe(0);
  expect(staffStats(state, start).count).toBe(0);
  state = applyWorkAction(
    state,
    {
      type: "verify",
      taskId: id,
      reportId: "month-end",
      verdict: "approved",
      reason: "",
    },
    "2026-10-31T15:59:30.000Z",
  );
  state = applyWorkAction(
    state,
    { type: "photo", taskId: id },
    "2026-10-31T16:00:00.000Z",
  );
  state = applyWorkAction(
    state,
    { type: "finish", taskId: id },
    "2026-10-31T16:00:01.000Z",
  );
  expect(staffStats(state, "2026-10-31T15:59:00.000Z").count).toBe(0);
  expect(staffStats(state, "2026-11-01T00:00:00.000Z").count).toBe(1);
  expect(applyWorkAction(state, { type: "finish", taskId: id })).toEqual(state);
  state = { ...state, completionLikes: [id] };
  expect(staffStats(state, "2026-11-01T00:00:00.000Z").count).toBe(1);
  state = submit(state, "next-cleanup");
  const nextId = state.tasks[1].id;
  for (const type of ["accept", "arrive"] as const)
    state = applyWorkAction(
      state,
      { type, taskId: nextId },
      "2026-11-01T01:00:00.000Z",
    );
  state = applyWorkAction(
    state,
    { type: "clear", taskId: nextId, readingId: "next-clear" },
    "2026-11-01T01:01:00.000Z",
  );
  state = applyWorkAction(
    state,
    {
      type: "verify",
      taskId: nextId,
      reportId: "next-cleanup",
      verdict: "approved",
      reason: "",
    },
    "2026-11-01T01:01:00.000Z",
  );
  for (const type of ["photo", "finish"] as const)
    state = applyWorkAction(
      state,
      { type, taskId: nextId },
      "2026-11-01T01:02:00.000Z",
    );
  expect(latestCleanup(state, bin.id)?.id).toBe(nextId);
  expect(state.completionLikes).not.toContain(nextId);
});

test("repair stays unavailable after zero capacity and a no-work closure requires evidence without performance credit", () => {
  let state = submitCitizenReport(
    { ...emptyOperations(), staffLoggedIn: true },
    {
      id: "broken",
      locationId: bin.id,
      type: "broken",
      description: "",
      createdAt: start,
      status: "pending",
      adopter: false,
      firstReporter: true,
    },
  );
  const id = state.tasks[0].id;
  for (const type of ["accept", "arrive"] as const)
    state = applyWorkAction(state, { type, taskId: id }, start);
  state = applyWorkAction(
    state,
    { type: "repair", taskId: id, reason: "待更換桶蓋" },
    start,
  );
  state = applyWorkAction(
    state,
    { type: "clear", taskId: id, readingId: "repair-clear" },
    "2026-10-18T08:01:00.000Z",
  );
  expect(binDemo(bin, [], state)).toMatchObject({
    capacity: 0,
    repairing: true,
  });
  expect(state.tasks[0].status).toBe("repair");
  expect(isUsableBin(bin, state)).toBe(false);
  expect(
    applyWorkAction(
      state,
      { type: "dismiss", taskId: id, reason: "現況無損" },
      start,
    ),
  ).toEqual(state);
  state = applyWorkAction(
    state,
    {
      type: "verify",
      taskId: id,
      reportId: "broken",
      verdict: "rejected",
      reason: "照片誤認",
    },
    start,
  );
  state = applyWorkAction(state, { type: "photo", taskId: id }, start);
  state = applyWorkAction(
    state,
    { type: "dismiss", taskId: id, reason: "現場確認桶蓋正常" },
    start,
  );
  expect(state.tasks[0].status).toBe("dismissed");
  expect(staffStats(state, start).count).toBe(0);
  expect(latestCleanup(state, bin.id)).toBeUndefined();
});
