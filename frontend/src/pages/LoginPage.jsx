import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useAuth } from "../components/AuthProvider";
export default function LoginPage() {
  const { login, isAuthenticated, ssoError } = useAuth(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (isAuthenticated) return <Navigate to="/" replace />;
  async function submit(e) { e.preventDefault(); setBusy(true); setError(""); try { await login(username, password); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <main className="login-page">
    <section className="login-story"><div className="brand-lockup"><span className="brand-symbol">Ω</span><span>Agenda Omega</span></div><div className="story-copy"><span className="eyebrow"><Sparkles size={14}/> Espaço de trabalho</span><h1>Menos ruído.<br/><em>Mais ritmo.</em></h1><p>O lugar onde as prioridades da equipe ganham clareza, responsáveis e movimento.</p></div><div className="login-quote"><span>HOJE</span><p>“O que importa está visível. O que está visível, acontece.”</p></div></section>
    <section className="login-panel"><form className="login-form" onSubmit={submit}><div className="form-icon"><LockKeyhole size={22}/></div><h2>Bem-vindo de volta</h2><p>Entre pelo Ecossistema Omega ou use o acesso local de desenvolvimento.</p><label>Usuário<input autoFocus value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="seu.usuario" /></label><label>Senha<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" /></label>{(error || ssoError) && <div className="form-error">{error || ssoError}</div>}<button className="login-button" disabled={busy}>{busy ? "Entrando…" : <>Entrar na Agenda <ArrowRight size={18}/></>}</button><small>Em produção, o acesso acontece automaticamente pelo SSO.</small></form></section>
  </main>;
}
