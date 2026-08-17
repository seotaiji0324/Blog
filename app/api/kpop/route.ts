import { NextResponse } from "next/server";
import { getChatGPTUser, isLocalDevelopmentUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

type KpopInput = {
  title?: unknown;
  artist?: unknown;
  genre?: unknown;
  releaseYear?: unknown;
  description?: unknown;
  musicUrl?: unknown;
  isPublished?: unknown;
};

type ValidatedKpopInput = {
  title: string;
  artist: string;
  genre: string;
  releaseYear: number | null;
  description: string;
  musicUrl: string | null;
  isPublished: boolean;
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return response({ error: "허용되지 않은 요청입니다." }, 403);
  }

  const user = await getChatGPTUser();
  if (!user) {
    return response({ error: "로그인이 필요합니다." }, 401);
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!isLocalDevelopmentUser(user) && (!adminEmail || user.email.trim().toLowerCase() !== adminEmail)) {
    return response({ error: "관리자 권한이 없습니다." }, 403);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return response({ error: "요청 형식이 올바르지 않습니다." }, 415);
  }

  let rawInput: KpopInput;
  try {
    rawInput = (await request.json()) as KpopInput;
  } catch {
    return response({ error: "입력 내용을 확인해 주세요." }, 400);
  }

  const validation = validateInput(rawInput);
  if (!validation.ok) {
    return response({ error: validation.error }, 400);
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    return response({ error: "DB 연결 설정이 완료되지 않았습니다." }, 503);
  }

  const record = {
    title: validation.value.title,
    artist: validation.value.artist,
    genre: validation.value.genre,
    release_year: validation.value.releaseYear,
    description: validation.value.description,
    music_url: validation.value.musicUrl,
    is_published: validation.value.isPublished,
    created_by: user.userId,
  };

  let supabaseResponse: Response;
  try {
    supabaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/kpopList?select=id,title,artist,genre,release_year,is_published,created_at`,
      {
        method: "POST",
        headers: {
          apikey: supabaseSecretKey,
          ...(supabaseSecretKey.split(".").length === 3
            ? { Authorization: `Bearer ${supabaseSecretKey}` }
            : {}),
          "Content-Type": "application/json",
          "Content-Profile": "public",
          Prefer: "return=representation",
        },
        body: JSON.stringify(record),
      },
    );
  } catch {
    return response({ error: "DB에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }

  if (!supabaseResponse.ok) {
    console.error("Supabase insert failed", supabaseResponse.status);
    return response({ error: "DB 저장 중 문제가 발생했습니다." }, 502);
  }

  const savedRows = (await supabaseResponse.json()) as Array<Record<string, unknown>>;
  return response({ entry: savedRows[0] }, 201);
}

function validateInput(input: KpopInput):
  | { ok: true; value: ValidatedKpopInput }
  | { ok: false; error: string } {
  const title = cleanText(input.title, 200);
  const artist = cleanText(input.artist, 160);
  const genre = cleanText(input.genre, 80);
  const description = cleanText(input.description, 3000, true);

  if (!title) return { ok: false, error: "제목을 입력해 주세요." };
  if (!artist) return { ok: false, error: "아티스트를 입력해 주세요." };
  if (!genre) return { ok: false, error: "장르를 선택해 주세요." };

  const releaseYear = parseReleaseYear(input.releaseYear);
  if (releaseYear === undefined) {
    return { ok: false, error: "발매연도는 1990~2100 사이의 숫자로 입력해 주세요." };
  }

  const musicUrl = cleanText(input.musicUrl, 500, true);
  if (musicUrl && !isSafeHttpUrl(musicUrl)) {
    return { ok: false, error: "음악 링크는 http 또는 https 주소만 사용할 수 있습니다." };
  }

  return {
    ok: true,
    value: {
      title,
      artist,
      genre,
      releaseYear,
      description,
      musicUrl: musicUrl || null,
      isPublished: input.isPublished === true,
    },
  };
}

function cleanText(value: unknown, maxLength: number, allowEmpty = false) {
  if (typeof value !== "string") return allowEmpty ? "" : null;
  const cleaned = value.trim();
  if (!cleaned && !allowEmpty) return null;
  if (cleaned.length > maxLength) return null;
  return cleaned;
}

function parseReleaseYear(value: unknown): number | null | undefined {
  if (value === "" || value === null || value === undefined) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return undefined;
  return year;
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
