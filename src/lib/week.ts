/** Start of the current week (Monday 00:00 Africa/Nairobi, UTC+3) as an ISO timestamp. */
export function nairobiWeekStartISO(now: Date = new Date()): string {
  const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + NAIROBI_OFFSET_MS);
  const dow = local.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7;
  const startLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
    0,
  );
  return new Date(startLocal - NAIROBI_OFFSET_MS).toISOString();
}

/** Human label like "Mon 8 Sep – today" for the running week. */
export function weekLabel(startISO: string): string {
  const d = new Date(startISO);
  return `${d.toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", weekday: "short", day: "numeric", month: "short" })} – today`;
}
