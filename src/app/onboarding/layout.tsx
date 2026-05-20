import Link from "next/link";

import { requireSession } from "@/lib/auth/server";

import "../flow.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Set up Qintar" };

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Guards every /onboarding/* route — redirects to sign-in if unauthenticated.
  await requireSession("/onboarding");
  return (
    <main className="flow-page">
      <Link href="/" className="flow-wordmark">
        Qintar
      </Link>
      {children}
    </main>
  );
}
