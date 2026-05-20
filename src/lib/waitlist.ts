import { z } from "zod";

import { db, schema } from "@/db/client";
import { captureServerEvent } from "@/lib/analytics-server";
import { sendWaitlistWelcome } from "@/lib/email";

export const WaitlistInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  source: z.string().trim().max(64).optional(),
  referrer: z.string().trim().max(2048).optional(),
  userAgent: z.string().trim().max(2048).optional(),
});

export type WaitlistInput = z.infer<typeof WaitlistInputSchema>;

export type WaitlistResult =
  | { ok: true; isNew: boolean }
  | { ok: false; error: "invalid_email" | "server_error" };

export async function submitToWaitlist(input: WaitlistInput): Promise<WaitlistResult> {
  const parsed = WaitlistInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_email" };
  }
  const { email, source, referrer, userAgent } = parsed.data;

  try {
    const inserted = await db
      .insert(schema.waitlist)
      .values({
        email,
        source: source ?? null,
        referrer: referrer ?? null,
        userAgent: userAgent ?? null,
      })
      .onConflictDoNothing({ target: schema.waitlist.email })
      .returning({ id: schema.waitlist.id });

    const isNew = inserted.length > 0;

    if (isNew) {
      void sendWaitlistWelcome({ to: email }).catch(() => undefined);
    }
    void captureServerEvent("waitlist_signup", email, {
      isNew,
      source: source ?? null,
      referrer: referrer ?? null,
    }).catch(() => undefined);

    return { ok: true, isNew };
  } catch (err) {
    console.error("waitlist insert failed", err);
    return { ok: false, error: "server_error" };
  }
}
