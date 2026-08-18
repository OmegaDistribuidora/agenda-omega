import type { FastifyInstance, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config";
import prisma from "../lib/prisma";
import { comparePassword, requireAuth, signToken } from "../lib/security";

const consumed = new Map<string, number>();
const userInclude = { teamLinks: { include: { team: true } } } as const;
function serializeUser(user: any) {
  return { id: user.id, username: user.username, displayName: user.displayName, code: user.code, email: user.email, avatarColor: user.avatarColor, role: user.role, active: user.active, teams: (user.teamLinks || []).map((link: any) => ({ ...link.team, memberRole: link.role })) };
}
async function issue(user: any) {
  return { token: signToken({ userId: user.id, username: user.username, role: user.role }), user: serializeUser(user) };
}
async function blockAdmin(reply: FastifyReply, payload: any, target: string) {
  const source = String(payload.ecosystemUsername || "").toLowerCase();
  if (payload.ecosystemIsAdmin !== true || (source !== target && !env.ecosystemSso.adminUsers.includes(source))) {
    return reply.code(403).send({ message: "Usuário do Ecossistema não autorizado a acessar administrador via SSO." });
  }
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    const parsed = z.object({ username: z.string().min(1), password: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Usuário e senha são obrigatórios." });
    const user = await prisma.user.findUnique({ where: { username: parsed.data.username.trim().toLowerCase() }, include: userInclude });
    if (!user || !user.active || !await comparePassword(parsed.data.password, user.passwordHash)) return reply.code(401).send({ message: "Credenciais inválidas." });
    if (env.nodeEnv === "production" && user.role === "ADMIN") return reply.code(403).send({ message: "Login local administrativo está desabilitado em produção." });
    return issue(user);
  });
  app.post("/api/auth/sso/exchange", async (request, reply) => {
    if (!env.ecosystemSso.sharedSecret) return reply.code(404).send({ message: "Login delegado indisponível." });
    const parsed = z.object({ token: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Token SSO obrigatório." });
    let payload: jwt.JwtPayload;
    try { payload = jwt.verify(parsed.data.token, env.ecosystemSso.sharedSecret, { algorithms: ["HS256"], issuer: env.ecosystemSso.issuer, audience: env.ecosystemSso.audience }) as jwt.JwtPayload; }
    catch { return reply.code(401).send({ message: "Token SSO inválido ou expirado." }); }
    if (typeof payload.jti === "string" && consumed.has(payload.jti)) return reply.code(401).send({ message: "Token SSO já utilizado." });
    const target = String(payload.targetLogin || "").trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { username: target }, include: userInclude });
    if (!user || !user.active) return reply.code(401).send({ message: "Usuário não cadastrado ou inativo na Agenda." });
    if (user.role === "ADMIN") { const blocked = await blockAdmin(reply, payload, target); if (blocked) return blocked; }
    if (typeof payload.jti === "string") consumed.set(payload.jti, Number(payload.exp || 0) * 1000);
    return issue(user);
  });
  app.get("/api/auth/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.authUser!.userId }, include: userInclude });
    if (!user?.active) return reply.code(404).send({ message: "Usuário não encontrado." });
    return { user: serializeUser(user) };
  });
}
