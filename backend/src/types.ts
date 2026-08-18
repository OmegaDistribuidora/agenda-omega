export type AppUserRole = "ADMIN" | "USER" | "SUPERVISOR" | "COORDINATOR";
export type AuthUser = { userId: number; username: string; role: AppUserRole; iat?: number; exp?: number };
