export function formatTime12h(time24?: string) {
  const value = String(time24 || "");
  const parts = value.split(":");
  if (parts.length < 2) return value || "—";
  const hh = Number(parts[0]);
  const mm = parts[1];
  if (!Number.isFinite(hh)) return value || "—";
  const hour = ((hh + 11) % 12) + 1;
  const suffix = hh >= 12 ? "PM" : "AM";
  return `${hour}:${mm} ${suffix}`;
}
