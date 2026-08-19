import test from "node:test";
import assert from "node:assert/strict";
import { buildUserAnalytics, completionBuckets, completionPercentage, isTaskInPeriod, matchesTaskScope, nextStatus, resolveTeamContext, responsibleOptions, tasksForUserPeriod } from "../src/lib/taskUtils.js";
import { clipboardImageFiles, imageExtension } from "../src/lib/clipboard.js";

test("o botão rápido percorre os três estados", () => {
  assert.equal(nextStatus("TODO"), "IN_PROGRESS");
  assert.equal(nextStatus("IN_PROGRESS"), "DONE");
  assert.equal(nextStatus("DONE"), "TODO");
});

test("calcula progresso das subtarefas", () => {
  assert.equal(completionPercentage([]), 0);
  assert.equal(completionPercentage([{ completed: true }, { completed: false }, { completed: true }]), 67);
});

test("resolve a equipe padrão pelo contexto atual", () => {
  const teams = [{ id: 10 }, { id: 20 }];
  const folders = [{ id: 7, teamId: 20 }];
  assert.equal(resolveTeamContext("team:10", folders, teams), 10);
  assert.equal(resolveTeamContext("folder:7", folders, teams), 20);
  assert.equal(resolveTeamContext("mine", folders, [{ id: 10 }]), 10);
  assert.equal(resolveTeamContext("mine", folders, teams), null);
});

test("administrador pode retirar a própria atribuição mesmo sem integrar a equipe", () => {
  const admin = { id: 1, displayName: "Administrador", role: "ADMIN", active: true };
  const member = { id: 2, displayName: "Colaborador", role: "USER", active: true };
  assert.deepEqual(responsibleOptions([member], [admin, member], admin, [admin.id]).map((person) => person.id), [2, 1]);
  assert.deepEqual(responsibleOptions([member], [admin, member], admin, []).map((person) => person.id), [2, 1]);
});

test("separa atividades pessoais e mantém a visão completa da equipe", () => {
  const comercial = 10;
  const operacoes = 20;
  const assignment = (id) => ({ user: { id } });
  const tasks = [
    { id: 1, teamId: comercial, folderId: null, assignees: [assignment(101)] },
    { id: 2, teamId: comercial, folderId: null, assignees: [assignment(101)] },
    { id: 3, teamId: comercial, folderId: null, assignees: [assignment(101)] },
    { id: 4, teamId: comercial, folderId: null, assignees: [assignment(102)] },
    { id: 5, teamId: comercial, folderId: null, assignees: [assignment(102)] },
    { id: 6, teamId: comercial, folderId: null, assignees: [assignment(103)] },
    { id: 7, teamId: comercial, folderId: null, assignees: [assignment(103)] },
    { id: 8, teamId: operacoes, folderId: null, assignees: [assignment(103)] }
  ];
  assert.equal(tasks.filter((task) => matchesTaskScope(task, "mine", 101)).length, 3);
  assert.equal(tasks.filter((task) => matchesTaskScope(task, "mine", 102)).length, 2);
  assert.equal(tasks.filter((task) => matchesTaskScope(task, "mine", 103)).length, 3);
  assert.equal(tasks.filter((task) => matchesTaskScope(task, "team:10", 101)).length, 7);
  assert.equal(tasks.filter((task) => matchesTaskScope(task, "team:20", 103)).length, 1);
});

test("reconhece imagens disponíveis no clipboard sem duplicar", () => {
  const image = { name: "image.png", type: "image/png", size: 120, lastModified: 1 };
  const text = { name: "notas.txt", type: "text/plain", size: 20, lastModified: 1 };
  const clipboard = { files: [image, text], items: [{ kind: "file", type: "image/png", getAsFile: () => image }] };
  assert.deepEqual(clipboardImageFiles(clipboard), [image]);
  assert.equal(imageExtension("image/jpeg"), "jpg");
  assert.equal(imageExtension("image/svg+xml"), "svg");
});

test("análise por usuário inclui atividades sem prazo em qualquer período", () => {
  const start = new Date("2026-08-17T00:00:00-03:00");
  const end = new Date("2026-08-24T00:00:00-03:00");
  const assignment = { user: { id: 10 } };
  const tasks = [
    { id: 1, teamId: 2, dueAt: null, status: "TODO", priority: "MEDIUM", assignees: [assignment] },
    { id: 2, teamId: 2, dueAt: "2026-08-19T12:00:00-03:00", status: "DONE", completedAt: "2026-08-18T10:00:00-03:00", priority: "HIGH", assignees: [assignment] },
    { id: 3, teamId: 2, dueAt: "2026-09-01T12:00:00-03:00", status: "TODO", priority: "LOW", assignees: [assignment] }
  ];
  assert.equal(isTaskInPeriod(tasks[0], start, end), true);
  assert.deepEqual(tasksForUserPeriod(tasks, 2, 10, start, end).map((task) => task.id), [1, 2]);
});

test("calcula indicadores individuais sem conceder peso extra a tarefas sem prazo", () => {
  const start = new Date("2026-08-17T00:00:00-03:00");
  const end = new Date("2026-08-24T00:00:00-03:00");
  const summary = buildUserAnalytics([
    { status: "TODO", dueAt: null, priority: "URGENT" },
    { status: "IN_PROGRESS", dueAt: "2026-08-18T12:00:00-03:00", priority: "MEDIUM" },
    { status: "DONE", dueAt: "2026-08-22T12:00:00-03:00", completedAt: "2026-08-20T12:00:00-03:00", priority: "LOW" },
    { status: "DONE", dueAt: null, completedAt: "2026-08-21T12:00:00-03:00", priority: "LOW" }
  ], start, end, new Date("2026-08-19T12:00:00-03:00"));
  assert.deepEqual(summary, { total: 4, todo: 1, inProgress: 1, done: 2, overdue: 1, withoutDueDate: 2, highPriorityOpen: 1, completedInPeriod: 2, completionRate: 50, onTimeRate: 100 });
});

test("agrupa conclusões por dia na visão semanal", () => {
  const start = new Date("2026-08-17T00:00:00-03:00");
  const end = new Date("2026-08-24T00:00:00-03:00");
  const buckets = completionBuckets([
    { id: 1, title: "Primeira", status: "DONE", completedAt: "2026-08-17T10:00:00-03:00" },
    { id: 2, title: "Segunda", status: "DONE", completedAt: "2026-08-17T15:00:00-03:00" },
    { id: 3, title: "Terceira", status: "DONE", completedAt: "2026-08-19T09:00:00-03:00" },
    { id: 4, title: "Aberta", status: "TODO", completedAt: null }
  ], start, end, "week");
  assert.deepEqual(buckets.map((bucket) => bucket.value), [2, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual(buckets[0].tasks.map((task) => task.id), [1, 2]);
});
