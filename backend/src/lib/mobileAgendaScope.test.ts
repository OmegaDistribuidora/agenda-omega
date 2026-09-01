import assert from "node:assert/strict";
import test from "node:test";
import { canViewMobileAgendaOwner, mobileAgendaOwnerKey } from "./mobileAgendaScope";

const managementKeys = new Set([
  "COORDINATOR|10",
  "SUPERVISOR|20"
]);

test("gerencia enxerga somente os responsaveis liberados pelo Supabase", () => {
  assert.equal(canViewMobileAgendaOwner("gerencia", managementKeys, {
    active: true,
    role: "COORDINATOR",
    code: "10"
  }), true);
  assert.equal(canViewMobileAgendaOwner("gerencia", managementKeys, {
    active: true,
    role: "SUPERVISOR",
    code: "20"
  }), true);
  assert.equal(canViewMobileAgendaOwner("gerencia", managementKeys, {
    active: true,
    role: "COORDINATOR",
    code: "7"
  }), false);
});

test("diretoria e outros continuam visualizando toda a agenda comercial", () => {
  for (const profileSlug of ["diretoria", "outros"]) {
    assert.equal(canViewMobileAgendaOwner(profileSlug, null, {
      active: true,
      role: "COORDINATOR",
      code: "7"
    }), true);
  }
});

test("responsavel inativo ou sem papel comercial nunca fica visivel", () => {
  assert.equal(canViewMobileAgendaOwner("diretoria", null, {
    active: false,
    role: "COORDINATOR",
    code: "10"
  }), false);
  assert.equal(canViewMobileAgendaOwner("outros", null, {
    active: true,
    role: "USER",
    code: "10"
  }), false);
  assert.equal(mobileAgendaOwnerKey({ role: "SUPERVISOR", code: " 20 " }), "SUPERVISOR|20");
});
