import test from "node:test";
import assert from "node:assert/strict";
import { inputDate, todayDueAtIso, todayInputDate, toDueAtIso } from "../src/lib/taskDates.js";

test("nova atividade recebe a data local de hoje como prazo inicial", () => {
  const now = new Date(2026, 8, 1, 9, 30, 0);
  assert.equal(todayInputDate(now), "2026-09-01");
  assert.equal(inputDate(now), "2026-09-01");
});

test("prazo padrao e enviado no mesmo formato usado pelo formulario", () => {
  const now = new Date(2026, 8, 1, 9, 30, 0);
  assert.equal(todayDueAtIso(now), toDueAtIso("2026-09-01"));
  assert.equal(toDueAtIso(""), null);
});
