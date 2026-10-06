export type AppUserRole = "ADMIN" | "USER" | "SUPERVISOR" | "COORDINATOR";
export type AuthUser = { userId: number; username: string; role: AppUserRole; sessionVersion?: number; iat?: number; exp?: number };
