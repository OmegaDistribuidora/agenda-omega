import { test, expect } from "@playwright/test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-06T12:00:00-03:00") });
  const user = { id: 1, displayName: "Ana", username: "ana", role: "ADMIN", active: true, teams: [] };
  const bob = { id: 2, displayName: "Bruno", role: "USER", active: true };
  const team = { id: 10, name: "Comercial", color: "#3f7f75", members: [user,bob].map(user=>({ userId:user.id, user })) };
  const base = { description: "", priority: "MEDIUM", teamId: 10, team, folderId: null, subtasks: [], tags: [], attachments: [], comments: [], activity: [], creator: user, createdAt: "2026-09-01", assignees: [{ user }] };
  const tasks = [
    { ...base, id:1, title:"Pendente antiga", status:"TODO", dueAt:"2026-08-01" },
    { ...base, id:2, title:"Entrega de outubro", status:"DONE", dueAt:"2026-08-01", completedAt:"2026-10-06T13:00:00Z", completionLocationShared:true, completionLatitude:-3.7, completionLongitude:-38.5, attachments:[{ id:1, originalName:"foto.png", mimeType:"image/png", size:png.length }] },
    { ...base, id:3, title:"Entrega antiga sem prazo", status:"DONE", dueAt:null, completedAt:"2026-09-01T13:00:00Z" }
  ];
  await page.addInitScript(user => localStorage.setItem("agenda-omega-auth", JSON.stringify({ token:"test", user })), user);
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if(path==="/api/auth/me") return route.fulfill({ json:{ user } });
    if(path==="/api/bootstrap") return route.fulfill({ json:{ users:[user,bob], teams:[team], tasks, folders:[], tags:[] } });
    if(path.endsWith("/download")) return route.fulfill({ contentType:"image/png", body:png });
    if(path==="/api/tasks" && route.request().method()==="POST") {
      const task = { ...base, ...route.request().postDataJSON(), id:4, status:"TODO", assignees:[{ user }] }; tasks.push(task); return route.fulfill({ status:201, json:task });
    }
    const taskId = Number(path.split("/")[3]); const task=tasks.find(task=>task.id===taskId);
    if(path.endsWith("/attachments")) {
      const attachment={ id:task.attachments.length+10, originalName:"print.png", mimeType:"image/png", size:png.length };
      task.attachments.push(attachment); return route.fulfill({ status:201, json:attachment });
    }
    if(task) return route.fulfill({ json:task });
    return route.fulfill({ status:404, json:{ message:"Mock não encontrado" } });
  });
  await page.goto("/");
});

test("abertas permanecem e concluídas seguem a conclusão; análise apresenta entregas e evidências", async ({ page }) => {
  await expect(page.getByText("Pendente antiga", { exact:true })).toBeVisible();
  await expect(page.getByText("Entrega de outubro", { exact:true })).toBeVisible();
  await expect(page.getByText("Entrega antiga sem prazo", { exact:true })).toHaveCount(0);
  await page.getByRole("button", { name:"Comercial", exact:false }).first().click();
  await page.getByRole("button", { name:"Por usuário", exact:true }).click();
  await expect(page.locator(".analytics-user-select option")).toHaveText(["Ana"]);
  await page.getByRole("button", { name:"Ver análise da equipe" }).click();
  await page.locator("summary").filter({ hasText:"Ana" }).click();
  await expect(page.locator(".team-delivery")).toHaveCount(1);
  await expect(page.locator(".delivery-location")).toBeVisible();
  await expect(page.locator(".attachment-large img")).toBeVisible();
  await expect(page.locator("summary").filter({ hasText:"Bruno" })).toContainText("0 atividades");
  await page.screenshot({ path:"test-results/team-analysis.png", fullPage:true });
  const popupPromise = page.waitForEvent("popup");
  await page.locator(".attachment-large").click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toContain("blob:");
});

async function copyPrint(page) {
  await page.evaluate(async () => {
    const canvas=document.createElement("canvas"); canvas.width=80; canvas.height=60;
    canvas.getContext("2d").fillRect(0,0,80,60);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png":blob })]);
  });
}

test("Ctrl+V anexa um print em atividade existente", async ({ page }) => {
  await page.getByText("Pendente antiga", { exact:true }).click();
  await copyPrint(page);
  await page.getByRole("textbox", { name:"Cole uma imagem aqui com Ctrl+V" }).click();
  await page.keyboard.press("Control+v");
  await expect(page.locator(".attachment-card img")).toBeVisible();
});

test("print colado antes de criar é enviado ao salvar", async ({ page }) => {
  await page.getByRole("button", { name:"Nova atividade" }).click();
  await page.getByPlaceholder("O que precisa ser feito?").fill("Nova com print");
  await copyPrint(page);
  await page.getByRole("textbox", { name:"Cole uma imagem aqui com Ctrl+V" }).click();
  await page.keyboard.press("Control+v");
  await expect(page.locator(".pending-attachments")).toContainText("aguardando salvar");
  await page.getByRole("button", { name:"Criar atividade", exact:true }).click();
  await expect(page.locator(".attachment-card img")).toBeVisible();
  await expect(page.locator(".pending-attachments")).toHaveCount(0);
});

test("análise da equipe funciona em tela pequena", async ({ page }) => {
  await page.setViewportSize({ width:390,height:844 });
  await page.locator(".mobile-menu").click();
  await page.getByRole("button", { name:"Comercial", exact:false }).first().click();
  await page.getByRole("button", { name:"Ver análise da equipe" }).click();
  await page.locator("summary").filter({ hasText:"Ana" }).click();
  await expect(page.locator(".delivery-location")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({ path:"test-results/team-analysis-mobile.png",fullPage:true });
});
