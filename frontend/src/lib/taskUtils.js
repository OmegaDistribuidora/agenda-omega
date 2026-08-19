export const STATUS_FLOW = { TODO: "IN_PROGRESS", IN_PROGRESS: "DONE", DONE: "TODO" };
export function nextStatus(status) { return STATUS_FLOW[status] || "TODO"; }
export function completionPercentage(subtasks = []) { return subtasks.length ? Math.round(subtasks.filter((item) => item.completed).length / subtasks.length * 100) : 0; }
export function resolveTeamContext(scope, folders = [], teams = []) {
  if (scope.startsWith("team:")) return Number(scope.split(":")[1]);
  if (scope.startsWith("folder:")) return folders.find((folder) => folder.id === Number(scope.split(":")[1]))?.teamId || null;
  return teams.length === 1 ? teams[0].id : null;
}

export function matchesTaskScope(task, scope, userId) {
  if (scope === "mine") return task.assignees.some((assignment) => assignment.user.id === userId);
  if (scope.startsWith("team:")) return task.teamId === Number(scope.split(":")[1]);
  if (scope.startsWith("folder:")) return task.folderId === Number(scope.split(":")[1]);
  return false;
}

export function isTaskInPeriod(task, start, end) {
  if (!task.dueAt) return true;
  const dueAt = new Date(task.dueAt);
  return dueAt >= start && dueAt < end;
}

export function tasksForUserPeriod(tasks, teamId, userId, start, end) {
  return tasks.filter((task) => task.teamId === teamId
    && task.assignees.some((assignment) => assignment.user.id === userId)
    && isTaskInPeriod(task, start, end));
}

export function buildUserAnalytics(tasks, start, end, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todo = tasks.filter((task) => task.status === "TODO").length;
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const done = tasks.filter((task) => task.status === "DONE").length;
  const total = tasks.length;
  const overdue = tasks.filter((task) => task.status !== "DONE" && task.dueAt && new Date(task.dueAt) < today).length;
  const withoutDueDate = tasks.filter((task) => !task.dueAt).length;
  const highPriorityOpen = tasks.filter((task) => task.status !== "DONE" && ["HIGH", "URGENT"].includes(task.priority)).length;
  const completedInPeriod = tasks.filter((task) => task.status === "DONE" && task.completedAt && new Date(task.completedAt) >= start && new Date(task.completedAt) < end).length;
  const completedWithDeadline = tasks.filter((task) => task.status === "DONE" && task.dueAt && task.completedAt);
  const completedOnTime = completedWithDeadline.filter((task) => new Date(task.completedAt) <= new Date(task.dueAt)).length;
  return {
    total,
    todo,
    inProgress,
    done,
    overdue,
    withoutDueDate,
    highPriorityOpen,
    completedInPeriod,
    completionRate: total ? Math.round(done / total * 100) : 0,
    onTimeRate: completedWithDeadline.length ? Math.round(completedOnTime / completedWithDeadline.length * 100) : null
  };
}

export function completionBuckets(tasks, start, end, mode) {
  const bucketCount = mode === "week" ? 7 : Math.ceil((end - start) / 86400000 / 7);
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start);
    bucketStart.setDate(start.getDate() + index * (mode === "week" ? 1 : 7));
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketStart.getDate() + (mode === "week" ? 1 : 7));
    if (bucketEnd > end) bucketEnd.setTime(end.getTime());
    const label = mode === "week"
      ? bucketStart.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
      : `${bucketStart.getDate()}–${new Date(bucketEnd.getTime() - 1).getDate()}`;
    return { label, start: bucketStart, end: bucketEnd, value: 0 };
  });
  for (const task of tasks) {
    if (task.status !== "DONE" || !task.completedAt) continue;
    const completedAt = new Date(task.completedAt);
    const bucket = buckets.find((item) => completedAt >= item.start && completedAt < item.end);
    if (bucket) bucket.value += 1;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}
