import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Qintar — The AI Pipeline Coach for HubSpot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TOKENS = {
  ink0: "#0B0F1E",
  ink1: "#111634",
  ink2: "#1A2147",
  ink5: "#737C9C",
  ink7: "#C9CEDD",
  ink9: "#F2F3F8",
  ink10: "#FFFFFF",
  indigo300: "#8B97FF",
  indigo400: "#5F6FFF",
  indigo500: "#3B40E0",
  indigo700: "#252595",
  amber400: "#F5A800",
  mint500: "#0D9D66",
  coral500: "#C92A2A",
};

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `radial-gradient(120% 90% at 85% 15%, ${TOKENS.indigo700} 0%, ${TOKENS.ink1} 55%, ${TOKENS.ink0} 100%)`,
          color: TOKENS.ink10,
          padding: "72px 80px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Header row: wordmark + eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              fontSize: 42,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: TOKENS.ink10,
            }}
          >
            qintar
            <div
              style={{
                width: 14,
                height: 14,
                marginLeft: 6,
                marginBottom: 4,
                background: TOKENS.indigo400,
                borderRadius: 2,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: TOKENS.indigo300,
            }}
          >
            AI Pipeline Coach · for HubSpot
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: 1000,
          }}
        >
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.08,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: TOKENS.ink10,
            }}
          >
            Stop running pipeline reviews.
            <br />
            Start reading them at{" "}
            <span
              style={{
                color: TOKENS.indigo300,
                fontWeight: 600,
              }}
            >
              9:01am
            </span>
            .
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.45,
              color: TOKENS.ink7,
              maxWidth: 900,
              fontWeight: 400,
            }}
          >
            Every weekday in Slack: the three deals to push, the stalled ones to revive, the at-risk
            customers to call.
          </div>
        </div>

        {/* Footer pill row + signal-dot legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <Pill label="HubSpot-native" />
            <Pill label="Slack delivery" />
            <Pill label="Connect in 90 seconds" />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 18,
              color: TOKENS.ink5,
              fontWeight: 500,
            }}
          >
            <SignalDot color={TOKENS.amber400} />
            <SignalDot color={TOKENS.coral500} />
            <SignalDot color={TOKENS.mint500} />
            <div style={{ marginLeft: 6 }}>qintar.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 20px",
        background: "rgba(255, 255, 255, 0.08)",
        border: `1px solid ${TOKENS.indigo400}40`,
        borderRadius: 999,
        fontSize: 20,
        fontWeight: 500,
        color: TOKENS.ink10,
      }}
    >
      {label}
    </div>
  );
}

function SignalDot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 10,
        height: 10,
        background: color,
        borderRadius: 2,
        display: "flex",
      }}
    />
  );
}
