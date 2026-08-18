import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FeedSource = {
  name: string;
  url: string;
  accepts: (categories: string[], searchableText: string) => boolean;
};

type FeedItem = {
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  publishedAt: Date;
};

type WeeklyLetterPayload = {
  weekLabel: string;
  updatedLabel: string;
  headline: string;
  intro: string;
  entries: Array<{
    label: string;
    title: string;
    summary: string;
    source: string;
    sourceUrl: string;
  }>;
};

const SIX_HOURS = 6 * 60 * 60 * 1000;
const EIGHT_DAYS = 8 * 24 * 60 * 60 * 1000;
const kpopKeywords = /K-?POP|케이팝|아이돌|걸그룹|보이그룹|BTS|방탄소년단|블랙핑크|제니|로제|리사|지수|엔하이픈|투모로우바이투게더|TXT|샤이니|빅뱅|스트레이\s?키즈|에스파|아이브|르세라핌|뉴진스|NMIXX|엔믹스|트와이스|세븐틴|엑소|NCT|라이즈|제로베이스원|청하|있지|아이들/i;
const feeds: FeedSource[] = [
  {
    name: "연합뉴스",
    url: "https://www.yna.co.kr/rss/entertainment.xml",
    accepts: (_categories, searchableText) => kpopKeywords.test(searchableText),
  },
  {
    name: "Soompi",
    url: "https://www.soompi.com/feed",
    accepts: (categories) => categories.some((category) => category.toLowerCase() === "music"),
  },
  {
    name: "NME",
    url: "https://www.nme.com/tag/k-pop/feed",
    accepts: () => true,
  },
];

let memoryCache: { expiresAt: number; payload: WeeklyLetterPayload } | null = null;

export async function GET() {
  const now = new Date();
  if (memoryCache && memoryCache.expiresAt > now.getTime()) {
    return weeklyLetterResponse(memoryCache.payload, "HIT");
  }

  try {
    const feedResults = await Promise.allSettled(feeds.map((source) => loadFeed(source)));
    const candidates = feedResults
      .flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .filter((item) => {
        const age = now.getTime() - item.publishedAt.getTime();
        return age >= -24 * 60 * 60 * 1000 && age <= EIGHT_DAYS;
      })
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    const selected = selectDiverseItems(candidates, 3);
    if (selected.length < 3) throw new Error("Not enough current K-pop stories");

    const payload: WeeklyLetterPayload = {
      weekLabel: getWeekLabel(now),
      updatedLabel: `WEB UPDATED · ${formatKstDateTime(now)}`,
      headline: "지금 가장 새롭게 움직이는 K-pop 세 장면",
      intro: "최근 7일 동안 공개된 K-pop 소식을 확인해 발매와 아티스트 뉴스를 최신순으로 골랐어요.",
      entries: selected.map((item) => ({
        label: `LATEST · ${formatKstMonthDay(item.publishedAt)}`,
        title: item.title,
        summary: item.summary,
        source: item.source,
        sourceUrl: item.sourceUrl,
      })),
    };

    memoryCache = { expiresAt: now.getTime() + SIX_HOURS, payload };
    return weeklyLetterResponse(payload, "MISS");
  } catch (error) {
    console.error("Weekly letter refresh failed", error);
    if (memoryCache) return weeklyLetterResponse(memoryCache.payload, "STALE");
    return NextResponse.json(
      { error: "최신 소식을 불러오지 못했습니다." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

async function loadFeed(source: FeedSource) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(source.url, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${source.name} feed returned ${response.status}`);
    return parseFeed(await response.text(), source);
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeed(xml: string, source: FeedSource) {
  return Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi))
    .map((match): FeedItem | null => {
      const block = match[1];
      const categories = Array.from(block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi))
        .map((category) => cleanText(category[1]));
      const searchableText = `${cleanText(extractTag(block, "title"))} ${cleanText(extractTag(block, "description"))}`;
      if (!source.accepts(categories, searchableText)) return null;

      const title = cleanText(extractTag(block, "title"));
      const sourceUrl = cleanUrl(extractTag(block, "link"));
      const publishedAt = new Date(cleanText(extractTag(block, "pubDate")));
      const summary = summarize(extractTag(block, "description"));

      if (!title || !sourceUrl || Number.isNaN(publishedAt.getTime())) return null;
      return {
        title,
        summary: summary || "이번 주 새롭게 전해진 K-pop 소식입니다. 원문에서 자세한 내용을 확인해 보세요.",
        source: source.name,
        sourceUrl,
        publishedAt,
      };
    })
    .filter((item): item is FeedItem => item !== null);
}

function extractTag(block: string, tag: string) {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block)?.[1] ?? "";
}

function cleanText(value: string) {
  return decodeEntities(value)
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarize(value: string) {
  const text = cleanText(value)
    .replace(/\s+(Continue reading|The post)\b[\s\S]*$/i, "")
    .trim();
  if (text.length <= 180) return text;
  const shortened = text.slice(0, 180);
  return `${shortened.slice(0, Math.max(shortened.lastIndexOf(" "), 140)).trim()}…`;
}

function cleanUrl(value: string) {
  const candidate = cleanText(value);
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", hellip: "…", ldquo: "“", lsquo: "‘",
    lt: "<", nbsp: " ", quot: '"', rdquo: "”", rsquo: "’",
  };
  return value
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code: string) => {
      const numeric = code.toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : "";
    })
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity);
}

function selectDiverseItems(items: FeedItem[], limit: number) {
  const selected: FeedItem[] = [];
  const deferred: FeedItem[] = [];
  const counts = new Map<string, number>();
  const seen = new Set<string>();

  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if ((counts.get(item.source) ?? 0) >= 2) {
      deferred.push(item);
      continue;
    }
    selected.push(item);
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
    if (selected.length === limit) return selected;
  }

  for (const item of deferred) {
    selected.push(item);
    if (selected.length === limit) break;
  }
  return selected;
}

function getWeekLabel(date: Date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay() || 7;
  const monday = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - day + 1));
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  const thursday = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 4 - day));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `WEEK ${String(week).padStart(2, "0")} · ${formatUtcMonthDay(monday)}—${formatUtcMonthDay(sunday)}`;
}

function formatUtcMonthDay(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatKstMonthDay(date: Date) {
  const parts = getKstParts(date);
  return `${parts.month}.${parts.day}`;
}

function formatKstDateTime(date: Date) {
  const parts = getKstParts(date);
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute} KST`;
}

function getKstParts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Asia/Seoul",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function weeklyLetterResponse(payload: WeeklyLetterPayload, cacheStatus: "HIT" | "MISS" | "STALE") {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=604800",
      "X-Weekly-Letter-Cache": cacheStatus,
    },
  });
}
