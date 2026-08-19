export function shouldCreateDemoWorkspace(nodeEnv: string) {
  return nodeEnv !== "production";
}

export function resolveInitialAssigneeIds(assigneeIds: number[] | undefined, creatorId: number) {
  return assigneeIds === undefined ? [creatorId] : assigneeIds;
}
