import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { comparePassword, hashPassword, signToken } from "./security";
import { env } from "../config";

test("senhas são armazenadas com hash e comparadas corretamente", async () => {
  const hash = await hashPassword("segredo-forte");
  assert.notEqual(hash, "segredo-forte");
  assert.equal(await comparePassword("segredo-forte", hash), true);
  assert.equal(await comparePassword("incorreta", hash), false);
});

test("sessão local contém identidade e perfil", () => {
  const token = signToken({ userId: 42, username: "joao", role: "USER" });
  const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  assert.equal(payload.userId, 42);
  assert.equal(payload.username, "joao");
  assert.equal(payload.role, "USER");
  assert.ok(payload.exp);
});
