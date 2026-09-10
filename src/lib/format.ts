export function kes(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  return `KES ${n.toLocaleString("en-KE")}`;
}

export function fmtDate(value: string | Date | null | undefined, withTime = false) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function fmtTime(value: number | string | Date | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleTimeString("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeLeft(expiresAt: string, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

/** Normalise Kenyan phone numbers to 2547XXXXXXXX / 2541XXXXXXXX. Returns null when invalid. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let n = digits;
  if (n.startsWith("0")) n = "254" + n.slice(1);
  else if (n.startsWith("7") || n.startsWith("1")) n = "254" + n;
  else if (n.startsWith("254")) n = n;
  else return null;
  return /^254(7|1)\d{8}$/.test(n) ? n : null;
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  return phone.replace(/^(\d{6})\d{3}(\d{3})$/, "$1***$2");
}
