import test, { type TestContext } from "node:test";
function stub(t: TestContext, target: any, method: string, replacement: any) {
  const original = target[method]; target[method] = replacement;
  t.after(() => { target[method] = original; });
}
import assert from "node:assert/strict";
import Fastify from "fastify";
import prisma from "./prisma";
import { requireAuth, requireAdmin, signToken } from "./security";
import { registerWorkspaceRoutes } from "../routes/workspace";

test("sessão revogada não autoriza usuário inativo, excluído, reativado ou com novo perfil", async t => {
  const original = { id: 1, username: "admin", role: "ADMIN", active: true, sessionVersion: 0 };
  let current: any = original;
  stub(t, prisma.user, "findUnique", async () => current);
  const app = Fastify();
  app.get("/protected", { preHandler: [requireAuth, requireAdmin] }, async () => ({ ok: true }));
  t.after(() => app.close());
  const token = signToken({ userId: 1, username: "admin", role: "ADMIN", sessionVersion: 0 });
  const request = () => app.inject({ url: "/protected", headers: { authorization: `Bearer ${token}` } });
  assert.equal((await request()).statusCode, 200);
  for (const user of [null, { ...original, active: false }, { ...original, role: "USER" }, { ...original, sessionVersion: 2 }]) {
    current = user;
    assert.equal((await request()).statusCode, 401);
  }
  current = { ...original, sessionVersion: 2 };
  const freshToken = signToken({ userId: 1, username: "admin", role: "ADMIN", sessionVersion: 2 });
  assert.equal((await app.inject({ url: "/protected", headers: { authorization: `Bearer ${freshToken}` } })).statusCode, 200);
});

test("criação via API registra conclusão apenas quando criada em DONE", async t => {
  stub(t, prisma.user, "findUnique", async () => ({ id: 1, username: "admin", role: "ADMIN", active: true, sessionVersion: 0 }));
  stub(t, prisma.team, "findMany", async () => [{ id: 10 }]);
  stub(t, prisma.task, "aggregate", async () => ({ _max: { position: 0 } }));
  stub(t, prisma.task, "create", async (args: any) => ({ id: 5, ...args.data }));
  const app = Fastify();
  await registerWorkspaceRoutes(app);
  t.after(() => app.close());
  const token = signToken({ userId: 1, username: "admin", role: "ADMIN" });
  for (const status of ["TODO", "IN_PROGRESS", "DONE"]) {
    const before = Date.now();
    const result = await app.inject({ method: "POST", url: "/api/tasks", headers: { authorization: `Bearer ${token}` }, payload: { title: "Teste", teamId: 10, status } });
    assert.equal(result.statusCode, 201);
    if (status === "DONE") assert.ok(new Date(result.json().completedAt).getTime() >= before);
    else assert.equal(result.json().completedAt, null);
  }
});

test("edição administrativa incrementa versão apenas para alterações de acesso", async t => {
  const admin = { id: 1, username: "admin", role: "ADMIN", active: true, sessionVersion: 0 };
  let target: any = { id: 2, username: "pessoa", role: "USER", active: true, sessionVersion: 0 };
  stub(t, prisma.user, "findUnique", async ({ where }: any) => where.id === 1 ? admin : target);
  stub(t, prisma.team, "count", async () => 1);
  stub(t, prisma, "$transaction", async (callback: any) => callback({
    user: {
      findUniqueOrThrow: async () => target,
      update: async ({ data }: any) => { target = { ...target, ...data, sessionVersion: target.sessionVersion + (data.sessionVersion?.increment || 0) }; },
      findUnique: async () => target
    },
    teamMember: { deleteMany: async () => {}, createMany: async () => {} }
  }));
  const app = Fastify(); await registerWorkspaceRoutes(app); t.after(() => app.close());
  const token = signToken({ userId: 1, username: "admin", role: "ADMIN" });
  for (const [change, version] of [[{},0], [{active:false},1], [{active:true},2], [{role:"SUPERVISOR"},3], [{username:"novo-login"},4]] as const) {
    const result = await app.inject({ method:"PATCH", url:"/api/admin/users/2", headers:{ authorization:`Bearer ${token}` }, payload:{ username:target.username, displayName:"Pessoa", code:null, email:null, role:target.role, active:target.active, teamIds:[10], ...change } });
    assert.equal(result.statusCode,200); assert.equal(target.sessionVersion,version);
  }
});
