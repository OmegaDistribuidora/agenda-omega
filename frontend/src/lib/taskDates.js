export function inputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayInputDate(now = new Date()) {
  return inputDate(now);
}

export function toDueAtIso(value) {
  return value ? new Date(`${value}T18:00:00`).toISOString() : null;
}

export function todayDueAtIso(now = new Date()) {
  return toDueAtIso(todayInputDate(now));
}
