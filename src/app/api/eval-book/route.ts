import { NextRequest, NextResponse } from "next/server";
import { EVALUATION_SMS_URL } from "@/data/scheduling";
import { site } from "@/data/site";

// Evaluations are arranged by text. Retired clients must not create requests,
// claim slots, parse child data, or send messages. Existing coach-admin eval
// confirmation routes continue to manage bookings already on file.
function retiredResponse() {
  return NextResponse.json({
    error: `Text Coach Sam at ${site.phone} to schedule a free evaluation.`,
    code: "EVALUATION_TEXT_TO_SCHEDULE",
    scheduleUrl: EVALUATION_SMS_URL,
    slots: [],
  }, { status: 410, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  void request;
  return retiredResponse();
}

export async function GET(request: NextRequest) {
  void request;
  return retiredResponse();
}
