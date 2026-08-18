import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import prisma from "../lib/prisma";
import { env } from "../config";
import { hashPassword, isAdminRole, requireAdmin, requireAuth } from "../lib/security";

const taskInclude = {
  creator: { select: { id: true, displayName: true, username: true, avatarColor: true } },
  team: true, folder: true,
  assignees: { include: { user: { select: { id: true, displayName: true, username: true, avatarColor: true } } } },
  tags: { include: { tag: true } }, subtasks: { orderBy: { position: "asc" as const } },
  comments: { include: { author: { select: { id: true, displayName: true, avatarColor: true } } }, orderBy: { createdAt: "asc" as const } },
  attachments: { orderBy: { createdAt: "desc" as const } },
  activity: { include: { actor: { select: { id: true, displayName: true, avatarColor: true } } }, orderBy: { createdAt: "desc" as const } }
} as const;

async function allowedTeamIds(request: FastifyRequest) {
  if (isAdminRole(request.authUser!.role)) return (await prisma.team.findMany({ select: { id: true } })).map((t) => t.id);
  return (await prisma.teamMember.findMany({ where: { userId: request.authUser!.userId }, select: { teamId: true } })).map((t) => t.teamId);
}
async function requireTeamAccess(request: FastifyRequest, reply: FastifyReply, teamId: number) {
  const allowed = await allowedTeamIds(request);
  if (!allowed.includes(teamId)) { reply.code(403).send({ message: "Você não faz parte desta equipe." }); return false; }
  return true;
}
async function getAccessibleTask(request: FastifyRequest, reply: FastifyReply, taskId: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task || task.deletedAt) { reply.code(404).send({ message: "Atividade não encontrada." }); return null; }
  if (!await requireTeamAccess(request, reply, task.teamId)) return null;
  return task;
}
async function folderBelongsToTeam(reply: FastifyReply, folderId: number | null | undefined, teamId: number) {
  if (!folderId) return true;
  const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { teamId: true } });
  if (!folder || folder.teamId !== teamId) { reply.code(400).send({ message: "A pasta selecionada não pertence à equipe da atividade." }); return false; }
  return true;
}
const person = { select: { id: true, username: true, displayName: true, code: true, email: true, avatarColor: true, role: true, active: true } } as const;

export async function registerWorkspaceRoutes(app: FastifyInstance) {
  app.get("/api/bootstrap", { preHandler: [requireAuth] }, async (request) => {
    const teamIds = await allowedTeamIds(request);
    const [teams, users, folders, tags, tasks] = await Promise.all([
      prisma.team.findMany({ where: { id: { in: teamIds } }, include: { members: { include: { user: person } } }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: isAdminRole(request.authUser!.role) ? {} : { active: true, teamLinks: { some: { teamId: { in: teamIds } } } }, select: { id: true, username: true, displayName: true, code: true, email: true, avatarColor: true, role: true, active: true }, orderBy: { displayName: "asc" } }),
      prisma.folder.findMany({ where: { teamId: { in: teamIds } }, orderBy: [{ teamId: "asc" }, { name: "asc" }] }),
      prisma.tag.findMany({ where: { teamId: { in: teamIds } }, orderBy: { name: "asc" } }),
      prisma.task.findMany({ where: { teamId: { in: teamIds }, deletedAt: null }, include: taskInclude, orderBy: [{ position: "asc" }, { createdAt: "desc" }] })
    ]);
    return { teams, users, folders, tags, tasks };
  });

  app.get("/api/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = Number((request.params as any).id); return await getAccessibleTask(request, reply, id);
  });

  app.post("/api/tasks", { preHandler: [requireAuth] }, async (request, reply) => {
    const schema = z.object({
      title: z.string().trim().min(1).max(180), description: z.string().max(10000).optional().nullable(),
      teamId: z.number().int().positive(), folderId: z.number().int().positive().optional().nullable(),
      status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      dueAt: z.string().datetime().optional().nullable(), assigneeIds: z.array(z.number().int().positive()).optional(), tagIds: z.array(z.number().int().positive()).optional()
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message || "Dados inválidos." });
    if (!await requireTeamAccess(request, reply, parsed.data.teamId)) return;
    if (!await folderBelongsToTeam(reply, parsed.data.folderId, parsed.data.teamId)) return;
    const max = await prisma.task.aggregate({ where: { teamId: parsed.data.teamId, status: parsed.data.status || "TODO" }, _max: { position: true } });
    const task = await prisma.task.create({ data: {
      title: parsed.data.title, description: parsed.data.description || null, teamId: parsed.data.teamId, folderId: parsed.data.folderId || null,
      status: parsed.data.status || "TODO", priority: parsed.data.priority || "MEDIUM", dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      position: (max._max.position || 0) + 1, creatorId: request.authUser!.userId,
      assignees: { create: (parsed.data.assigneeIds?.length ? parsed.data.assigneeIds : [request.authUser!.userId]).map((userId) => ({ userId })) },
      tags: { create: (parsed.data.tagIds || []).map((tagId) => ({ tagId })) },
      activity: { create: { actorId: request.authUser!.userId, action: "CREATED", summary: "criou a atividade" } }
    }, include: taskInclude });
    return reply.code(201).send(task);
  });

  app.patch("/api/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = Number((request.params as any).id); const existing = await getAccessibleTask(request, reply, id); if (!existing) return;
    const schema = z.object({
      title: z.string().trim().min(1).max(180).optional(), description: z.string().max(10000).nullable().optional(),
      teamId: z.number().int().positive().optional(), folderId: z.number().int().positive().nullable().optional(),
      status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      dueAt: z.string().datetime().nullable().optional(), position: z.number().optional(),
      assigneeIds: z.array(z.number().int().positive()).optional(), tagIds: z.array(z.number().int().positive()).optional()
    });
    const parsed = schema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message || "Dados inválidos." });
    if (parsed.data.teamId && !await requireTeamAccess(request, reply, parsed.data.teamId)) return;
    if (!await folderBelongsToTeam(reply, parsed.data.folderId, parsed.data.teamId || existing.teamId)) return;
    const statusChanged = parsed.data.status && parsed.data.status !== existing.status;
    const { assigneeIds, tagIds, dueAt, ...scalar } = parsed.data;
    const statusNames: Record<string, string> = { TODO: "A fazer", IN_PROGRESS: "Em andamento", DONE: "Concluído" };
    await prisma.$transaction(async (tx) => {
      if (assigneeIds) { await tx.taskAssignee.deleteMany({ where: { taskId: id } }); if (assigneeIds.length) await tx.taskAssignee.createMany({ data: assigneeIds.map((userId) => ({ taskId: id, userId })), skipDuplicates: true }); }
      if (tagIds) { await tx.taskTag.deleteMany({ where: { taskId: id } }); if (tagIds.length) await tx.taskTag.createMany({ data: tagIds.map((tagId) => ({ taskId: id, tagId })), skipDuplicates: true }); }
      await tx.task.update({ where: { id }, data: { ...scalar, ...(parsed.data.teamId && parsed.data.teamId !== existing.teamId && parsed.data.folderId === undefined ? { folderId: null } : {}), ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}), ...(statusChanged ? { completedAt: parsed.data.status === "DONE" ? new Date() : null } : {}) } });
      await tx.activityLog.create({ data: { taskId: id, actorId: request.authUser!.userId, action: statusChanged ? "STATUS_CHANGED" : assigneeIds ? "ASSIGNEE_CHANGED" : "UPDATED", summary: statusChanged ? `alterou o status para “${statusNames[parsed.data.status!]}”` : assigneeIds ? "alterou os responsáveis" : "atualizou a atividade", metadata: { changes: Object.keys(parsed.data) } } });
    });
    return prisma.task.findUnique({ where: { id }, include: taskInclude });
  });

  app.delete("/api/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = Number((request.params as any).id); const task = await getAccessibleTask(request, reply, id); if (!task) return;
    await prisma.$transaction([prisma.activityLog.create({ data: { taskId: id, actorId: request.authUser!.userId, action: "DELETED", summary: "excluiu a atividade" } }), prisma.task.update({ where: { id }, data: { deletedAt: new Date() } })]);
    return reply.code(204).send();
  });

  // Mantido para uma possível retomada futura da conversa por atividade.
  // O frontend atual deixa essa funcionalidade oculta por uma feature flag.
  app.post("/api/tasks/:id/comments", { preHandler: [requireAuth] }, async (request, reply) => {
    const taskId = Number((request.params as any).id); if (!await getAccessibleTask(request, reply, taskId)) return;
    const parsed = z.object({ body: z.string().trim().min(1).max(5000) }).safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: "Escreva um comentário." });
    const comment = await prisma.comment.create({ data: { taskId, authorId: request.authUser!.userId, body: parsed.data.body }, include: { author: person } });
    await prisma.activityLog.create({ data: { taskId, actorId: request.authUser!.userId, action: "COMMENTED", summary: "adicionou um comentário" } });
    return reply.code(201).send(comment);
  });

  app.post("/api/tasks/:id/subtasks", { preHandler: [requireAuth] }, async (request, reply) => {
    const taskId = Number((request.params as any).id); if (!await getAccessibleTask(request, reply, taskId)) return;
    const parsed = z.object({ title: z.string().trim().min(1).max(180) }).safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: "Informe a subtarefa." });
    const count = await prisma.subtask.count({ where: { taskId } }); const result = await prisma.subtask.create({ data: { taskId, title: parsed.data.title, position: count + 1 } });
    await prisma.activityLog.create({ data: { taskId, actorId: request.authUser!.userId, action: "SUBTASK_CHANGED", summary: `adicionou a subtarefa “${parsed.data.title}”` } }); return reply.code(201).send(result);
  });

  app.patch("/api/subtasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = Number((request.params as any).id); const subtask = await prisma.subtask.findUnique({ where: { id }, include: { task: true } });
    if (!subtask || !await requireTeamAccess(request, reply, subtask.task.teamId)) return;
    const parsed = z.object({ title: z.string().trim().min(1).max(180).optional(), completed: z.boolean().optional() }).safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: "Dados inválidos." });
    const result = await prisma.subtask.update({ where: { id }, data: parsed.data }); await prisma.activityLog.create({ data: { taskId: subtask.taskId, actorId: request.authUser!.userId, action: "SUBTASK_CHANGED", summary: parsed.data.completed ? `concluiu “${subtask.title}”` : `atualizou “${subtask.title}”` } }); return result;
  });

  app.delete("/api/subtasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = Number((request.params as any).id); const subtask = await prisma.subtask.findUnique({ where: { id }, include: { task: true } });
    if (!subtask || !await requireTeamAccess(request, reply, subtask.task.teamId)) return;
    await prisma.subtask.delete({ where: { id } }); await prisma.activityLog.create({ data: { taskId: subtask.taskId, actorId: request.authUser!.userId, action: "SUBTASK_CHANGED", summary: `removeu a subtarefa “${subtask.title}”` } }); return reply.code(204).send();
  });

  app.post("/api/tasks/:id/attachments", { preHandler: [requireAuth] }, async (request, reply) => {
    const taskId = Number((request.params as any).id); if (!await getAccessibleTask(request, reply, taskId)) return;
    const file = await request.file(); if (!file) return reply.code(400).send({ message: "Selecione um arquivo." });
    const extension = path.extname(file.filename).slice(0, 12); const storedName = `${crypto.randomUUID()}${extension}`; const buffer = await file.toBuffer(); await fs.writeFile(path.join(env.uploadsDir, storedName), buffer);
    const attachment = await prisma.attachment.create({ data: { taskId, uploadedById: request.authUser!.userId, originalName: file.filename, storedName, mimeType: file.mimetype, size: buffer.length } });
    await prisma.activityLog.create({ data: { taskId, actorId: request.authUser!.userId, action: "ATTACHMENT_ADDED", summary: `anexou “${file.filename}”` } }); return reply.code(201).send(attachment);
  });

  app.delete("/api/attachments/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = Number((request.params as any).id); const item = await prisma.attachment.findUnique({ where: { id }, include: { task: true } }); if (!item || !await requireTeamAccess(request, reply, item.task.teamId)) return;
    await prisma.attachment.delete({ where: { id } }); await fs.unlink(path.join(env.uploadsDir, item.storedName)).catch(() => undefined); await prisma.activityLog.create({ data: { taskId: item.taskId, actorId: request.authUser!.userId, action: "ATTACHMENT_REMOVED", summary: `removeu o anexo “${item.originalName}”` } }); return reply.code(204).send();
  });

  app.get("/api/attachments/:id/download", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = Number((request.params as any).id); const item = await prisma.attachment.findUnique({ where: { id }, include: { task: true } });
    if (!item) return reply.code(404).send({ message: "Anexo não encontrado." });
    if (!await requireTeamAccess(request, reply, item.task.teamId)) return;
    try {
      const buffer = await fs.readFile(path.join(env.uploadsDir, item.storedName));
      const safeName = item.originalName.replace(/[\r\n"\\]/g, "_");
      return reply.type(item.mimeType).header("Content-Disposition", `attachment; filename="${safeName}"`).send(buffer);
    } catch { return reply.code(404).send({ message: "Arquivo não encontrado no armazenamento." }); }
  });

  app.post("/api/folders", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = z.object({ name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), teamId: z.number().int().positive() }).safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: "Nome e equipe da pasta são obrigatórios." });
    if (!await requireTeamAccess(request, reply, parsed.data.teamId)) return; return reply.code(201).send(await prisma.folder.create({ data: { ...parsed.data, ownerId: request.authUser!.userId } }));
  });

  app.delete("/api/folders/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = Number((request.params as any).id); const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) return reply.code(404).send({ message: "Pasta não encontrada." });
    if (!await requireTeamAccess(request, reply, folder.teamId)) return;
    await prisma.folder.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post("/api/admin/teams", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const parsed = z.object({ name: z.string().trim().min(2).max(80), description: z.string().max(500).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional() }).safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: "Dados da equipe inválidos." });
    return reply.code(201).send(await prisma.team.create({ data: parsed.data }));
  });

  app.post("/api/admin/users", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const parsed = z.object({ username: z.string().trim().min(2).max(80), displayName: z.string().trim().min(2).max(120), code: z.string().trim().max(40).optional().nullable(), email: z.string().email().optional().nullable(), role: z.enum(["ADMIN", "USER", "SUPERVISOR", "COORDINATOR"]), teamIds: z.array(z.number().int().positive()).min(1) }).safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message || "Dados do usuário inválidos." });
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString("hex")); return reply.code(201).send(await prisma.user.create({ data: { username: parsed.data.username.toLowerCase(), displayName: parsed.data.displayName, code: parsed.data.code || null, email: parsed.data.email, role: parsed.data.role, passwordHash, teamLinks: { create: parsed.data.teamIds.map((teamId) => ({ teamId })) } }, include: { teamLinks: { include: { team: true } } } }));
  });

  app.patch("/api/admin/users/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const id = Number((request.params as any).id);
    const parsed = z.object({
      username: z.string().trim().min(2).max(80),
      displayName: z.string().trim().min(2).max(120),
      code: z.string().trim().max(40).nullable(),
      email: z.string().email().nullable(),
      role: z.enum(["ADMIN", "USER", "SUPERVISOR", "COORDINATOR"]),
      active: z.boolean(),
      teamIds: z.array(z.number().int().positive()).min(1).refine((ids) => new Set(ids).size === ids.length)
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message || "Dados do usuário inválidos." });
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ message: "Usuário não encontrado." });
    if (id === request.authUser!.userId && (parsed.data.role !== "ADMIN" || !parsed.data.active)) {
      return reply.code(400).send({ message: "Você não pode remover seu próprio acesso administrativo nem desativar sua conta." });
    }
    const validTeams = await prisma.team.count({ where: { id: { in: parsed.data.teamIds } } });
    if (validTeams !== parsed.data.teamIds.length) return reply.code(400).send({ message: "Uma das equipes selecionadas não existe." });
    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { username: parsed.data.username.toLowerCase(), displayName: parsed.data.displayName, code: parsed.data.code || null, email: parsed.data.email, role: parsed.data.role, active: parsed.data.active } });
        await tx.teamMember.deleteMany({ where: { userId: id } });
        await tx.teamMember.createMany({ data: parsed.data.teamIds.map((teamId) => ({ userId: id, teamId })) });
        return tx.user.findUnique({ where: { id }, include: { teamLinks: { include: { team: true } } } });
      });
      return { user: updated };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") return reply.code(409).send({ message: "Este login já está sendo usado por outro usuário." });
      throw error;
    }
  });

  app.patch("/api/admin/users/:id/teams", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const id = Number((request.params as any).id); const parsed = z.object({ teamIds: z.array(z.number().int().positive()).min(1) }).safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: "Selecione ao menos uma equipe." });
    await prisma.$transaction(async (tx) => { await tx.teamMember.deleteMany({ where: { userId: id } }); await tx.teamMember.createMany({ data: parsed.data.teamIds.map((teamId) => ({ userId: id, teamId })) }); }); return { ok: true };
  });

  app.delete("/api/admin/users/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const id = Number((request.params as any).id);
    if (id === request.authUser!.userId) return reply.code(400).send({ message: "Você não pode excluir a própria conta." });
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ message: "Usuário não encontrado." });
    await prisma.$transaction(async (tx) => {
      // Conteúdo histórico permanece válido e passa a ter o administrador atual como responsável técnico.
      await tx.task.updateMany({ where: { creatorId: id }, data: { creatorId: request.authUser!.userId } });
      await tx.comment.updateMany({ where: { authorId: id }, data: { authorId: request.authUser!.userId } });
      await tx.folder.updateMany({ where: { ownerId: id }, data: { ownerId: request.authUser!.userId } });
      await tx.user.delete({ where: { id } });
    });
    return reply.code(204).send();
  });

  app.delete("/api/admin/teams/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const id = Number((request.params as any).id); const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return reply.code(404).send({ message: "Equipe não encontrada." });
    const attachments = await prisma.attachment.findMany({ where: { task: { teamId: id } }, select: { storedName: true } });
    await prisma.$transaction(async (tx) => {
      // A exclusão da equipe é definitiva; tarefas levam subtarefas, comentários, anexos e histórico por cascade.
      await tx.task.deleteMany({ where: { teamId: id } });
      await tx.team.delete({ where: { id } });
    });
    await Promise.all(attachments.map((item) => fs.unlink(path.join(env.uploadsDir, item.storedName)).catch(() => undefined)));
    return reply.code(204).send();
  });
}
