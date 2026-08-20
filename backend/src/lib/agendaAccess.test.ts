import assert from "node:assert/strict";
import test from "node:test";
import { agendaRegionForCoordinator, isRestrictedAgendaRole } from "./agendaAccess";

test("mapeia os coordenadores para as pastas regionais oficiais", () => {
  assert.equal(agendaRegionForCoordinator("12"), "Capital");
  assert.equal(agendaRegionForCoordinator("13"), "Cariri");
  assert.equal(agendaRegionForCoordinator("10"), "Interior");
  assert.equal(agendaRegionForCoordinator("99"), null);
});

test("restringe somente supervisores e coordenadores", () => {
  assert.equal(isRestrictedAgendaRole("SUPERVISOR"), true);
  assert.equal(isRestrictedAgendaRole("COORDINATOR"), true);
  assert.equal(isRestrictedAgendaRole("ADMIN"), false);
  assert.equal(isRestrictedAgendaRole("USER"), false);
});
