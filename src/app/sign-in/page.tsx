import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth/server";

import "../flow.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  description: "Sign in to your Qintar workspace.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSession()) redirect("/dashboard");
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : undefined;

  return (
    <main className="flow-page">
      <Link href="/" className="flow-wordmark">
        Qintar
      </Link>
      <div className="flow-card">
        <h1 className="flow-title">Welcome back</h1>
        <p className="flow-subtitle">Sign in to your workspace.</p>
        <AuthForm mode="signin" next={safeNext} />
        <p className="flow-meta">
          New to Qintar?{" "}
          <Link className="flow-link" href="/sign-up">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
