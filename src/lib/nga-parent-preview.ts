import { createHmac } from "node:crypto";
import { getCoachEmails, isAllowedCoachEmail } from "@/lib/coach-allowlist";
import { secretEquals } from "@/lib/secret-compare";
import { NGA_NEXT_FOCUS_OPTIONS } from "@/lib/nga-journey";

const PURPOSE = "nga_registration_journey_preview" as const;
export const NGA_PARENT_PREVIEW_SECONDS = 600;
export const isNgaPageId = (value: unknown): value is string => typeof value === "string" && /^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(value);
export interface ParentPreviewAuthority {
  registrationId: string;
  playerId: string;
  registrationRevision: string;
  assessmentRevision: string;
  identityRevision: string;
  focusId: string;
}
export interface ParentPreviewClaims extends ParentPreviewAuthority {
  version: 1;
  purpose: typeof PURPOSE;
  issuer: string;
  issuedAt: number;
  expiresAt: number;
}
function key(): string | null {
  const value = process.env.NGA_JOURNEY_PREVIEW_SIGNING_SECRET;
  return value && value.length >= 32 && value === value.trim() && !/[\r\n]/.test(value) && !value.includes("\\n") ? value : null;
}
export function parentPreviewKeyConfigured(): boolean { return key() !== null; }
export function parentPreviewFingerprint(value: unknown): string | null {
  const secret = key();
  return secret ? createHmac("sha256", secret).update(`nga-journey-source:${JSON.stringify(value)}`).digest("hex") : null;
}
function issuerKey(email: string, secret: string): string {
  return createHmac("sha256", secret).update(`nga-journey-issuer:${email.trim().toLowerCase()}`).digest("hex");
}
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/.test(value);
function validAuthority(value: ParentPreviewAuthority): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value) && isNgaPageId(value.registrationId) && isNgaPageId(value.playerId) && hash(value.registrationRevision) && hash(value.assessmentRevision) && hash(value.identityRevision) && NGA_NEXT_FOCUS_OPTIONS.some((focus) => focus.id === value.focusId);
}
/** A new purpose and dedicated key. No cancellation/commit/admin token fallback. */
export function issueParentPreviewCode(authority: ParentPreviewAuthority, coachEmail: string, now = Date.now()): string | null {
  const secret = key();
  if (!secret || !isAllowedCoachEmail(coachEmail) || !Number.isFinite(now) || !validAuthority(authority) || Object.keys(authority).sort().join(",") !== ["registrationId", "playerId", "registrationRevision", "assessmentRevision", "identityRevision", "focusId"].sort().join(",")) return null;
  const issuedAt = Math.floor(now / 1000);
  const claims: ParentPreviewClaims = { ...authority, version: 1, purpose: PURPOSE, issuer: issuerKey(coachEmail, secret), issuedAt, expiresAt: issuedAt + NGA_PARENT_PREVIEW_SECONDS };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`ngaj1.${payload}`).digest("base64url");
  return `ngaj1.${payload}.${signature}`;
}
export function verifyParentPreviewCode(code: unknown, now = Date.now()): ParentPreviewClaims | null {
  const secret = key();
  if (!secret || typeof code !== "string" || code.length > 4096 || !Number.isFinite(now)) return null;
  const parts = code.split(".");
  if (parts.length !== 3 || parts[0] !== "ngaj1" || !/^[a-zA-Z\d_-]+$/.test(parts[1]) || !/^[a-zA-Z\d_-]+$/.test(parts[2])) return null;
  const expected = createHmac("sha256", secret).update(`ngaj1.${parts[1]}`).digest("base64url");
  if (!secretEquals(parts[2], expected)) return null;
  try {
    const decoded = Buffer.from(parts[1], "base64url");
    if (decoded.toString("base64url") !== parts[1]) return null;
    const claims = JSON.parse(decoded.toString("utf8")) as ParentPreviewClaims;
    if (!claims || typeof claims !== "object" || Array.isArray(claims) || Object.keys(claims).sort().join(",") !== ["registrationId", "playerId", "registrationRevision", "assessmentRevision", "identityRevision", "focusId", "version", "purpose", "issuer", "issuedAt", "expiresAt"].sort().join(",")) return null;
    const seconds = Math.floor(now / 1000);
    if (claims.version !== 1 || claims.purpose !== PURPOSE || !validAuthority(claims) || !hash(claims.issuer) || !Number.isInteger(claims.issuedAt) || claims.issuedAt < 0 || claims.issuedAt > seconds || claims.expiresAt !== claims.issuedAt + NGA_PARENT_PREVIEW_SECONDS || seconds >= claims.expiresAt) return null;
    if (!getCoachEmails().some((email) => secretEquals(claims.issuer, issuerKey(email, secret)))) return null;
    return claims;
  } catch { return null; }
}
