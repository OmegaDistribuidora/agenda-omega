const API_BASE = "/api";
let unauthorizedHandler = null;
export class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
async function request(path, { token, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${API_BASE}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body });
  const isJson = (response.headers.get("content-type") || "").includes("application/json"); const payload = isJson ? await response.json() : null;
  if (!response.ok) { if (response.status === 401) unauthorizedHandler?.(); throw new ApiError(payload?.message || "Não foi possível completar a ação.", response.status); }
  return payload;
}
export function apiJson(path, { token, method = "GET", data } = {}) { return request(path, { token, method, headers: data === undefined ? {} : { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) }); }
export function apiUpload(path, { token, file }) { const body = new FormData(); body.append("file", file); return request(path, { token, method: "POST", body }); }
export async function apiBlob(path, { token }) { const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } }); if(!response.ok){const payload=await response.json().catch(()=>null);throw new ApiError(payload?.message||"Não foi possível carregar o arquivo.",response.status);} return response.blob(); }
export async function apiDownload(path, { token, filename }) { const url=URL.createObjectURL(await apiBlob(path,{token}));const link=document.createElement("a");link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export function setUnauthorizedHandler(handler) { unauthorizedHandler = handler; }
