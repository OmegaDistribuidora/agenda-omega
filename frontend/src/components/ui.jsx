export function Avatar({ user, size = "md", title }) {
  const initials = String(user?.displayName || "?").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className={`avatar avatar-${size}`} title={title || user?.displayName} style={{ "--avatar": user?.avatarColor || "#718096" }}>{initials}</span>;
}
export function AvatarStack({ assignees = [], limit = 3 }) { return <div className="avatar-stack">{assignees.slice(0, limit).map(({ user }) => <Avatar key={user.id} user={user} size="sm"/>)}{assignees.length > limit && <span className="avatar avatar-sm more">+{assignees.length-limit}</span>}</div>; }
export function PriorityPip({ priority, withLabel = false }) { const names={LOW:"Baixa",MEDIUM:"Média",HIGH:"Alta",URGENT:"Urgente"}; return <span className={`priority priority-${priority.toLowerCase()}`} title={`Prioridade ${names[priority]}`}>{withLabel && names[priority]}</span>; }
export function StatusButton({ status, onClick }) { const labels={TODO:"Iniciar",IN_PROGRESS:"Concluir",DONE:"Reabrir"}; return <button className={`status-check status-${status.toLowerCase()}`} onClick={(e)=>{e.stopPropagation();onClick?.();}} title={labels[status]} aria-label={labels[status]}><span>{status === "DONE" ? "✓" : status === "IN_PROGRESS" ? "–" : ""}</span></button>; }
export function EmptyState({ icon, title, text }) { return <div className="empty-state">{icon}<h3>{title}</h3><p>{text}</p></div>; }
export function Toast({ toast, onClose }) { if(!toast) return null; return <button className={`toast ${toast.type || "ok"}`} onClick={onClose}>{toast.message}<span>×</span></button>; }
export function Modal({ children, onClose, className="", ...props }) { return <div className="modal-backdrop" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}><section className={`modal ${className}`} {...props}>{children}</section></div>; }
