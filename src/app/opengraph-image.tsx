import { ImageResponse } from "next/og";

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
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 96px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            fontWeight: 800,
            color: TEAL,
            marginBottom: 36,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: TEAL,
              display: "block",
            }}
          />
          Next Gen Pickleball Academy
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 88,
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: WHITE,
            maxWidth: 1000,
          }}
        >
          <span style={{ display: "flex" }}>Real pickleball coaching for&nbsp;</span>
          <span style={{ display: "flex", color: TEAL }}>kids 6&#8211;16.</span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 32,
            color: WHITE,
            opacity: 0.85,
            maxWidth: 960,
            lineHeight: 1.35,
          }}
        >
          Free evaluation. Montgomery County, MD.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 56,
            right: 96,
            fontSize: 22,
            color: MUTED,
          }}
        >
          nextgenpbacademy.com
        </div>
      </div>
    ),
    { ...size }
  );
}
