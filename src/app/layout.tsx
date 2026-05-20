import type { Metadata } from "next";

import { PostHogProvider } from "@/lib/posthog-provider";

import "./tokens.css";
import "./landing.css";

// Prefer an explicit site URL; otherwise use the live Vercel production domain
// (auto-set by Vercel, and it tracks a custom domain once one is attached);
// fall back to the intended apex for local/dev.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "https://qintar.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Qintar — The AI Pipeline Coach for HubSpot",
    template: "%s · Qintar",
  },
  description:
    "Every weekday in Slack: the three deals to push, the stalled ones to revive, the at-risk customers to call. Pipeline review in 60 seconds.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Qintar — The AI Pipeline Coach for HubSpot",
    description:
      "Every weekday in Slack: the three deals to push, the stalled ones to revive, the at-risk customers to call.",
    url: SITE_URL,
    siteName: "Qintar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qintar — The AI Pipeline Coach for HubSpot",
    description:
      "Every weekday in Slack: the three deals to push, the stalled ones to revive, the at-risk customers to call.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
