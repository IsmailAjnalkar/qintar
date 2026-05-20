import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth/server";

import "../flow.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create your account",
  description: "Set up your first Qintar pipeline digest in under 15 minutes.",
};

export default async function SignUpPage() {
  if (await getSession()) redirect("/onboarding");

  return (
    <main className="flow-page">
      <Link href="/" className="flow-wordmark">
        Qintar
      </Link>
      <div className="flow-card">
        <h1 className="flow-title">Create your account</h1>
        <p className="flow-subtitle">
          Connect HubSpot, pick a plan, and get your first digest in Slack — usually under 15 minutes.
        </p>
        <AuthForm mode="signup" />
        <p className="flow-meta">
          Already have an account?{" "}
          <Link className="flow-link" href="/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
