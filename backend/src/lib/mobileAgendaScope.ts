export type MobileAgendaOwner = {
  active?: boolean;
  role: string;
  code: string | null;
};

const agendaOwnerRoles = new Set(["SUPERVISOR", "COORDINATOR"]);

export function mobileAgendaOwnerKey(owner: Pick<MobileAgendaOwner, "role" | "code">) {
  return `${owner.role}|${String(owner.code || "").trim().toLocaleLowerCase("pt-BR")}`;
}

export function canViewMobileAgendaOwner(
  viewerProfileSlug: string,
  visibleOwnerKeys: ReadonlySet<string> | null,
  owner: MobileAgendaOwner
) {
  if (owner.active === false || !agendaOwnerRoles.has(owner.role) || !String(owner.code || "").trim()) {
    return false;
  }
  if (viewerProfileSlug !== "gerencia") return true;
  return visibleOwnerKeys?.has(mobileAgendaOwnerKey(owner)) === true;
}
