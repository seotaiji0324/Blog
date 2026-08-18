export const CULTURE_FEED_URL = "https://www.yna.co.kr/rss/entertainment.xml";

const kpopKeywords = /K-?POP|케이팝|아이돌|걸그룹|보이그룹|BTS|방탄소년단|블랙핑크|제니|로제|리사|지수|엔하이픈|투모로우바이투게더|TXT|샤이니|빅뱅|스트레이\s?키즈|에스파|아이브|르세라핌|뉴진스|NMIXX|엔믹스|트와이스|세븐틴|엑소|NCT|라이즈|제로베이스원|청하|있지|아이들|가수|그룹/i;
const cultureCategories = [
  {
    id: "listen",
    koreanLabel: "듣고",
    englishLabel: "LISTEN",
    description: "새 앨범과 싱글, 목소리와 프로덕션을 더 깊게 들여다보는 최신 음악 이야기입니다.",
    matches: /신곡|음원|앨범|발매|컴백|노래|타이틀곡|싱글|EP|정규|미니|album|single|music|release|comeback/i,
  },
  {
    id: "watch",
    koreanLabel: "보고",
    englishLabel: "WATCH",
    description: "무대와 안무, 뮤직비디오와 라이브 퍼포먼스의 새로운 장면을 읽습니다.",
    matches: /무대|공연|콘서트|투어|뮤직비디오|영상|퍼포먼스|안무|페스티벌|MV|concert|tour|video|performance|festival/i,
  },
  {
    id: "join",
    koreanLabel: "함께하고",
    englishLabel: "JOIN",
    description: "팬미팅과 응원, 팝업과 커뮤니티처럼 팬들이 함께 만드는 문화의 최신 소식입니다.",
    matches: /팬|팬덤|팬미팅|팬콘|응원|커뮤니티|기부|캠페인|팝업|전시|축제|fandom|fan|community|popup|pop-up/i,
  },
];

export function createCultureLinksPayload(xml, now = new Date()) {
  const candidates = parseFeed(xml)
    .filter((item) => {
      const age = now.getTime() - item.publishedAt.getTime();
      return age >= -86_400_000 && age <= 30 * 86_400_000;
    })
    .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());
  const usedUrls = new Set();

  const entries = cultureCategories.map((category) => {
    const matched = candidates.find((item) => !usedUrls.has(item.sourceUrl) && category.matches.test(item.searchableText))
      ?? candidates.find((item) => !usedUrls.has(item.sourceUrl));
    if (!matched) throw new Error(`No current story found for ${category.id}`);
    usedUrls.add(matched.sourceUrl);
    return {
      id: category.id,
      koreanLabel: category.koreanLabel,
      englishLabel: category.englishLabel,
      description: category.description,
      articleLabel: `LATEST · ${formatKstMonthDay(matched.publishedAt)}`,
      articleTitle: matched.title,
      source: "연합뉴스",
      sourceUrl: matched.sourceUrl,
    };
  });

  return {
    updatedLabel: `LIVE UPDATED · ${formatKstDateTime(now)}`,
    entries,
  };
}

function parseFeed(xml) {
  return Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi))
    .map((match) => {
      const block = match[1];
      const title = cleanText(extractTag(block, "title"));
      const description = cleanText(extractTag(block, "description"));
      const sourceUrl = cleanUrl(extractTag(block, "link"));
      const publishedAt = new Date(cleanText(extractTag(block, "pubDate")));
      const searchableText = `${title} ${description}`;
      if (!title || !sourceUrl || Number.isNaN(publishedAt.getTime()) || !kpopKeywords.test(searchableText)) return null;
      return { title, sourceUrl, publishedAt, searchableText };
    })
    .filter(Boolean);
}

function extractTag(block, tag) {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block)?.[1] ?? "";
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUrl(value) {
  try {
    const url = new URL(cleanText(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function decodeEntities(value) {
  const named = {
    amp: "&", apos: "'", gt: ">", hellip: "…", ldquo: "“", lsquo: "‘",
    lt: "<", nbsp: " ", quot: '"', rdquo: "”", rsquo: "’",
  };
  return value
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => {
      const numeric = code.toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : "";
    })
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function formatKstMonthDay(date) {
  const parts = getKstParts(date);
  return `${parts.month}.${parts.day}`;
}

function formatKstDateTime(date) {
  const parts = getKstParts(date);
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute} KST`;
}

function getKstParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Asia/Seoul",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}
