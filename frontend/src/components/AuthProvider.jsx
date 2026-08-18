import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiJson, setUnauthorizedHandler } from "../services/api";
const STORAGE_KEY = "agenda-omega-auth"; const AuthContext = createContext(null);
function stored() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function ssoToken() { try { return new URLSearchParams(location.hash.replace(/^#/, "")).get("sso"); } catch { return null; } }
export function AuthProvider({ children }) {
  const initial = stored(); const pendingSso = ssoToken(); const [token, setToken] = useState(pendingSso ? null : initial.token || null); const [user, setUser] = useState(pendingSso ? null : initial.user || null); const [loading, setLoading] = useState(Boolean(pendingSso || initial.token)); const [ssoError, setSsoError] = useState("");
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user })); }, [token, user]);
  useEffect(() => { setUnauthorizedHandler(() => { setToken(null); setUser(null); }); return () => setUnauthorizedHandler(null); }, []);
  useEffect(() => {
    const value = ssoToken(); let alive = true;
    if (value) apiJson("/auth/sso/exchange", { method: "POST", data: { token: value } }).then((result) => { if (alive) { setToken(result.token); setUser(result.user); } }).catch((error) => { if (alive) setSsoError(error.message); }).finally(() => { history.replaceState(null, "", `${location.pathname}${location.search}`); if (alive) setLoading(false); });
    else if (token) apiJson("/auth/me", { token }).then((result) => { if (alive) setUser(result.user); }).catch(() => { if (alive) { setToken(null); setUser(null); } }).finally(() => { if (alive) setLoading(false); });
    else setLoading(false); return () => { alive = false; };
  }, []);
  const value = useMemo(() => ({ token, user, loading, ssoError, isAuthenticated: Boolean(token && user), async login(username, password) { const result = await apiJson("/auth/login", { method: "POST", data: { username, password } }); setToken(result.token); setUser(result.user); }, logout() { setToken(null); setUser(null); setSsoError(""); } }), [token, user, loading, ssoError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider ausente"); return value; }
