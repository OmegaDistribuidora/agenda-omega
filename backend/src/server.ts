import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { env } from "./config";
import prisma from "./lib/prisma";
import { ensureBootstrapData } from "./lib/seed";
import { registerAuthRoutes } from "./routes/auth";
import { registerWorkspaceRoutes } from "./routes/workspace";
import { registerMobileAgendaRoutes } from "./routes/mobileAgenda";
import type { AuthUser } from "./types";

declare module "fastify" { interface FastifyRequest { authUser?: AuthUser } }
const app = Fastify({ logger: true });
async function bootstrap() {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  fs.mkdirSync(env.uploadsDir, { recursive: true });
  app.get("/api/health", async () => ({ status: "ok", service: "agenda-omega" }));
  await registerAuthRoutes(app); await registerWorkspaceRoutes(app); await registerMobileAgendaRoutes(app);
  await prisma.$connect(); await ensureBootstrapData();
  const frontendDist = path.resolve(__dirname, "..", "..", "frontend", "dist");
  if (fs.existsSync(frontendDist)) {
    await app.register(fastifyStatic, { root: frontendDist, wildcard: false });
    app.get("/*", async (request, reply) => request.url.startsWith("/api/") ? reply.code(404).send({ message: "Rota não encontrada." }) : reply.sendFile("index.html"));
  }
  await app.listen({ port: env.port, host: "0.0.0.0" });
}
bootstrap().catch(async (error) => { app.log.error(error); await prisma.$disconnect().catch(() => undefined); process.exit(1); });
