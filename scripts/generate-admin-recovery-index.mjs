import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY;
const outputDirectory = resolve(process.env.PAGES_DIST_DIR ?? "pages-dist");

if (!supabaseUrl || !secretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

const response = await fetch(
  `${supabaseUrl}/rest/v1/member?select=auth_user_id,username,email&role=eq.admin&is_active=eq.true`,
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

const seal = (value, keyMaterial) => {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(keyMaterial).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64url");
};

const members = await response.json();
const entries = await Promise.all(
  members
    .filter((member) => (
      typeof member.auth_user_id === "string"
      && typeof member.email === "string"
      && typeof member.username === "string"
    ))
    .map(async (member) => {
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(member.auth_user_id)}`, {
        headers: {
          apikey: secretKey,
          authorization: `Bearer ${secretKey}`,
        },
      });
      if (!authResponse.ok) {
        throw new Error(`Could not resolve Supabase Auth user (${authResponse.status}).`);
      }
      const authPayload = await authResponse.json();
      const authUser = authPayload.user ?? authPayload;
      if (typeof authUser.email !== "string") {
        throw new Error("The linked Supabase Auth user does not have an email address.");
      }

      const recoveryEmail = member.email.trim().toLowerCase();
      const username = member.username.trim().toLowerCase();
      const authEmail = authUser.email.trim().toLowerCase();
      return {
        recoveryEmailHash: createHash("sha256").update(recoveryEmail).digest("hex"),
        usernameHash: createHash("sha256").update(username).digest("hex"),
        usernameCipher: seal(username, recoveryEmail),
        authEmailCipher: seal(authEmail, username),
      };
    }),
);

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, "admin-recovery.json"),
  `${JSON.stringify({ version: 2, entries })}\n`,
  "utf8",
);

console.log(`Generated administrator recovery index with ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`);
