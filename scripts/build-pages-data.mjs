import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("pages-dist");
const outputFile = path.join(outputDirectory, "playlist.json");
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

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
const entries = rows.map((row) => ({
  ...row,
  playback_url: null,
}));

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(outputFile, `${JSON.stringify({ entries })}\n`, "utf8"),
  writeFile(path.join(outputDirectory, ".nojekyll"), "", "utf8"),
]);

console.log(`Created GitHub Pages playlist snapshot with ${entries.length} active tracks.`);
