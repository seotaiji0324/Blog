import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { createCultureLinksPayload, CULTURE_FEED_URL } from "./culture-data.mjs";

const execFileAsync = promisify(execFile);
const outputPath = resolve(process.cwd(), "public", "dev-culture-links.json");

try {
  const curl = process.platform === "win32" ? "curl.exe" : "curl";
  const { stdout } = await execFileAsync(curl, ["-fsSL", CULTURE_FEED_URL], {
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
    timeout: 20_000,
  });
  const payload = createCultureLinksPayload(stdout);
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Culture links snapshot updated for ${payload.entries.length} editorial paths.`);
} catch (error) {
  console.warn(`Culture links snapshot refresh skipped: ${error instanceof Error ? error.message : "unknown error"}`);
}
