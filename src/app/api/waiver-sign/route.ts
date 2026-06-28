import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { site } from "@/data/site";
import { ingestToOpenBrain } from "@/lib/open-brain-ingest";
import {
  validateWaiverSignForm,
  type WaiverSignFormData,
} from "@/lib/validate-waiver-sign";
import { findWaiverByEmail, createWaiver } from "@/lib/notion-waivers";
import { WAIVER_VERSION } from "@/data/waiver";
import {
  waiverConfirmationHtml,
  waiverConfirmationText,
  waiverConfirmationSubject,
} from "@/lib/email/waiver-confirmation";

const CC_EMAIL = "nextgenacademypb@gmail.com";
const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  let body: Partial<WaiverSignFormData>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const errors = validateWaiverSignForm(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    // The confirmation email is the parent's record copy — the core deliverable.
    return NextResponse.json(
      { error: "Waiver signing is temporarily unavailable. Please try again later." },
      { status: 500 },
    );
  }

  const parentName = body.parentName!.trim();
  const email = body.email!.trim().toLowerCase();
  const phone = body.phone?.trim() ?? "";
  const signatureName = body.signatureName!.trim().slice(0, 200);
  const parentFirst = parentName.split(" ")[0] || parentName;
  const now = new Date();
  const signedAtIso = now.toISOString();
  const signedAtLong = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  // Notion write — dedup by email so a re-sign doesn't pile up duplicate rows.
  // Fail-soft: the confirmation email (the record copy) still sends either way.
  let alreadyOnFile = false;
  try {
    const existing = await findWaiverByEmail(email);
    if (existing) {
      alreadyOnFile = true;
    } else {
      const result = await createWaiver({
        parentName,
        email,
        phone: phone || undefined,
        signatureName,
        waiverVersion: WAIVER_VERSION,
        signedAtIso,
        signedIp: ip !== "unknown" ? ip : undefined,
      });
      if (!result.ok) console.error("[waiver-sign]", result.error);
    }
  } catch (err) {
    console.error("[waiver-sign] notion error:", err);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      bcc: CC_EMAIL,
      replyTo: site.email,
      subject: waiverConfirmationSubject(),
      html: waiverConfirmationHtml({ parentFirst, signatureName, signedAtLong }),
      text: waiverConfirmationText({ parentFirst, signatureName, signedAtLong }),
    });
  } catch (err) {
    console.error("[waiver-sign] email send failed:", err);
  }

  await ingestToOpenBrain({
    email,
    name: parentName,
    phone: phone || undefined,
    business: "nga",
    source: "nga_waiver_signed",
    interest: `waiver ${WAIVER_VERSION}`,
    utm: {
      source: body.utm_source,
      medium: body.utm_medium,
      campaign: body.utm_campaign,
    },
    metadata: {
      waiver_version: WAIVER_VERSION,
      signed_at: signedAtIso,
      already_on_file: alreadyOnFile,
      is_parent: true,
    },
  });

  return NextResponse.json({ success: true, alreadyOnFile });
}
