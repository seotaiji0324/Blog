import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const feedUrl = "https://www.yna.co.kr/rss/entertainment.xml";
const outputPath = resolve(process.cwd(), "public", "dev-weekly-letter.json");
const now = new Date();
const kpopKeywords = /K-?POP|케이팝|아이돌|걸그룹|보이그룹|BTS|방탄소년단|블랙핑크|제니|로제|리사|지수|엔하이픈|투모로우바이투게더|TXT|샤이니|빅뱅|스트레이\s?키즈|에스파|아이브|르세라핌|뉴진스|NMIXX|엔믹스|트와이스|세븐틴|엑소|NCT|라이즈|제로베이스원|청하|있지|아이들/i;

try {
  const entries = parseFeed(await downloadFeed())
    .filter((item) => {
      const age = now.getTime() - item.publishedAt.getTime();
      return age >= -86_400_000 && age <= 8 * 86_400_000;
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 3)
    .map((item) => ({
      label: `LATEST · ${formatKstMonthDay(item.publishedAt)}`,
      title: item.title,
      summary: item.summary,
      source: "연합뉴스",
      sourceUrl: item.sourceUrl,
    }));

  if (entries.length < 3) throw new Error("Not enough current K-pop stories");

  await writeFile(outputPath, `${JSON.stringify({
    weekLabel: getWeekLabel(now),
    updatedLabel: `WEB UPDATED · ${formatKstDateTime(now)}`,
    headline: "지금 가장 새롭게 움직이는 K-pop 세 장면",
    intro: "최근 7일 동안 공개된 K-pop 소식을 확인해 발매와 아티스트 뉴스를 최신순으로 골랐어요.",
    entries,
  }, null, 2)}\n`, "utf8");

  console.log(`Weekly letter snapshot updated with ${entries.length} stories.`);
} catch (error) {
  console.warn(`Weekly letter snapshot refresh skipped: ${error instanceof Error ? error.message : "unknown error"}`);
}

async function downloadFeed() {
  const curl = process.platform === "win32" ? "curl.exe" : "curl";
  const { stdout } = await execFileAsync(curl, ["-fsSL", feedUrl], {
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
    timeout: 20_000,
  });
  return stdout;
}

function parseFeed(xml) {
  return Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi))
    .map((match) => {
      const block = match[1];
      const title = cleanText(extractTag(block, "title"));
      const sourceUrl = cleanUrl(extractTag(block, "link"));
      const publishedAt = new Date(cleanText(extractTag(block, "pubDate")));
      const summary = summarize(extractTag(block, "description"));
      if (!title || !sourceUrl || Number.isNaN(publishedAt.getTime()) || !kpopKeywords.test(`${title} ${summary}`)) return null;

      return {
        title,
        sourceUrl,
        publishedAt,
        summary: summary || "이번 주 새롭게 전해진 K-pop 소식입니다. 원문에서 자세한 내용을 확인해 보세요.",
      };
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

function summarize(value) {
  const text = cleanText(value).replace(/\s+(Continue reading|The post)\b[\s\S]*$/i, "").trim();
  if (text.length <= 180) return text;
  const shortened = text.slice(0, 180);
  return `${shortened.slice(0, Math.max(shortened.lastIndexOf(" "), 140)).trim()}…`;
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

function getWeekLabel(date) {
  const kst = new Date(date.getTime() + 9 * 3_600_000);
  const day = kst.getUTCDay() || 7;
  const monday = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - day + 1));
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const thursday = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 4 - day));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `WEEK ${String(week).padStart(2, "0")} · ${formatUtcMonthDay(monday)}—${formatUtcMonthDay(sunday)}`;
}

function formatUtcMonthDay(date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
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
