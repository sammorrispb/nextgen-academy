import { ImageResponse } from "next/og";

import { NGA_LOGO_DATA_URI, NGA_LOGO_SIZE } from "./og-logo";

// NGA brand palette tokens (mirror of `src/app/globals.css` post-2026-05-07
// teal-primary refresh; BRAND_GUIDELINES.md §"COLOR SYSTEM").
const NAVY = "#1A2744"; // ngpa-navy — page ground
const TEAL = "#00B4D8"; // ngpa-teal — brand primary
const WHITE = "#EEF2FF"; // ngpa-white — text primary
const MUTED = "#8A99C5"; // ngpa-muted — secondary text

export const alt =
  "Next Gen Pickleball Academy — Real pickleball coaching for kids 6–16 in Montgomery County, MD";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const runtime = "edge";

// Rendered width of the wordmark on the card. Height is derived from the
// asset's intrinsic ratio so the logo can never stretch if the source changes.
const LOGO_WIDTH = 560;
const LOGO_HEIGHT = Math.round(
  (LOGO_WIDTH * NGA_LOGO_SIZE.height) / NGA_LOGO_SIZE.width,
);

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: NAVY,
          color: WHITE,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "72px 96px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/*
          The logo is a data URI (see ./og-logo) rather than a /public path:
          this route is edge, so there is no filesystem, and a build-time fetch
          of our own origin would fail on a fresh deploy.

          Satori requires an explicit `display` on any element with more than
          one child. Every multi-child node below is therefore a flex container
          — without it the route throws and Vercel serves a 0-byte PNG, which
          renders as a BLANK share card with a 200 status.
        */}
        <img
          src={NGA_LOGO_DATA_URI}
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          alt=""
        />
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 46,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: WHITE,
            textAlign: "center",
          }}
        >
          Real pickleball coaching for kids 6–16.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 28,
            color: TEAL,
            fontWeight: 600,
          }}
        >
          Free evaluation. Montgomery County, MD.
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 48,
            fontSize: 22,
            color: MUTED,
          }}
        >
          nextgenpbacademy.com
        </div>
      </div>
    ),
    { ...size },
  );
}
