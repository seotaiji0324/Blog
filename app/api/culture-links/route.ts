import { NextResponse } from "next/server";
import { createCultureLinksPayload, CULTURE_FEED_URL } from "../../../scripts/culture-data.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(CULTURE_FEED_URL, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Culture feed returned ${response.status}`);

    return NextResponse.json(createCultureLinksPayload(await response.text()), {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Culture links refresh failed", error);
    return NextResponse.json(
      { error: "최신 문화 링크를 불러오지 못했습니다." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
