import { NextResponse } from "next/server";
import { createTicketPayload } from "../../../scripts/ticket-data.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(createTicketPayload(), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=604800",
    },
  });
}
