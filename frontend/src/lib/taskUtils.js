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
