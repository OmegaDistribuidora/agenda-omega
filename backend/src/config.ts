import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";

for (const candidate of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "..", ".env"), path.resolve(process.cwd(), "backend", ".env")]) {
  if (fs.existsSync(candidate)) dotenv.config({ path: candidate, override: false });
}
const nodeEnv = process.env.NODE_ENV || "development";
const production = nodeEnv === "production";
const optional = (name: string) => String(process.env[name] || "").trim();
const list = (value: string) => value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
function secureValue(name: string, placeholder: string) {
  const value = optional(name);
  if (value && value !== placeholder) return value;
  if (production) throw new Error(`${name} deve ser definido com um valor seguro em producao.`);
  return crypto.randomBytes(32).toString("hex");
}

export const env = {
  port: Number(process.env.PORT || 3000), nodeEnv,
  jwtSecret: secureValue("JWT_SECRET", "change-me"), jwtExpiresIn: optional("JWT_EXPIRES_IN") || "8h",
  databaseUrl: optional("DATABASE_URL"),
  adminUsername: (optional("ADMIN_USERNAME") || "admin").toLowerCase(),
  adminPassword: production ? secureValue("ADMIN_PASSWORD", "Omega@123") : (optional("ADMIN_PASSWORD") || "Omega@123"),
  adminDisplayName: optional("ADMIN_DISPLAY_NAME") || "Administrador",
  uploadsDir: optional("UPLOADS_DIR") ? path.resolve(process.cwd(), optional("UPLOADS_DIR")) : path.resolve(__dirname, "..", "uploads"),
  ecosystemSso: {
    issuer: optional("ECOSYSTEM_SSO_ISSUER") || "ecosistema-omega",
    audience: optional("ECOSYSTEM_SSO_AUDIENCE") || "agenda-omega",
    sharedSecret: optional("ECOSYSTEM_SSO_SHARED_SECRET"),
    adminUsers: list(optional("ECOSYSTEM_SSO_ADMIN_USERS"))
  },
  gestaoVendas: {
    supabaseUrl: optional("GESTAO_VENDAS_SUPABASE_URL") || "https://ewkexlyywmvufbirmpot.supabase.co",
    supabasePublishableKey: optional("GESTAO_VENDAS_SUPABASE_PUBLISHABLE_KEY") || "sb_publishable_vQyCQEU5hh_HHMRAy798Ig_Pwfiox9U"
  }
};
