/**
 * Normalize a Supabase `DATABASE_URL` for serverless (Vercel) — QIN-24.
 *
 * Supabase's DIRECT host `db.<ref>.supabase.co` is IPv6-only since their IPv4
 * deprecation, so IPv4-only platforms (Vercel) get `ENOTFOUND`. Rewrite it to
 * the Supavisor POOLER host (IPv4-compatible, transaction mode `:6543`), whose
 * username must be tenant-qualified (`postgres.<ref>`). If the URL is already a
 * pooler/other host, it's returned unchanged. Pooler host defaults to this
 * project's region and is overridable via `SUPABASE_POOLER_HOST`.
 */
export function resolveDatabaseUrl(raw: string): string {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const m = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname);
    if (!m) return raw; // already pooler (or non-Supabase) — leave as-is
    const ref = m[1];
    u.hostname = process.env.SUPABASE_POOLER_HOST || "aws-1-us-east-2.pooler.supabase.com";
    u.port = "6543";
    if (u.username === "postgres") u.username = `postgres.${ref}`;
    return u.toString();
  } catch {
    return raw;
  }
}
