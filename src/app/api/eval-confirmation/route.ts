import { secretEquals } from "@/lib/secret-compare";
import { NextRequest, NextResponse } from "next/server";
import {
  sendEvalConfirmation,
  type EvalConfirmationRequest,
} from "@/lib/eval-confirmation-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secretEquals(secret, process.env.NGA_ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<EvalConfirmationRequest> & { dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dryRun =
    body.dryRun === true || req.nextUrl.searchParams.get("dryRun") === "1";

  const result = await sendEvalConfirmation(
    {
      parentEmail: body.parentEmail ?? "",
      parentFirst: body.parentFirst,
      childFirst: body.childFirst ?? "",
      date: body.date ?? "",
      startTime: body.startTime ?? "",
      endTime: body.endTime ?? "",
      location: body.location ?? "",
      coachName: body.coachName,
    },
    { dryRun },
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.errors ? { errors: result.errors } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json(result);
}
