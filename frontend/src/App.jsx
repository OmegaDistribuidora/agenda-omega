import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./components/AuthProvider";
import LoginPage from "./pages/LoginPage";
import WorkspacePage from "./pages/WorkspacePage";

function Protected() { const auth = useAuth(); if (auth.loading) return <div className="splash"><div className="omega-mark">Ω</div><p>Organizando sua agenda…</p></div>; return auth.isAuthenticated ? <WorkspacePage /> : <Navigate to="/login" replace />; }
export default function App() { const [online, setOnline] = useState(navigator.onLine); useEffect(() => { const on = () => setOnline(navigator.onLine); addEventListener("online", on); addEventListener("offline", on); return () => { removeEventListener("online", on); removeEventListener("offline", on); }; }, []); return <><Routes><Route path="/login" element={<LoginPage />} /><Route path="/*" element={<Protected />} /></Routes>{!online && <div className="offline">Você está offline — alterações estão pausadas.</div>}</>; }
