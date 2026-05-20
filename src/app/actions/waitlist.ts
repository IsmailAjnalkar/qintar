"use server";

import { headers } from "next/headers";

import { submitToWaitlist } from "@/lib/waitlist";

export type WaitlistFormState =
  | { status: "idle" }
  | { status: "success"; isNew: boolean }
  | { status: "error"; message: string };

export async function submitWaitlistAction(
  _prev: WaitlistFormState,
  formData: FormData,
): Promise<WaitlistFormState> {
  const email = String(formData.get("email") ?? "");
  const source = (formData.get("source") as string | null) ?? undefined;
  const referrer = (formData.get("referrer") as string | null) ?? undefined;
  const userAgent = (await headers()).get("user-agent") ?? undefined;

  const result = await submitToWaitlist({ email, source, referrer, userAgent });

  if (!result.ok) {
    if (result.error === "invalid_email") {
      return { status: "error", message: "That doesn't look like a valid work email." };
    }
    return { status: "error", message: "Something went wrong. Try again in a moment." };
  }
  return { status: "success", isNew: result.isNew };
}
