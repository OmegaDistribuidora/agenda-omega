import { CheckCircle2, ChevronDown, ExternalLink, MapPin, Users } from "lucide-react";
import { isCompletedInPeriod, teamCompletionGroups } from "../lib/taskUtils";
import { Avatar } from "./ui";
import AttachmentCard from "./AttachmentCard";

export default function TeamAnalytics({ team, tasks, start, end, token, notify, onOpenTask }) {
  if (!team) return null;
  const completed = tasks.filter(task => task.teamId === team.id && isCompletedInPeriod(task, start, end));
  const groups = teamCompletionGroups(team, tasks, start, end);
  const unassigned = completed.filter(task => !task.assignees.length);
  return <div className="team-analytics">
    <section className="team-analysis-summary"><div><span className="eyebrow">Entregas da equipe</span><h2>{team.name}</h2><p>Conclusões na semana ou mês selecionado, independentemente do prazo.</p></div><div><CheckCircle2 /><strong>{completed.length}</strong><span>atividades concluídas</span></div><div><Users /><strong>{groups.filter(group => group.tasks.length).length}</strong><span>pessoas com entregas</span></div></section>
    <p className="team-analysis-note">Expanda uma pessoa para ver suas entregas, anexos e localização. Atividades compartilhadas aparecem em cada responsável e contam uma vez no total da equipe.</p>
    <div className="team-member-grid">{groups.map(({ user, tasks: deliveries }) => <details className="team-member-card" key={`${team.id}-${user.id}-${start.toISOString()}`}><summary><Avatar user={user} /><span><strong>{user.displayName}</strong><small>{deliveries.length} {deliveries.length === 1 ? "atividade concluída" : "atividades concluídas"}</small></span><ChevronDown /></summary><DeliveryList tasks={deliveries} token={token} notify={notify} onOpenTask={onOpenTask} /></details>)}</div>
    {!completed.length && <p className="team-analysis-note">Nenhuma atividade concluída neste período.</p>}
    {unassigned.length > 0 && <details className="team-member-card"><summary><span><strong>Sem responsável</strong><small>{unassigned.length} atividades concluídas</small></span><ChevronDown /></summary><DeliveryList tasks={unassigned} token={token} notify={notify} onOpenTask={onOpenTask} /></details>}
  </div>;
}

function DeliveryList({ tasks, token, notify, onOpenTask }) {
  return <div className="team-deliveries">{!tasks.length && <p>Sem conclusões neste período.</p>}{tasks.map(task => <article className="team-delivery" key={task.id}><header><button onClick={() => onOpenTask(task)}>{task.title}<ExternalLink /></button><time>{new Date(task.completedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time></header>{task.description && <p>{task.description}</p>}{task.completionLocationShared && Number.isFinite(task.completionLatitude) && Number.isFinite(task.completionLongitude) && <a className="delivery-location" href={`https://www.google.com/maps?q=${task.completionLatitude},${task.completionLongitude}`} target="_blank" rel="noreferrer"><MapPin />{task.completionAddress || `${task.completionLatitude.toFixed(6)}, ${task.completionLongitude.toFixed(6)}`}<ExternalLink /></a>}<div className="delivery-attachments">{task.attachments.map(file => <AttachmentCard large key={file.id} file={file} token={token} notify={notify} />)}</div></article>)}</div>;
}
