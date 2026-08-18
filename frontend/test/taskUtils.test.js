import test from "node:test";
import assert from "node:assert/strict";
import { completionPercentage, matchesTaskScope, nextStatus, resolveTeamContext } from "../src/lib/taskUtils.js";
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
