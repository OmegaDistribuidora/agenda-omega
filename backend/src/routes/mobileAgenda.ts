import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config";
import prisma from "../lib/prisma";

type AppIdentity = {
  authUserId: string;
  code: string;
  displayName: string | null;
  profileSlug: "supervisor" | "coordenador" | "diretoria" | "outros";
};

type MobileContext = AppIdentity & {
  agendaUser: {
    id: number;
    displayName: string;
    code: string | null;
    role: "SUPERVISOR" | "COORDINATOR";
  };
};

const allowedAppProfiles = new Set(["supervisor", "coordenador", "diretoria", "outros"]);
const mobileTaskInclude = {
  team: { select: { id: true, name: true, color: true } },
  folder: { select: { id: true, name: true, color: true } },
  tags: { include: { tag: true } },
  comments: {
    include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
    orderBy: { createdAt: "asc" as const }
  },
  attachments: { orderBy: { createdAt: "desc" as const } }
} as const;

function bearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

async function supabaseRequest<T>(pathName: string, token: string): Promise<T> {
  const response = await fetch(`${env.gestaoVendas.supabaseUrl}${pathName}`, {
    headers: {
      apikey: env.gestaoVendas.supabasePublishableKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`Supabase respondeu ${response.status}`);
  return await response.json() as T;
}

async function resolveAppIdentity(request: FastifyRequest, reply: FastifyReply): Promise<AppIdentity | null> {
  const token = bearerToken(request);
  if (!token) {
    reply.code(401).send({ message: "Sessão do Gestão de Vendas não encontrada." });
    return null;
  }

  try {
    const authUser = await supabaseRequest<{ id?: string }>("/auth/v1/user", token);
    if (!authUser.id) throw new Error("Usuário autenticado sem identificador");
    const query = new URLSearchParams({
      select: "code,display_name,is_active,app_profiles!inner(slug)",
      auth_user_id: `eq.${authUser.id}`,
      limit: "1"
    });
    const rows = await supabaseRequest<Array<{
      code?: string;
      display_name?: string | null;
      is_active?: boolean;
      app_profiles?: { slug?: string } | Array<{ slug?: string }>;
    }>>(`/rest/v1/app_users?${query.toString()}`, token);
    const row = rows[0];
    const profileRelation = Array.isArray(row?.app_profiles) ? row.app_profiles[0] : row?.app_profiles;
    const profileSlug = String(profileRelation?.slug || "").trim().toLowerCase();
    const code = String(row?.code || "").trim();
    if (!row || row.is_active === false) {
      reply.code(403).send({ message: "Usuário inativo no Gestão de Vendas." });
      return null;
    }
    if (!allowedAppProfiles.has(profileSlug)) {
      reply.code(403).send({ message: "A Agenda não está disponível para este perfil." });
      return null;
    }
    if (!code) {
      reply.code(422).send({ message: "Seu usuário não possui código para integração com a Agenda." });
      return null;
    }
    return {
      authUserId: authUser.id,
      code,
      displayName: row.display_name || null,
      profileSlug: profileSlug as AppIdentity["profileSlug"]
    };
  } catch (error) {
    request.log.warn({ error }, "Falha ao validar sessão do Gestão de Vendas");
    reply.code(401).send({ message: "Sessão do Gestão de Vendas inválida ou expirada." });
    return null;
  }
}

function acceptedAgendaRoles(profileSlug: AppIdentity["profileSlug"]) {
  if (profileSlug === "supervisor") return ["SUPERVISOR"] as const;
  if (profileSlug === "coordenador") return ["COORDINATOR"] as const;
  return ["SUPERVISOR", "COORDINATOR"] as const;
}

async function resolveMobileContext(request: FastifyRequest, reply: FastifyReply): Promise<MobileContext | null> {
  const identity = await resolveAppIdentity(request, reply);
  if (!identity) return null;
  const users = await prisma.user.findMany({
    where: {
      active: true,
      code: { equals: identity.code, mode: "insensitive" },
      role: { in: [...acceptedAgendaRoles(identity.profileSlug)] }
    },
    select: { id: true, displayName: true, code: true, role: true },
    take: 2
  });
  if (!users.length) {
    reply.code(404).send({
      message: `Nenhum Supervisor ou Coordenador ativo foi encontrado na Agenda com o código ${identity.code}.`
    });
    return null;
  }
  if (users.length > 1) {
    reply.code(409).send({ message: `Existe mais de um usuário da Agenda com o código ${identity.code}.` });
    return null;
  }
  return { ...identity, agendaUser: users[0] as MobileContext["agendaUser"] };
}

function saoPauloPeriodBounds(period: "week" | "month", anchor: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? new Date(`${anchor}T12:00:00-03:00`) : new Date();
  const local = new Date(parsed.getTime() - 3 * 60 * 60 * 1000);
  let year = local.getUTCFullYear();
  let month = local.getUTCMonth();
  let day = local.getUTCDate();
  if (period === "week") {
    const weekDay = (local.getUTCDay() + 6) % 7;
    day -= weekDay;
  } else {
    day = 1;
  }
  const start = new Date(Date.UTC(year, month, day, 3, 0, 0));
  const end = new Date(start);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 7);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

async function ownTask(context: MobileContext, taskId: number, reply: FastifyReply) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, assignees: { some: { userId: context.agendaUser.id } } },
    include: mobileTaskInclude
  });
  if (!task) reply.code(404).send({ message: "Atividade não encontrada entre as suas atribuições." });
  return task;
}

export async function registerMobileAgendaRoutes(app: FastifyInstance) {
  app.get("/api/mobile/agenda", async (request, reply) => {
    const context = await resolveMobileContext(request, reply);
    if (!context) return;
    const parsed = z.object({
      period: z.enum(["week", "month"]).default("week"),
      anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "Período inválido." });
    const anchor = parsed.data.anchor || new Date().toISOString().slice(0, 10);
    const { start, end } = saoPauloPeriodBounds(parsed.data.period, anchor);
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        assignees: { some: { userId: context.agendaUser.id } },
        OR: [{ dueAt: null }, { dueAt: { gte: start, lt: end } }]
      },
      include: mobileTaskInclude,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { position: "asc" }, { createdAt: "desc" }]
    });
    return {
      user: context.agendaUser,
      period: { type: parsed.data.period, anchor, start: start.toISOString(), end: end.toISOString() },
      tasks
    };
  });

  app.patch("/api/mobile/agenda/tasks/:id/status", async (request, reply) => {
    const context = await resolveMobileContext(request, reply);
    if (!context) return;
    const taskId = Number((request.params as { id?: string }).id);
    const parsed = z.object({ status: z.enum(["IN_PROGRESS", "DONE"]) }).safeParse(request.body);
    if (!Number.isInteger(taskId) || !parsed.success) return reply.code(400).send({ message: "Status inválido." });
    const task = await ownTask(context, taskId, reply);
    if (!task) return;
    const allowed = task.status === "TODO"
      ? ["IN_PROGRESS", "DONE"]
      : task.status === "IN_PROGRESS" ? ["DONE"] : [];
    if (!allowed.includes(parsed.data.status)) {
      return reply.code(409).send({ message: "Esta atividade não permite essa mudança de status pelo aplicativo." });
    }
    const statusName = parsed.data.status === "DONE" ? "Concluído" : "Em andamento";
    const updated = await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { status: parsed.data.status, completedAt: parsed.data.status === "DONE" ? new Date() : null }
      });
      await tx.activityLog.create({
        data: {
          taskId,
          actorId: context.agendaUser.id,
          action: "STATUS_CHANGED",
          summary: `alterou o status para “${statusName}” pelo aplicativo Gestão de Vendas`,
          metadata: { source: "gestao-vendas-mobile", authUserId: context.authUserId }
        }
      });
      return tx.task.findUnique({ where: { id: taskId }, include: mobileTaskInclude });
    });
    return updated;
  });

  app.post("/api/mobile/agenda/tasks/:id/notes", async (request, reply) => {
    const context = await resolveMobileContext(request, reply);
    if (!context) return;
    const taskId = Number((request.params as { id?: string }).id);
    const parsed = z.object({ body: z.string().trim().min(1).max(5000) }).safeParse(request.body);
    if (!Number.isInteger(taskId) || !parsed.success) return reply.code(400).send({ message: "Informe uma descrição válida." });
    if (!await ownTask(context, taskId, reply)) return;
    const comment = await prisma.comment.create({
      data: { taskId, authorId: context.agendaUser.id, body: parsed.data.body },
      include: { author: { select: { id: true, displayName: true, avatarColor: true } } }
    });
    await prisma.activityLog.create({
      data: {
        taskId,
        actorId: context.agendaUser.id,
        action: "COMMENTED",
        summary: "adicionou uma descrição pelo aplicativo Gestão de Vendas",
        metadata: { source: "gestao-vendas-mobile", authUserId: context.authUserId }
      }
    });
    return reply.code(201).send(comment);
  });

  app.post("/api/mobile/agenda/tasks/:id/photos", async (request, reply) => {
    const context = await resolveMobileContext(request, reply);
    if (!context) return;
    const taskId = Number((request.params as { id?: string }).id);
    if (!Number.isInteger(taskId)) return reply.code(400).send({ message: "Atividade inválida." });
    if (!await ownTask(context, taskId, reply)) return;
    const file = await request.file();
    if (!file) return reply.code(400).send({ message: "Selecione uma foto." });
    if (!file.mimetype.toLowerCase().startsWith("image/")) {
      return reply.code(415).send({ message: "O anexo deve ser uma imagem." });
    }
    const extension = path.extname(file.filename).slice(0, 12) || ".jpg";
    const storedName = `${crypto.randomUUID()}${extension}`;
    const buffer = await file.toBuffer();
    await fs.writeFile(path.join(env.uploadsDir, storedName), buffer);
    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        uploadedById: context.agendaUser.id,
        originalName: file.filename,
        storedName,
        mimeType: file.mimetype,
        size: buffer.length
      }
    });
    await prisma.activityLog.create({
      data: {
        taskId,
        actorId: context.agendaUser.id,
        action: "ATTACHMENT_ADDED",
        summary: `anexou “${file.filename}” pelo aplicativo Gestão de Vendas`,
        metadata: { source: "gestao-vendas-mobile", authUserId: context.authUserId }
      }
    });
    return reply.code(201).send(attachment);
  });
}
