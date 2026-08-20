import type { User, UserRole } from "@prisma/client";
import prisma from "./prisma";

export const restrictedAgendaRoles = new Set<UserRole>(["SUPERVISOR", "COORDINATOR"]);
export const agendaRegions = ["Capital", "Cariri", "Interior"] as const;
export type AgendaRegion = typeof agendaRegions[number];

const regionByCoordinatorCode: Record<string, AgendaRegion> = {
  "12": "Capital",
  "13": "Cariri",
  "10": "Interior"
};

export function isRestrictedAgendaRole(role: UserRole | string | undefined) {
  return role === "SUPERVISOR" || role === "COORDINATOR";
}

export function agendaRegionForCoordinator(code: string | null | undefined) {
  return regionByCoordinatorCode[String(code || "").trim()] || null;
}

export async function syncAgendaUserRegion(userId: number, region: AgendaRegion) {
  return prisma.user.update({ where: { id: userId }, data: { agendaRegion: region } });
}

async function inferredRegion(user: Pick<User, "id" | "code" | "role" | "agendaRegion">) {
  if (agendaRegions.includes(user.agendaRegion as AgendaRegion)) return user.agendaRegion as AgendaRegion;
  if (user.role === "COORDINATOR") {
    const direct = agendaRegionForCoordinator(user.code);
    if (direct) return direct;
  }
  const prior = await prisma.task.findFirst({
    where: {
      deletedAt: null,
      assignees: { some: { userId: user.id } },
      team: { name: { equals: "Comercial Externo", mode: "insensitive" } },
      folder: { name: { in: [...agendaRegions], mode: "insensitive" } }
    },
    select: { folder: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });
  const name = inferredFolderName(prior?.folder?.name);
  if (name) {
    await syncAgendaUserRegion(user.id, name);
    return name;
  }
  return null;
}

function inferredFolderName(value: string | null | undefined): AgendaRegion | null {
  const normalized = String(value || "").trim().toLocaleLowerCase("pt-BR");
  return agendaRegions.find((item) => item.toLocaleLowerCase("pt-BR") === normalized) || null;
}

export async function resolveAgendaPlacement(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, code: true, role: true, agendaRegion: true }
  });
  if (!user || !isRestrictedAgendaRole(user.role)) {
    throw new Error("Usuário sem regra regional de criação.");
  }
  const region = await inferredRegion(user);
  if (!region) {
    throw new Error("A região deste usuário ainda não foi definida na Agenda.");
  }
  const team = await prisma.team.findFirst({
    where: { name: { equals: "Comercial Externo", mode: "insensitive" } },
    select: { id: true, name: true }
  });
  if (!team) throw new Error("A equipe Comercial Externo não foi encontrada na Agenda.");
  const folder = await prisma.folder.findFirst({
    where: { teamId: team.id, name: { equals: region, mode: "insensitive" } },
    select: { id: true, name: true }
  });
  if (!folder) throw new Error(`A pasta ${region} não foi encontrada na equipe Comercial Externo.`);
  return { teamId: team.id, folderId: folder.id, region, teamName: team.name, folderName: folder.name };
}
