import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY;
const outputDirectory = resolve(process.env.PAGES_DIST_DIR ?? "pages-dist");

if (!supabaseUrl || !secretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

const response = await fetch(
  `${supabaseUrl}/rest/v1/member?select=username,email&role=eq.admin&is_active=eq.true`,
  {
    headers: {
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
    },
  },
);

if (!response.ok) {
  throw new Error(`Could not build the administrator recovery index (${response.status}).`);
}

const members = await response.json();
const entries = members
  .filter((member) => typeof member.email === "string" && typeof member.username === "string")
  .map((member) => ({
    emailHash: createHash("sha256").update(member.email.trim().toLowerCase()).digest("hex"),
    username: member.username,
  }));

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, "admin-recovery.json"),
  `${JSON.stringify({ version: 1, entries })}\n`,
  "utf8",
);

console.log(`Generated administrator recovery index with ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`);
