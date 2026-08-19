import test from "node:test";
import assert from "node:assert/strict";
import { resolveInitialAssigneeIds, shouldCreateDemoWorkspace } from "./workflowRules";

test("dados de demonstração nunca são criados em produção", () => {
  assert.equal(shouldCreateDemoWorkspace("production"), false);
  assert.equal(shouldCreateDemoWorkspace("development"), true);
  assert.equal(shouldCreateDemoWorkspace("test"), true);
});

test("atividade sem responsáveis informados fica com o criador por padrão", () => {
  assert.deepEqual(resolveInitialAssigneeIds(undefined, 42), [42]);
});

test("lista vazia explícita permite criar uma atividade sem responsáveis", () => {
  assert.deepEqual(resolveInitialAssigneeIds([], 42), []);
});

test("responsáveis escolhidos são preservados", () => {
  assert.deepEqual(resolveInitialAssigneeIds([7, 11], 42), [7, 11]);
});
