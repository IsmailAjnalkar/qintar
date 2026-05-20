import { PostHog } from "posthog-node";

let cached: PostHog | null = null;

export function getServerPostHog(): PostHog | null {
  const key = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!key) return null;
  if (!cached) {
    cached = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  }
  return cached;
}

export async function captureServerEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {},
) {
  const client = getServerPostHog();
  if (!client) return;
  client.capture({ distinctId, event, properties });
  await client.flush().catch(() => undefined);
}
