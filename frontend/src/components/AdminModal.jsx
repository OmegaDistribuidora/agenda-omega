import { useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { apiJson } from "../services/api";
import { Avatar, Modal } from "./ui";

const ROLE_LABELS = {
  USER: "Colaborador",
  SUPERVISOR: "Supervisor",
  COORDINATOR: "Coordenador",
  ADMIN: "Administrador"
};

export default function AdminModal({ data, token, currentUserId, onClose, onChanged, notify }) {
  const [tab, setTab] = useState("users");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [busy, setBusy] = useState(false);

  function userTeamIds(person) {
    return data.teams.filter((team) => team.members.some((member) => member.userId === person?.id)).map((team) => team.id);
  }

  function openNewForm() {
    if (showForm && !editingUser) {
      setShowForm(false);
      return;
    }
    setEditingUser(null);
    setShowForm(true);
  }

  function openEditForm(person) {
    setEditingUser(person);
    setShowForm(true);
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    setShowForm(false);
    setEditingUser(null);
  }

  async function submitUser(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const teamIds = data.teams.filter((team) => form.get(`team-${team.id}`)).map((team) => team.id);
    const payload = {
      username: form.get("username"),
      displayName: form.get("displayName"),
      code: form.get("code") || null,
      email: form.get("email") || null,
      role: form.get("role"),
      active: editingUser ? form.get("active") === "true" : true,
      teamIds
    };
    setBusy(true);
    try {
      if (editingUser) {
        await apiJson(`/admin/users/${editingUser.id}`, { token, method: "PATCH", data: payload });
        notify("Usuário atualizado");
      } else {
        await apiJson("/admin/users", { token, method: "POST", data: payload });
        notify("Usuário cadastrado para acesso via SSO");
      }
      setShowForm(false);
      setEditingUser(null);
      await onChanged();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitTeam(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await apiJson("/admin/teams", { token, method: "POST", data: { name: form.get("name"), description: form.get("description"), color: form.get("color") } });
      notify("Equipe criada");
      setShowForm(false);
      await onChanged();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(person) {
    if (person.id === currentUserId) {
      notify("Você não pode excluir a própria conta.", "error");
      return;
    }
    if (!confirm(`Excluir o usuário “${person.displayName}”? As atividades e registros históricos serão preservados.`)) return;
    setBusy(true);
    try {
      await apiJson(`/admin/users/${person.id}`, { token, method: "DELETE" });
      notify("Usuário excluído");
      await onChanged();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeam(team) {
    if (!confirm(`Excluir a equipe “${team.name}”? Todas as tarefas, pastas, anexos e históricos desta equipe serão apagados definitivamente.`)) return;
    setBusy(true);
    try {
      await apiJson(`/admin/teams/${team.id}`, { token, method: "DELETE" });
      notify("Equipe excluída");
      await onChanged();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return <Modal onClose={onClose} className="admin-modal">
    <header className="modal-header">
      <div><span className="admin-icon"><ShieldCheck /></span><div><h2>Administração</h2><p>Pessoas e equipes da Agenda Omega</p></div></div>
      <button onClick={onClose}><X /></button>
    </header>
    <div className="admin-layout">
      <nav>
        <button className={tab === "users" ? "active" : ""} onClick={() => changeTab("users")}><Users />Usuários <span>{data.users.length}</span></button>
        <button className={tab === "teams" ? "active" : ""} onClick={() => changeTab("teams")}><ShieldCheck />Equipes <span>{data.teams.length}</span></button>
      </nav>
      <main>
        <header>
          <div><h3>{tab === "users" ? "Usuários" : "Equipes"}</h3><p>{tab === "users" ? "Cadastre e mantenha os acessos do SSO." : "Organize colaboradores e atividades por área."}</p></div>
          <button className="primary" onClick={tab === "users" ? openNewForm : () => setShowForm((value) => !value)}><Plus />{tab === "users" ? "Novo usuário" : "Nova equipe"}</button>
        </header>

        {showForm && (tab === "users" ? <UserForm key={editingUser?.id || "new"} person={editingUser} teamIds={userTeamIds(editingUser)} teams={data.teams} busy={busy} currentUserId={currentUserId} onSubmit={submitUser} onCancel={() => { setShowForm(false); setEditingUser(null); }} /> : <form className="admin-form" onSubmit={submitTeam}>
          <div className="form-grid"><label>Nome da equipe<input name="name" required placeholder="Ex.: Marketing" /></label><label>Cor<input name="color" type="color" defaultValue="#3f7f75" /></label></div>
          <label>Descrição<textarea name="description" placeholder="Responsabilidades e contexto da equipe…" /></label>
          <button className="primary" disabled={busy}>{busy ? "Criando…" : "Criar equipe"}</button>
        </form>)}

        {tab === "users" ? <div className="admin-table">
          <div className="table-head"><span>Pessoa</span><span>Equipes</span><span>Perfil</span><span>Status</span><span /></div>
          {data.users.map((person) => <div className="table-row" key={person.id}>
            <span className="person-cell"><Avatar user={person} /><span><strong>{person.displayName}</strong><small>{person.code ? `Cód. ${person.code} · ` : ""}@{person.username}</small></span></span>
            <span>{data.teams.filter((team) => team.members.some((member) => member.userId === person.id)).map((team) => <i key={team.id} style={{ "--team": team.color }}>{team.name}</i>)}</span>
            <span>{ROLE_LABELS[person.role] || "Colaborador"}</span>
            <span className={person.active ? "active-pill" : "inactive-pill"}>{person.active ? "Ativo" : "Inativo"}</span>
            <span className="admin-actions"><button className="admin-edit" disabled={busy} onClick={() => openEditForm(person)} title="Editar usuário"><Pencil /></button><button className="admin-delete" disabled={busy || person.id === currentUserId} onClick={() => deleteUser(person)} title={person.id === currentUserId ? "Sua conta não pode ser excluída" : "Excluir usuário"}><Trash2 /></button></span>
          </div>)}
        </div> : <div className="team-grid">{data.teams.map((team) => <article key={team.id}><span className="team-color" style={{ background: team.color }} /><button className="admin-delete team-delete" disabled={busy} onClick={() => deleteTeam(team)} title="Excluir equipe"><Trash2 /></button><h4>{team.name}</h4><p>{team.description || "Sem descrição"}</p><div className="team-people">{team.members.slice(0, 5).map((member) => <Avatar key={member.userId} user={member.user} size="sm" />)}<span>{team.members.length} {team.members.length === 1 ? "pessoa" : "pessoas"}</span></div></article>)}</div>}
      </main>
    </div>
  </Modal>;
}

function UserForm({ person, teamIds, teams, busy, currentUserId, onSubmit, onCancel }) {
  return <form className="admin-form user-edit-form" onSubmit={onSubmit}>
    <div className="admin-form-title"><div><strong>{person ? "Editar usuário" : "Novo usuário"}</strong><span>{person ? "Atualize os dados e permissões do acesso." : "O login deve ser igual ao utilizado no Ecossistema."}</span></div><button type="button" onClick={onCancel}><X /></button></div>
    <div className="form-grid">
      <label>Nome completo<input name="displayName" required defaultValue={person?.displayName || ""} placeholder="Ex.: João Martins" /></label>
      <label>Login do Ecossistema<input name="username" required defaultValue={person?.username || ""} placeholder="joao.martins" /></label>
      <label>Código (opcional)<input name="code" maxLength="40" defaultValue={person?.code || ""} placeholder="Ex.: 00127" /></label>
      <label>E-mail<input name="email" type="email" defaultValue={person?.email || ""} placeholder="joao@empresa.com.br" /></label>
      <label>Perfil<select name="role" required defaultValue={person?.role || "USER"} disabled={person?.id === currentUserId}><option value="USER">Colaborador</option><option value="SUPERVISOR">Supervisor</option><option value="COORDINATOR">Coordenador</option><option value="ADMIN">Administrador</option></select>{person?.id === currentUserId && <input type="hidden" name="role" value="ADMIN" />}</label>
      {person && <label>Status<select name="active" defaultValue={String(person.active)} disabled={person.id === currentUserId}><option value="true">Ativo</option><option value="false">Inativo</option></select>{person.id === currentUserId && <input type="hidden" name="active" value="true" />}</label>}
    </div>
    <fieldset><legend>Equipes</legend>{teams.map((team) => <label className="check-team" key={team.id}><input type="checkbox" name={`team-${team.id}`} defaultChecked={teamIds.includes(team.id)} /><span style={{ "--team": team.color }}>{team.name}</span></label>)}</fieldset>
    <button className="primary" disabled={busy}>{busy ? "Salvando…" : person ? "Salvar alterações" : "Cadastrar usuário"}</button>
  </form>;
}
