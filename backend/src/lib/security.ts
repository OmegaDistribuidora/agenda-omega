import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config";
import type { AuthUser } from "../types";

export const hashPassword = (value: string) => bcrypt.hash(value, 10);
export const comparePassword = (value: string, hash: string) => bcrypt.compare(value, hash);
export function signToken(payload: Pick<AuthUser, "userId" | "username" | "role">) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] });
}
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return reply.code(401).send({ message: "Sessão não encontrada." });
  try {
    request.authUser = jwt.verify(auth.slice(7), env.jwtSecret) as AuthUser;
  } catch { return reply.code(401).send({ message: "Sessão expirada ou inválida." }); }
}
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.authUser?.role !== "ADMIN") return reply.code(403).send({ message: "Acesso restrito à administração." });
}
