import { CalendarOff, CheckCircle2, CircleDashed, Clock3, Gauge, TriangleAlert, UserRound } from "lucide-react";
import { buildUserAnalytics, completionBuckets, tasksForUserPeriod } from "../lib/taskUtils";
import { Avatar, EmptyState, PriorityPip } from "./ui";

const ROLE_LABELS = { USER: "Colaborador", SUPERVISOR: "Supervisor", COORDINATOR: "Coordenador", ADMIN: "Administrador" };
const STATUS_LABELS = { TODO: "A fazer", IN_PROGRESS: "Em andamento", DONE: "Concluída" };
const PRIORITY_WEIGHT = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function percent(value, total) {
  return total ? Math.round(value / total * 100) : 0;
}

function dueText(value) {
  if (!value) return "Sem prazo";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function attentionScore(task) {
  const overdue = task.dueAt && new Date(task.dueAt) < new Date().setHours(0, 0, 0, 0) ? 100 : 0;
  const active = task.status === "IN_PROGRESS" ? 10 : 0;
  return overdue + active + (PRIORITY_WEIGHT[task.priority] || 0);
}

export default function UserAnalytics({ team, tasks, start, end, period, selectedUserId, onSelectUser, onOpenTask }) {
  const members = (team?.members || []).map((member) => member.user).sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
  const selectedUser = members.find((person) => person.id === selectedUserId) || members[0];
  if (!selectedUser) return <EmptyState icon={<UserRound />} title="Equipe sem usuários" text="Adicione colaboradores à equipe para visualizar a análise individual." />;

  const userTasks = tasksForUserPeriod(tasks, team.id, selectedUser.id, start, end);
  const summary = buildUserAnalytics(userTasks, start, end);
  const memberSummaries = members.map((person) => buildUserAnalytics(tasksForUserPeriod(tasks, team.id, person.id, start, end), start, end)).filter((item) => item.total > 0);
  const teamAverage = memberSummaries.length ? Math.round(memberSummaries.reduce((sum, item) => sum + item.completionRate, 0) / memberSummaries.length) : 0;
  const comparison = summary.completionRate - teamAverage;
  const buckets = completionBuckets(userTasks, start, end, period);
  const bucketMax = Math.max(...buckets.map((bucket) => bucket.value), 1);
  const withoutDueRate = percent(summary.withoutDueDate, summary.total);
  const highPriorityRate = percent(summary.highPriorityOpen, summary.total);
  const attention = [...userTasks].filter((task) => task.status !== "DONE").sort((a, b) => attentionScore(b) - attentionScore(a) || new Date(a.dueAt || "2999-01-01") - new Date(b.dueAt || "2999-01-01")).slice(0, 6);
  const doneRate = percent(summary.done, summary.total);
  const progressRate = percent(summary.inProgress, summary.total);
  const cards = [
    { label: "Total no período", value: summary.total, note: `${summary.withoutDueDate} sem prazo`, tone: "ink", icon: <Gauge /> },
    { label: "A fazer", value: summary.todo, note: `${percent(summary.todo, summary.total)}% da carteira`, tone: "todo", icon: <CircleDashed /> },
    { label: "Em andamento", value: summary.inProgress, note: `${percent(summary.inProgress, summary.total)}% da carteira`, tone: "progress", icon: <Clock3 /> },
    { label: "Concluídas", value: summary.done, note: `${summary.completedInPeriod} concluídas neste intervalo`, tone: "done", icon: <CheckCircle2 /> },
    { label: "Atrasadas", value: summary.overdue, note: summary.overdue ? "pedem atenção agora" : "nenhum prazo vencido", tone: "late", icon: <TriangleAlert /> }
  ];

  return <div className="user-analytics">
    <section className="analytics-person">
      <div className="analytics-person-main"><Avatar user={selectedUser} /><div><span className="analytics-kicker">Leitura individual</span><h2>{selectedUser.displayName}</h2><p>{ROLE_LABELS[selectedUser.role] || "Colaborador"}{selectedUser.code ? ` · Código ${selectedUser.code}` : ""} · {team.name}</p></div></div>
      <div className="analytics-comparison"><span>Taxa de conclusão</span><strong>{summary.completionRate}%</strong><small className={comparison > 0 ? "positive" : comparison < 0 ? "negative" : ""}>{comparison > 0 ? "+" : ""}{comparison} p.p. vs. média da equipe</small></div>
      <label className="analytics-user-select"><span>Visualizar usuário</span><select value={selectedUser.id} onChange={(event) => onSelectUser(Number(event.target.value))}>{members.map((person) => <option value={person.id} key={person.id}>{person.displayName}{person.code ? ` · ${person.code}` : ""}</option>)}</select></label>
    </section>

    <section className="analytics-cards">{cards.map((card) => <article className={`analytics-card tone-${card.tone}`} key={card.label}><div><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></div><i>{card.icon}</i></article>)}</section>

    <div className="analytics-grid">
      <section className="analytics-panel status-panel">
        <header><div><span className="panel-kicker">Composição</span><h3>Distribuição por status</h3></div><small>{summary.total} atividades</small></header>
        <div className="status-chart-wrap">
          <div className="status-donut" style={{ background: summary.total ? `conic-gradient(var(--green) 0 ${doneRate}%, var(--yellow) ${doneRate}% ${doneRate + progressRate}%, var(--orange) ${doneRate + progressRate}% 100%)` : "#e5e3dc" }}><div><strong>{summary.completionRate}%</strong><span>conclusão</span></div></div>
          <div className="status-legend"><span className="legend-done"><i />Concluídas <strong>{summary.done}</strong></span><span className="legend-progress"><i />Em andamento <strong>{summary.inProgress}</strong></span><span className="legend-todo"><i />A fazer <strong>{summary.todo}</strong></span></div>
        </div>
      </section>

      <section className="analytics-panel rhythm-panel">
        <header><div><span className="panel-kicker">Ritmo</span><h3>Conclusões no intervalo</h3></div><small>{summary.completedInPeriod} entregas</small></header>
        <div className="rhythm-chart">{buckets.map((bucket) => <div className="rhythm-column" key={bucket.label}><strong>{bucket.value || ""}</strong><div><i style={{ height: bucket.value ? `${Math.max(12, bucket.value / bucketMax * 100)}%` : "3px" }} /></div><span>{bucket.label}</span></div>)}</div>
        <p className="chart-note">Conta a data em que a atividade foi marcada como concluída.</p>
      </section>

      <section className="analytics-panel indicator-panel">
        <header><div><span className="panel-kicker">Qualidade da carteira</span><h3>Indicadores</h3></div></header>
        <MetricBar label="Taxa de conclusão" detail="Concluídas sobre o total" value={summary.completionRate} tone="green" />
        <MetricBar label="Prazo cumprido" detail="Concluídas até o vencimento" value={summary.onTimeRate} tone="blue" />
        <MetricBar label="Sem prazo definido" detail={`${summary.withoutDueDate} atividades consideradas`} value={withoutDueRate} tone="yellow" />
        <MetricBar label="Alta prioridade aberta" detail={`${summary.highPriorityOpen} entre altas e urgentes`} value={highPriorityRate} tone="orange" />
      </section>

      <section className="analytics-panel attention-panel">
        <header><div><span className="panel-kicker">Radar</span><h3>Atividades que pedem atenção</h3></div><small>{attention.length} exibidas</small></header>
        {attention.length ? <div className="attention-list">{attention.map((task) => {
          const late = task.dueAt && new Date(task.dueAt) < new Date().setHours(0, 0, 0, 0);
          return <button key={task.id} onClick={() => onOpenTask(task)}><PriorityPip priority={task.priority} /><span><strong>{task.title}</strong><small><i className={`status-dot status-${task.status.toLowerCase()}`} />{STATUS_LABELS[task.status]}</small></span><time className={late ? "late" : ""}>{late ? "Atrasada · " : ""}{dueText(task.dueAt)}</time></button>;
        })}</div> : <div className="attention-empty"><CheckCircle2 /><strong>Nada exigindo atenção</strong><span>As atividades abertas deste período estão em dia.</span></div>}
      </section>
    </div>

    <footer className="analytics-footnote"><CalendarOff />Atividades sem prazo entram em todos os períodos. Os indicadores consideram apenas atribuições desta equipe.</footer>
  </div>;
}

function MetricBar({ label, detail, value, tone }) {
  const available = value !== null;
  return <div className="metric-bar"><div><span>{label}</span><small>{detail}</small></div><strong>{available ? `${value}%` : "Sem base"}</strong><div className="metric-track"><i className={`metric-${tone}`} style={{ width: `${available ? value : 0}%` }} /></div></div>;
}
