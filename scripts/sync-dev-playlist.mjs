import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceUrl = process.env.PLAYLIST_FALLBACK_URL?.replace(/\/$/, "");
const bearerToken = process.env.PLAYLIST_FALLBACK_BEARER_TOKEN;
const outputFile = path.join(process.cwd(), "public", "dev-playlist.json");

if (!sourceUrl || !bearerToken) {
  console.warn("Skipping the development playlist sync: fallback settings are missing.");
  process.exit(0);
}

// The local corporate proxy uses a legacy certificate. Scope the workaround to
// this one development-only synchronization process.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

try {
  const response = await fetch(`${sourceUrl}/api/playlist`, {
    headers: {
      Accept: "application/json",
      "OAI-Sites-Authorization": `Bearer ${bearerToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const body = await response.json();
  if (!Array.isArray(body.entries)) {
    throw new Error("The playlist response does not contain an entries array.");
  }

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify({ entries: body.entries }, null, 2)}\n`, "utf8");
  console.log(`Synced ${body.entries.length} playlist tracks for local development.`);
} catch (error) {
  console.warn(
    "Could not refresh the development playlist; keeping the last local snapshot.",
    error instanceof Error ? error.message : "unknown error",
  );
}
