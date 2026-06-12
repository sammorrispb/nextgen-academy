import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionEmail } from "@/lib/admin-auth";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";
import { fetchAllDropInsInRange, type DropInRegistration } from "@/lib/notion-dropins";
import { partitionRegistrants } from "@/lib/registrant-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authed(): Promise<boolean> {
  const c = await cookies();
  const email = verifyAdminSessionEmail(c.get(ADMIN_SESSION_COOKIE)?.value);
  return !!email && isAllowedAdminEmail(email);
}

export interface AdminRegistrant {
  id: string;
  url: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childFirstName: string;
  childBirthYear: number;
  amountPaidUsd: number;
  status: string;
  attendance: string;
  smsConsent: boolean;
  paidAt: string;
}

function toRegistrant(row: DropInRegistration): AdminRegistrant {
  return {
    id: row.id,
    url: row.url,
    parentName: row.parentName,
    parentEmail: row.parentEmail,
    parentPhone: row.parentPhone,
    childFirstName: row.childFirstName,
    childBirthYear: row.childBirthYear,
    amountPaidUsd: row.amountPaidUsd,
    status: row.status,
    attendance: row.attendance,
    smsConsent: row.smsConsent,
    paidAt: row.paidAt,
  };
}

export async function GET(req: NextRequest) {
  if (!(await authed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const title = req.nextUrl.searchParams.get("title") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 });
  }
  try {
    const rows = await fetchAllDropInsInRange(date, date);
    const { matched, otherTitleCount } = partitionRegistrants(rows, title);
    return NextResponse.json({
      registrants: matched.map(toRegistrant),
      otherTitleCount,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}
