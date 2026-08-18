import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCultureLinksPayload } from "./culture-data.mjs";
import { createWeeklyLetterPayload, WEEKLY_LETTER_FEED_URL } from "./weekly-letter-data.mjs";
import { createTicketPayload } from "./ticket-data.mjs";

const outputDirectory = path.resolve("pages-dist");
const outputFile = path.join(outputDirectory, "playlist.json");
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const audioBucket = "kpop-audio";
const signedUrlSeconds = 6 * 60 * 60;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for the Pages data snapshot.");
}

const headers = { apikey: supabaseSecretKey };
if (supabaseSecretKey.split(".").length === 3) {
  headers.Authorization = `Bearer ${supabaseSecretKey}`;
}

const select = [
  "id",
  "title",
  "artist",
  "genre",
  "release_year",
  "music_url",
  "audio_path",
].join(",");
const endpoint = `${supabaseUrl}/rest/v1/PlayList?select=${select}&is_active=eq.true&order=display_order.asc,created_at.desc`;
const response = await fetch(endpoint, { headers });

if (!response.ok) {
  throw new Error(`Supabase playlist snapshot failed with HTTP ${response.status}.`);
}

const rows = await response.json();
const entries = await Promise.all(rows.map(async (row) => ({
  ...row,
  playback_url: row.audio_path ? await createSignedPlaybackUrl(row.audio_path) : null,
})));

const weeklyLetterResponse = await fetch(WEEKLY_LETTER_FEED_URL, {
  headers: { Accept: "application/rss+xml, application/xml, text/xml" },
});
if (!weeklyLetterResponse.ok) {
  throw new Error(`Weekly letter feed failed with HTTP ${weeklyLetterResponse.status}.`);
}
const weeklyLetterXml = await weeklyLetterResponse.text();
const weeklyLetter = createWeeklyLetterPayload(weeklyLetterXml);
const cultureLinks = createCultureLinksPayload(weeklyLetterXml);
const ticketNews = createTicketPayload();

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(outputFile, `${JSON.stringify({ entries })}\n`, "utf8"),
  writeFile(path.join(outputDirectory, "weekly-letter.json"), `${JSON.stringify(weeklyLetter)}\n`, "utf8"),
  writeFile(path.join(outputDirectory, "culture-links.json"), `${JSON.stringify(cultureLinks)}\n`, "utf8"),
  writeFile(path.join(outputDirectory, "ticket-news.json"), `${JSON.stringify(ticketNews)}\n`, "utf8"),
  writeFile(path.join(outputDirectory, ".nojekyll"), "", "utf8"),
]);

console.log(`Created GitHub Pages playlist snapshot with ${entries.length} active tracks.`);
console.log(`Created GitHub Pages weekly letter with ${weeklyLetter.entries.length} current stories.`);
console.log(`Created GitHub Pages culture links for ${cultureLinks.entries.length} editorial paths.`);
console.log(`Created GitHub Pages ticket radar with ${ticketNews.entries.length} upcoming events.`);

async function createSignedPlaybackUrl(audioPath) {
  const encodedPath = audioPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${audioBucket}/${encodedPath}`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: signedUrlSeconds }),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase audio signing failed with HTTP ${response.status}.`);
  }

  const body = await response.json();
  const signedPath = body.signedURL ?? body.signedUrl;
  if (!signedPath) throw new Error("Supabase did not return a signed audio URL.");
  if (/^https?:\/\//i.test(signedPath)) return signedPath;
  if (signedPath.startsWith("/storage/v1/")) return `${supabaseUrl}${signedPath}`;
  return `${supabaseUrl}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
}
