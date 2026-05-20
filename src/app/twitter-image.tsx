// Re-use the OpenGraph image for the Twitter card. The config fields must be
// declared literally here (not re-exported) so Next.js recognizes `runtime`
// and treats this as an edge/dynamic route. Re-exporting them hides the
// `runtime = "edge"` value from Next's static analysis, which then tries to
// statically prerender the image in Node and fails inside @vercel/og.
import OpengraphImage from "./opengraph-image";

export const runtime = "edge";
export const alt = "Qintar — The AI Pipeline Coach for HubSpot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OpengraphImage;
