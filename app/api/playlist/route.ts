import { NextResponse } from "next/server";
import { getChatGPTUser, isLocalDevelopmentUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const AUDIO_BUCKET = "kpop-audio";
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60;

type PlaylistInput = {
  id?: unknown;
  action?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
  fileType?: unknown;
  title?: unknown;
  artist?: unknown;
  album?: unknown;
  genre?: unknown;
  releaseYear?: unknown;
  musicUrl?: unknown;
  coverImageUrl?: unknown;
  description?: unknown;
  displayOrder?: unknown;
  isActive?: unknown;
  audioPath?: unknown;
  audioFilename?: unknown;
  audioSizeBytes?: unknown;
};

type SupabaseConfig = {
  url: string;
  secretKey: string;
};

export async function GET(request: Request) {
  const config = getSupabaseConfig();
  const adminView = new URL(request.url).searchParams.get("view") === "admin";

  if (adminView) {
    const user = await getChatGPTUser();
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!isLocalDevelopmentUser(user) && (!adminEmail || user.email.trim().toLowerCase() !== adminEmail)) {
      return json({ error: "관리자 권한이 없습니다." }, 403);
    }
    if (!config) return json({ error: "DB 연결 설정이 완료되지 않았습니다." }, 503);

    try {
      const result = await fetch(
        `${config.url}/rest/v1/PlayList?select=id,title,artist,album,genre,release_year,music_url,cover_image_url,description,display_order,is_active,audio_path,audio_filename,audio_size_bytes,created_at&order=display_order.asc,created_at.desc`,
        { headers: supabaseAuthHeaders(config), cache: "no-store" },
      );
      if (!result.ok) return json({ error: "PLAYLIST 목록을 불러오지 못했습니다." }, 502);
      return json({ entries: await result.json() }, 200);
    } catch {
      return json({ error: "DB에 연결하지 못했습니다." }, 502);
    }
  }

  if (!config) return json({ entries: [] }, 200);

  try {
    const result = await fetch(
      `${config.url}/rest/v1/PlayList?select=id,title,artist,album,genre,release_year,music_url,cover_image_url,description,display_order,audio_path,audio_filename,audio_size_bytes&is_active=eq.true&order=display_order.asc,created_at.desc`,
      {
        headers: supabaseAuthHeaders(config),
        cache: "no-store",
      },
    );
    if (!result.ok) return json({ entries: [] }, 200);

    const entries = (await result.json()) as Array<Record<string, unknown>>;
    const playableEntries = await Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        playback_url: typeof entry.audio_path === "string"
          ? await createSignedPlaybackUrl(config, entry.audio_path)
          : null,
      })),
    );
    return json({ entries: playableEntries }, 200);
  } catch {
    return json({ entries: [] }, 200);
  }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: "허용되지 않은 요청입니다." }, 403);
  }

  const user = await getChatGPTUser();
  if (!user) return json({ error: "로그인이 필요합니다." }, 401);
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!isLocalDevelopmentUser(user) && (!adminEmail || user.email.trim().toLowerCase() !== adminEmail)) {
    return json({ error: "관리자 권한이 없습니다." }, 403);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 415);
  }

  let input: PlaylistInput;
  try {
    input = (await request.json()) as PlaylistInput;
  } catch {
    return json({ error: "입력 내용을 확인해 주세요." }, 400);
  }

  const id = text(input.id, 80);
  if (!id || !validUuid(id)) return json({ error: "수정할 PLAYLIST 항목을 확인해 주세요." }, 400);

  const title = text(input.title, 200);
  const artist = text(input.artist, 160);
  const genre = text(input.genre, 80);
  if (!title) return json({ error: "곡 제목을 입력해 주세요." }, 400);
  if (!artist) return json({ error: "아티스트를 입력해 주세요." }, 400);
  if (!genre) return json({ error: "장르를 선택해 주세요." }, 400);

  const releaseYear = optionalInteger(input.releaseYear, 1990, 2100);
  const displayOrder = optionalInteger(input.displayOrder, 0, 9999) ?? 0;
  if (releaseYear === undefined || displayOrder === undefined) {
    return json({ error: "연도 또는 노출 순서를 확인해 주세요." }, 400);
  }

  const album = text(input.album, 200, true);
  const description = text(input.description, 3000, true);
  const musicUrl = text(input.musicUrl, 500, true);
  const coverImageUrl = text(input.coverImageUrl, 500, true);
  if (musicUrl && !safeUrl(musicUrl)) return json({ error: "음악 링크를 확인해 주세요." }, 400);
  if (coverImageUrl && !safeUrl(coverImageUrl)) return json({ error: "커버 이미지 주소를 확인해 주세요." }, 400);

  const audioPath = text(input.audioPath, 100, true);
  const audioFilename = text(input.audioFilename, 240, true);
  const audioSizeBytes = optionalInteger(input.audioSizeBytes, 1, MAX_AUDIO_SIZE);
  if (audioSizeBytes === undefined) return json({ error: "MP3 파일 크기를 확인해 주세요." }, 400);
  const hasAudioMetadata = Boolean(audioPath || audioFilename || audioSizeBytes !== null);
  if (hasAudioMetadata && (!audioPath || !validAudioPath(audioPath) || !audioFilename || !audioSizeBytes)) {
    return json({ error: "MP3 업로드 정보를 확인해 주세요." }, 400);
  }

  const config = getSupabaseConfig();
  if (!config) return json({ error: "DB 및 파일 저장소 연결 설정이 완료되지 않았습니다." }, 503);

  let previousAudioPath: string | null = null;
  try {
    const existingResult = await fetch(
      `${config.url}/rest/v1/PlayList?id=eq.${encodeURIComponent(id)}&select=id,audio_path`,
      { headers: supabaseAuthHeaders(config), cache: "no-store" },
    );
    if (!existingResult.ok) return json({ error: "수정할 항목을 확인하지 못했습니다." }, 502);
    const existingRows = (await existingResult.json()) as Array<{ id: string; audio_path: string | null }>;
    if (!existingRows[0]) return json({ error: "수정할 PLAYLIST 항목이 없습니다." }, 404);
    previousAudioPath = existingRows[0].audio_path;
  } catch {
    return json({ error: "DB에 연결하지 못했습니다." }, 502);
  }

  const hasNewAudio = Boolean(audioPath && audioPath !== previousAudioPath);
  if (hasNewAudio && audioPath && !(await verifyStoredMp3(config, audioPath))) {
    await removeAudio(config, audioPath);
    return json({ error: "새 MP3 파일이 올바르게 저장되지 않았습니다." }, 400);
  }

  const record = {
    title,
    artist,
    album: album || null,
    genre,
    release_year: releaseYear,
    music_url: musicUrl || null,
    cover_image_url: coverImageUrl || null,
    description,
    display_order: displayOrder,
    is_active: booleanValue(input.isActive, true),
    audio_path: audioPath || null,
    audio_filename: audioFilename || null,
    audio_size_bytes: audioSizeBytes,
  };

  try {
    const result = await fetch(
      `${config.url}/rest/v1/PlayList?id=eq.${encodeURIComponent(id)}&select=id,title,artist,album,genre,release_year,display_order,is_active,audio_filename,audio_size_bytes,created_at`,
      {
        method: "PATCH",
        headers: {
          ...supabaseAuthHeaders(config),
          "Content-Type": "application/json",
          "Content-Profile": "public",
          Prefer: "return=representation",
        },
        body: JSON.stringify(record),
      },
    );
    if (!result.ok) {
      if (hasNewAudio && audioPath) await removeAudio(config, audioPath);
      console.error("Supabase playlist update failed", result.status);
      return json({ error: "PLAYLIST 수정 중 문제가 발생했습니다." }, 502);
    }
    const rows = (await result.json()) as Array<Record<string, unknown>>;
    if (!rows[0]) return json({ error: "수정할 PLAYLIST 항목이 없습니다." }, 404);
    if (previousAudioPath && previousAudioPath !== audioPath) await removeAudio(config, previousAudioPath);
    return json({ entry: rows[0] }, 200);
  } catch {
    if (hasNewAudio && audioPath) await removeAudio(config, audioPath);
    return json({ error: "DB에 연결하지 못했습니다." }, 502);
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: "허용되지 않은 요청입니다." }, 403);
  }

  const user = await getChatGPTUser();
  if (!user) return json({ error: "로그인이 필요합니다." }, 401);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!isLocalDevelopmentUser(user) && (!adminEmail || user.email.trim().toLowerCase() !== adminEmail)) {
    return json({ error: "관리자 권한이 없습니다." }, 403);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 415);
  }

  let input: PlaylistInput;
  try {
    input = (await request.json()) as PlaylistInput;
  } catch {
    return json({ error: "입력 내용을 확인해 주세요." }, 400);
  }

  if (input.action === "prepareUpload") return prepareAudioUpload(input);
  if (input.action === "cancelUpload") return cancelAudioUpload(input);

  const title = text(input.title, 200);
  const artist = text(input.artist, 160);
  const genre = text(input.genre, 80);
  if (!title) return json({ error: "곡 제목을 입력해 주세요." }, 400);
  if (!artist) return json({ error: "아티스트를 입력해 주세요." }, 400);
  if (!genre) return json({ error: "장르를 선택해 주세요." }, 400);

  const releaseYear = optionalInteger(input.releaseYear, 1990, 2100);
  const displayOrder = optionalInteger(input.displayOrder, 0, 9999) ?? 0;
  if (releaseYear === undefined || displayOrder === undefined) {
    return json({ error: "연도 또는 노출 순서를 확인해 주세요." }, 400);
  }

  const album = text(input.album, 200, true);
  const description = text(input.description, 3000, true);
  const musicUrl = text(input.musicUrl, 500, true);
  const coverImageUrl = text(input.coverImageUrl, 500, true);
  if (musicUrl && !safeUrl(musicUrl)) return json({ error: "음악 링크를 확인해 주세요." }, 400);
  if (coverImageUrl && !safeUrl(coverImageUrl)) return json({ error: "커버 이미지 주소를 확인해 주세요." }, 400);

  const audioPath = text(input.audioPath, 100, true);
  const audioFilename = text(input.audioFilename, 240, true);
  const audioSizeBytes = optionalInteger(input.audioSizeBytes, 1, MAX_AUDIO_SIZE);
  if (audioSizeBytes === undefined) return json({ error: "MP3 파일 크기를 확인해 주세요." }, 400);

  const hasAudioMetadata = Boolean(audioPath || audioFilename || audioSizeBytes !== null);
  if (hasAudioMetadata && (!audioPath || !validAudioPath(audioPath) || !audioFilename || !audioSizeBytes)) {
    if (audioPath && validAudioPath(audioPath)) await cleanupAudioPath(audioPath);
    return json({ error: "MP3 업로드 정보를 확인해 주세요." }, 400);
  }

  const config = getSupabaseConfig();
  if (!config) return json({ error: "DB 및 파일 저장소 연결 설정이 완료되지 않았습니다." }, 503);

  if (audioPath && !(await verifyStoredMp3(config, audioPath))) {
    await removeAudio(config, audioPath);
    return json({ error: "저장된 파일이 올바른 MP3인지 확인해 주세요." }, 400);
  }

  const record = {
    title,
    artist,
    album: album || null,
    genre,
    release_year: releaseYear,
    music_url: musicUrl || null,
    cover_image_url: coverImageUrl || null,
    description,
    display_order: displayOrder,
    is_active: booleanValue(input.isActive, true),
    created_by: user.userId,
    audio_path: audioPath || null,
    audio_filename: audioFilename || null,
    audio_size_bytes: audioSizeBytes,
  };

  try {
    const result = await fetch(
      `${config.url}/rest/v1/PlayList?select=id,title,artist,album,genre,release_year,display_order,is_active,audio_filename,audio_size_bytes,created_at`,
      {
        method: "POST",
        headers: {
          ...supabaseAuthHeaders(config),
          "Content-Type": "application/json",
          "Content-Profile": "public",
          Prefer: "return=representation",
        },
        body: JSON.stringify(record),
      },
    );
    if (!result.ok) {
      if (audioPath) await removeAudio(config, audioPath);
      console.error("Supabase playlist insert failed", result.status);
      return json({ error: "PLAYLIST 저장 중 문제가 발생했습니다." }, 502);
    }
    const rows = (await result.json()) as Array<Record<string, unknown>>;
    return json({ entry: rows[0] }, 201);
  } catch {
    if (audioPath) await removeAudio(config, audioPath);
    return json({ error: "DB에 연결하지 못했습니다." }, 502);
  }
}

async function prepareAudioUpload(input: PlaylistInput) {
  const fileName = text(input.fileName, 300);
  const fileSize = optionalInteger(input.fileSize, 1, MAX_AUDIO_SIZE);
  const fileType = text(input.fileType, 80);
  if (!fileName || !fileName.toLowerCase().endsWith(".mp3") || fileType !== "audio/mpeg") {
    return json({ error: "MP3 형식의 파일만 등록할 수 있습니다." }, 400);
  }
  if (fileSize === undefined || fileSize === null) {
    return json({ error: "MP3 파일은 25MB 이하만 등록할 수 있습니다." }, 413);
  }

  const config = getSupabaseConfig();
  if (!config) return json({ error: "DB 및 파일 저장소 연결 설정이 완료되지 않았습니다." }, 503);

  const path = `playlist/${crypto.randomUUID()}.mp3`;
  const uploadUrl = await createSignedUploadUrl(config, path);
  if (!uploadUrl) return json({ error: "MP3 업로드를 준비하지 못했습니다." }, 502);

  return json({ upload: { url: uploadUrl, path, filename: cleanFilename(fileName) } }, 200);
}

async function cancelAudioUpload(input: PlaylistInput) {
  const audioPath = text(input.audioPath, 100);
  if (!audioPath || !validAudioPath(audioPath)) return json({ error: "삭제할 파일 정보를 확인해 주세요." }, 400);
  const config = getSupabaseConfig();
  if (!config) return json({ error: "파일 저장소 연결 설정이 완료되지 않았습니다." }, 503);
  await removeAudio(config, audioPath);
  return json({ ok: true }, 200);
}

async function cleanupAudioPath(path: string) {
  const config = getSupabaseConfig();
  if (config) await removeAudio(config, path);
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  return url && secretKey ? { url, secretKey } : null;
}

function supabaseAuthHeaders(config: SupabaseConfig) {
  const headers: Record<string, string> = { apikey: config.secretKey };
  if (config.secretKey.split(".").length === 3) {
    headers.Authorization = `Bearer ${config.secretKey}`;
  }
  return headers;
}

async function createSignedUploadUrl(config: SupabaseConfig, path: string) {
  try {
    const result = await fetch(
      `${config.url}/storage/v1/object/upload/sign/${AUDIO_BUCKET}/${encodeObjectPath(path)}`,
      {
        method: "POST",
        headers: {
          ...supabaseAuthHeaders(config),
          "Content-Type": "application/json",
          "x-upsert": "false",
        },
        body: "{}",
        cache: "no-store",
      },
    );
    if (!result.ok) return null;
    const body = (await result.json()) as { url?: string; signedURL?: string; signedUrl?: string };
    return absoluteStorageUrl(config, body.url ?? body.signedURL ?? body.signedUrl);
  } catch {
    return null;
  }
}

async function removeAudio(config: SupabaseConfig, path: string) {
  try {
    await fetch(`${config.url}/storage/v1/object/${AUDIO_BUCKET}/${encodeObjectPath(path)}`, {
      method: "DELETE",
      headers: supabaseAuthHeaders(config),
    });
  } catch {
    console.error("Supabase audio cleanup failed");
  }
}

async function verifyStoredMp3(config: SupabaseConfig, path: string) {
  const signedUrl = await createSignedPlaybackUrl(config, path);
  if (!signedUrl) return false;
  try {
    const result = await fetch(signedUrl, {
      headers: { Range: "bytes=0-9" },
      cache: "no-store",
    });
    if (!result.ok || !result.body) return false;
    const reader = result.body.getReader();
    const firstChunk = await reader.read();
    await reader.cancel();
    return firstChunk.value ? hasMp3Signature(firstChunk.value) : false;
  } catch {
    return false;
  }
}

async function createSignedPlaybackUrl(config: SupabaseConfig, path: string) {
  try {
    const result = await fetch(
      `${config.url}/storage/v1/object/sign/${AUDIO_BUCKET}/${encodeObjectPath(path)}`,
      {
        method: "POST",
        headers: { ...supabaseAuthHeaders(config), "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
        cache: "no-store",
      },
    );
    if (!result.ok) return null;
    const body = (await result.json()) as { signedURL?: string; signedUrl?: string };
    return absoluteStorageUrl(config, body.signedURL ?? body.signedUrl);
  } catch {
    return null;
  }
}

function absoluteStorageUrl(config: SupabaseConfig, value?: string) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/storage/v1/")) return `${config.url}${value}`;
  return `${config.url}/storage/v1${value.startsWith("/") ? value : `/${value}`}`;
}

function encodeObjectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function validAudioPath(path: string) {
  return /^playlist\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mp3$/i.test(path);
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hasMp3Signature(bytes: Uint8Array) {
  if (bytes.length < 3) return false;
  const hasId3Tag = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasFrameSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return hasId3Tag || hasFrameSync;
}

function cleanFilename(value: string) {
  const basename = value.normalize("NFKC").split(/[\\/]/).pop() ?? "uploaded.mp3";
  const stem = basename.replace(/\.mp3$/i, "").replace(/[^\p{L}\p{N}._ -]/gu, "_").trim().slice(0, 235);
  return `${stem || "uploaded"}.mp3`;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() !== "false" && value !== "0";
  return fallback;
}

function text(value: unknown, max: number, allowEmpty = false) {
  if (typeof value !== "string") return allowEmpty ? "" : null;
  const cleaned = value.trim();
  if ((!cleaned && !allowEmpty) || cleaned.length > max) return null;
  return cleaned;
}

function optionalInteger(value: unknown, min: number, max: number): number | null | undefined {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : undefined;
}

function safeUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
