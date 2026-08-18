import prisma from "./prisma";
import { env } from "../config";
import { hashPassword } from "./security";

const colors = ["#e56545", "#3f7f75", "#7b63a6", "#d9a441"];

export async function ensureBootstrapData() {
  const passwordHash = await hashPassword(env.adminPassword);
  const admin = await prisma.user.upsert({
    where: { username: env.adminUsername },
    update: { displayName: env.adminDisplayName, active: true },
    create: { username: env.adminUsername, displayName: env.adminDisplayName, email: "admin@omega.local", passwordHash, role: "ADMIN", avatarColor: colors[0] }
  });
  const team = await prisma.team.upsert({
    where: { name: "Operações" }, update: {},
    create: { name: "Operações", description: "Rotinas e projetos internos", color: "#3f7f75" }
  });
  await prisma.teamMember.upsert({ where: { userId_teamId: { userId: admin.id, teamId: team.id } }, update: { role: "LEAD" }, create: { userId: admin.id, teamId: team.id, role: "LEAD" } });
  if (env.nodeEnv === "production" || await prisma.task.count()) return;

  const users = [];
  for (const [index, info] of [["joao", "João Martins"], ["william", "William Alves"], ["ana", "Ana Clara"]].entries()) {
    const user = await prisma.user.upsert({
      where: { username: info[0] }, update: {},
      create: { username: info[0], displayName: info[1], email: `${info[0]}@omega.local`, passwordHash, avatarColor: colors[index + 1] }
    });
    await prisma.teamMember.upsert({ where: { userId_teamId: { userId: user.id, teamId: team.id } }, update: {}, create: { userId: user.id, teamId: team.id } });
    users.push(user);
  }
  const [campaign, urgent] = await Promise.all([
    prisma.tag.upsert({ where: { teamId_name: { teamId: team.id, name: "Campanha" } }, update: {}, create: { teamId: team.id, name: "Campanha", color: "#e56545" } }),
    prisma.tag.upsert({ where: { teamId_name: { teamId: team.id, name: "Comercial" } }, update: {}, create: { teamId: team.id, name: "Comercial", color: "#d9a441" } })
  ]);
  const folder = await prisma.folder.create({ data: { name: "Campanhas Q3", color: "#e56545", ownerId: admin.id, teamId: team.id } });
  const due = new Date(); due.setDate(due.getDate() + 3); due.setHours(18, 0, 0, 0);
  const task = await prisma.task.create({ data: {
    title: "Criar campanha Bombril", description: "Preparar a campanha de sell-out com os materiais finais para os RCAs.",
    status: "IN_PROGRESS", priority: "HIGH", dueAt: due, position: 1, creatorId: admin.id, teamId: team.id, folderId: folder.id,
    assignees: { create: [{ userId: users[0].id }, { userId: admin.id }] }, tags: { create: [{ tagId: campaign.id }, { tagId: urgent.id }] },
    subtasks: { create: [{ title: "Criar arte", position: 1, completed: true }, { title: "Validar fornecedor", position: 2 }, { title: "Publicar campanha", position: 3 }] },
    activity: { create: { actorId: admin.id, action: "CREATED", summary: "criou a atividade" } }
  }});
  await prisma.comment.create({ data: { taskId: task.id, authorId: users[0].id, body: "A primeira versão da arte fica pronta hoje à tarde." } });
  await prisma.activityLog.create({ data: { taskId: task.id, actorId: users[0].id, action: "STATUS_CHANGED", summary: "alterou o status para “Em andamento”" } });
  await prisma.task.createMany({ data: [
    { title: "Revisar metas do mês", status: "TODO", priority: "URGENT", creatorId: admin.id, teamId: team.id, dueAt: new Date(Date.now() + 86400000), position: 2 },
    { title: "Integração API de pedidos", status: "IN_PROGRESS", priority: "MEDIUM", creatorId: admin.id, teamId: team.id, position: 3 },
    { title: "Atualizar cadastro de RCA", status: "DONE", priority: "LOW", creatorId: admin.id, teamId: team.id, completedAt: new Date(), position: 4 }
  ]});
}
