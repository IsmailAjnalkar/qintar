import { Resend } from "resend";

export type SendWelcomeArgs = {
  to: string;
};

export async function sendWaitlistWelcome({ to }: SendWelcomeArgs): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WAITLIST_FROM_EMAIL ?? "Qintar <hello@qintar.com>";
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY missing" };
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: "You're on the Qintar waitlist",
    text: [
      "Welcome — thanks for joining the Qintar waitlist.",
      "",
      "We're building the AI Pipeline Coach for HubSpot: a daily Slack digest of the deals you should act on, with one-click AI-drafted follow-ups.",
      "",
      "We'll email you the moment access opens. If you reply to this email, a human will read it.",
      "",
      "— The Qintar team",
    ].join("\n"),
  });
  if (result.error) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, id: result.data?.id };
}
