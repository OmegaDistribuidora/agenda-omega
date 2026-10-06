import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config";
import type { AuthUser } from "../types";
import prisma from "./prisma";

export const isAdminRole = (role: AuthUser["role"] | undefined) => role === "ADMIN";
export const hashPassword = (value: string) => bcrypt.hash(value, 10);
export const comparePassword = (value: string, hash: string) => bcrypt.compare(value, hash);
export function signToken(payload: Pick<AuthUser, "userId" | "username" | "role" | "sessionVersion">) {
  return jwt.sign({ ...payload, sessionVersion: payload.sessionVersion ?? 0 }, env.jwtSecret, { algorithm: "HS256", expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] });
}
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return reply.code(401).send({ message: "Sessão não encontrada." });
  let session: AuthUser;
  try {
    session = jwt.verify(auth.slice(7), env.jwtSecret, { algorithms: ["HS256"] }) as AuthUser;
    if (!Number.isInteger(session.userId) || !session.exp) throw new Error("Invalid session");
  } catch { return reply.code(401).send({ message: "Sessão expirada ou inválida." }); }
  // Consultar o banco em cada requisição impede o uso de permissões antigas.
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, username: true, role: true, active: true, sessionVersion: true } });
  if (!user?.active || user.role !== session.role || user.username !== session.username || user.sessionVersion !== (session.sessionVersion ?? 0)) {
    return reply.code(401).send({ message: "Seu acesso foi alterado. Entre novamente pelo Ecossistema." });
  }
  request.authUser = { ...session, username: user.username, role: user.role };
}
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdminRole(request.authUser?.role)) return reply.code(403).send({ message: "Acesso restrito à administração." });
}
