import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY go-live diagnostic (QIN-24). Reports prod config *presence* and
 * `DATABASE_URL` *structure* — NEVER any secret values, passwords, hosts beyond
 * a coarse suffix, or PII. Purpose: pinpoint why /api/auth/signup 500s in prod
 * without needing Vercel log access. REMOVE once go-live is verified.
 *
 * Optional `?ping=1` attempts a single `select 1` and returns only the Postgres
 * error *code* (e.g. 28P01 = invalid_password) — no connection string.
 */
function present(v: string | undefined): boolean {
  return typeof v === "string" && v.length > 0;
}

export async function GET(req: Request) {
  const env = {
    DATABASE_URL: present(process.env.DATABASE_URL),
    AUTH_SESSION_SECRET: present(process.env.AUTH_SESSION_SECRET),
    TOKEN_ENCRYPTION_KEY: present(process.env.TOKEN_ENCRYPTION_KEY),
    STRIPE_SECRET_KEY: present(process.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: present(process.env.STRIPE_WEBHOOK_SECRET),
    STRIPE_PRICE_STARTER: present(process.env.STRIPE_PRICE_STARTER),
    STRIPE_PRICE_TEAM: present(process.env.STRIPE_PRICE_TEAM),
    STRIPE_PRICE_SCALE: present(process.env.STRIPE_PRICE_SCALE),
    SLACK_CLIENT_ID: present(process.env.SLACK_CLIENT_ID),
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  };

  // DATABASE_URL structure (no secrets). The #1 rotation bug is an unencoded
  // special char in the password — detectable via extra '@' in the authority.
  let db: Record<string, unknown> = { present: false };
  const raw = process.env.DATABASE_URL;
  if (raw) {
    const afterScheme = raw.split("://")[1] ?? "";
    const authority = afterScheme.split("/")[0] ?? "";
    const atCount = (authority.match(/@/g) ?? []).length;
    const userinfo = authority.slice(0, authority.lastIndexOf("@"));
    let hostSuffix: string | null = null;
    let port: string | null = null;
    try {
      const u = new URL(raw);
      hostSuffix = u.hostname.split(".").slice(-2).join(".");
      port = u.port || null;
    } catch {
      /* malformed — likely the bug */
    }
    db = {
      present: true,
      protocol: raw.split("://")[0],
      authorityAtCount: atCount, // >1 ⇒ unencoded '@' in password
      userinfoHasSpace: /\s/.test(userinfo),
      userinfoHasRawSpecial: /[#?\[\] ]/.test(userinfo),
      hostSuffix,
      port,
      parsedOk: hostSuffix !== null,
      hasSslmode: /sslmode=/.test(raw),
    };
  }

  let ping: string | undefined;
  if (new URL(req.url).searchParams.get("ping") === "1") {
    try {
      const { db: client } = await import("@/db/client");
      const { sql } = await import("drizzle-orm");
      await client.execute(sql.raw("select 1"));
      ping = "ok";
    } catch (e) {
      const err = e as { code?: string; message?: string };
      ping = `error:${err.code ?? ""}:${(err.message ?? "").replace(/postgres(ql)?:\/\/\S+/gi, "<redacted>").slice(0, 80)}`;
    }
  }

  return NextResponse.json({ ok: true, env, db, ping, note: "temporary QIN-24 diag — remove after go-live" });
}
