import { NextRequest } from "next/server";
import { handleSeriesRequest } from "@/lib/mvf-series-http";
export async function POST(request: NextRequest, { params }: { params: Promise<{ event: string }> }) {
  return handleSeriesRequest(request, (await params).event, "register");
}
