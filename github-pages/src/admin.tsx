/// <reference types="vite/client" />

import { FormEvent, StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient, Session } from "@supabase/supabase-js";
import "./admin.css";

type PlaylistEntry = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string;
  release_year: number | null;
  music_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  audio_path: string | null;
  audio_filename: string | null;
  audio_size_bytes: number | null;
  created_at?: string;
};

type Notice = { tone: "success" | "error" | "info"; text: string } | null;
type MemberProfile = { username: string; role: string; is_active: boolean };
type DatabaseError = { code?: string };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
  : null;

const genres = ["댄스 팝", "힙합", "R&B", "일렉트로닉", "록", "발라드", "기타"];
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const ADMIN_USERNAME = "seotaiji0324";
const ADMIN_AUTH_EMAIL = `${ADMIN_USERNAME}@admin.seoulwave.app`;

function playlistWriteError(error: DatabaseError, editing: boolean) {
  if (error.code === "23502") return "필수 저장 항목이 비어 있습니다. 입력 내용을 확인해 주세요.";
  if (error.code === "42501") return "관리자 저장 권한을 확인하지 못했습니다. 다시 로그인해 주세요.";
  return editing ? "PLAYLIST 정보를 수정하지 못했습니다." : "PLAYLIST 정보를 저장하지 못했습니다.";
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return <Shell><StatusCard title="연결 설정이 필요합니다" text="GitHub 배포 설정에서 Supabase 공개 연결 키를 확인해 주세요." /></Shell>;
  }
  if (authLoading) {
    return <Shell><StatusCard title="관리자 세션 확인 중" text="보안 연결을 확인하고 있습니다." loading /></Shell>;
  }
  if (!session) return <Login />;
  if (session.user.app_metadata?.role !== "admin") {
    return (
      <Shell>
        <StatusCard title="관리자 권한이 없습니다" text="허용된 SEOULWAVE 관리자 계정으로 다시 로그인해 주세요.">
          <button className="button primary" onClick={() => void supabase.auth.signOut()} type="button">다른 계정으로 로그인</button>
        </StatusCard>
      </Shell>
    );
  }
  return <MemberGate session={session} />;
}

function MemberGate({ session }: { session: Session }) {
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("member")
      .select("username,role,is_active")
      .eq("auth_user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMember(data as MemberProfile | null);
        setLoading(false);
      });
  }, [session.user.id]);

  if (loading) return <Shell><StatusCard title="관리자 권한 확인 중" text="member 테이블과 인증 역할을 확인하고 있습니다." loading /></Shell>;
  if (!member || member.username !== ADMIN_USERNAME || member.role !== "admin" || !member.is_active) {
    return (
      <Shell>
        <StatusCard title="관리자 권한이 없습니다" text="활성화된 SEOULWAVE 관리자 계정으로 다시 로그인해 주세요.">
          <button className="button primary" onClick={() => void supabase?.auth.signOut()} type="button">다른 계정으로 로그인</button>
        </StatusCard>
      </Shell>
    );
  }
  return <Dashboard session={session} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-page">
      <Header />
      <main className="shell">{children}</main>
      <footer>© 2026 SEOULWAVE · SUPABASE AUTH + RLS PROTECTED</footer>
    </div>
  );
}

function Header() {
  return (
    <header>
      <a className="brand" href="/Blog/">SEOUL<span>WAVE</span><sup>®</sup></a>
      <span>GITHUB PAGES / ADMIN</span>
      <a href="/Blog/">블로그로 돌아가기 <b>↗</b></a>
    </header>
  );
}

function StatusCard({ children, loading, text, title }: { children?: React.ReactNode; loading?: boolean; text: string; title: string }) {
  return (
    <section className="status-card">
      <span className="eyebrow">SECURE ADMINISTRATION</span>
      <div className={loading ? "status-icon loading" : "status-icon"}>{loading ? "" : "SW"}</div>
      <h1>{title}</h1>
      <p>{text}</p>
      {children}
    </section>
  );
}

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setSigningIn(true);
    setNotice(null);
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setSigningIn(false);
      setNotice({ tone: "error", text: "관리자 사용자명 또는 비밀번호를 확인해 주세요." });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_AUTH_EMAIL, password });
    setSigningIn(false);
    if (error) {
      setPassword("");
      setNotice({ tone: "error", text: "관리자 사용자명 또는 비밀번호를 확인해 주세요." });
    }
  };

  return (
    <Shell>
      <section className="login-layout">
        <div className="login-intro">
          <p className="eyebrow"><i /> ADMINISTRATION / 인증</p>
          <h1>CURATE<br /><em>THE WAVE.</em></h1>
          <p>승인된 관리자만 PLAYLIST와 MP3 파일을 등록하거나 수정할 수 있습니다.</p>
          <dl>
            <div><dt>01</dt><dd>관리자 사용자명·비밀번호 인증</dd></div>
            <div><dt>02</dt><dd>member·RLS 권한 확인</dd></div>
            <div><dt>03</dt><dd>PLAYLIST 안전 저장</dd></div>
          </dl>
        </div>
        <form className="login-card" onSubmit={signIn}>
          <span>SEOULWAVE CONTROL ROOM</span>
          <h2>관리자 로그인</h2>
          <p>등록된 관리자 사용자명과 비밀번호로 로그인해 주세요.</p>
          <label>
            <span>ADMIN USERNAME</span>
            <input autoCapitalize="none" autoComplete="username" name="username" onChange={(event) => setUsername(event.target.value)} placeholder="관리자 사용자명" required value={username} />
          </label>
          <label>
            <span>PASSWORD</span>
            <input autoComplete="current-password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" required type="password" value={password} />
          </label>
          <button className="button primary" disabled={signingIn} type="submit">{signingIn ? "권한 확인 중..." : "관리자 로그인"}<b>↗</b></button>
          {notice && <p className={`notice ${notice.tone}`} role="status">{notice.text}</p>}
          <small>비밀번호는 Supabase Auth에서만 검증되며 member 테이블이나 브라우저에 저장하지 않습니다.</small>
        </form>
      </section>
    </Shell>
  );
}

function Dashboard({ session }: { session: Session }) {
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState<PlaylistEntry | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loadEntries = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("PlayList")
      .select("id,title,artist,album,genre,release_year,music_url,cover_image_url,description,display_order,is_active,audio_path,audio_filename,audio_size_bytes,created_at")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      setNotice({ tone: "error", text: "PLAYLIST 목록을 불러오지 못했습니다. 관리자 권한을 확인해 주세요." });
      return;
    }
    setEntries((data ?? []) as PlaylistEntry[]);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadEntries(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadEntries]);

  const beginEdit = (entry: PlaylistEntry) => {
    setEditing(entry);
    setAudioFile(null);
    setNotice(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditing(null);
    setAudioFile(null);
    setNotice(null);
    formRef.current?.reset();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setNotice(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const selected = data.get("audioFile");
    const file = selected instanceof File && selected.size > 0 ? selected : null;
    let uploadedPath: string | null = null;

    try {
      if (file) {
        if (file.size > MAX_AUDIO_SIZE) throw new Error("MP3 파일은 25MB 이하만 등록할 수 있습니다.");
        if (!file.name.toLowerCase().endsWith(".mp3") || !(await hasMp3Signature(file))) {
          throw new Error("올바른 MP3 파일만 등록할 수 있습니다.");
        }
        uploadedPath = `playlist/${crypto.randomUUID()}.mp3`;
        const { error } = await supabase.storage.from("kpop-audio").upload(uploadedPath, file, {
          cacheControl: "3600",
          contentType: "audio/mpeg",
          upsert: false,
        });
        if (error) throw new Error("MP3 파일을 저장소에 업로드하지 못했습니다.");
      }

      const removeAudio = data.get("removeAudio") === "on";
      const keepExisting = Boolean(editing && !removeAudio && !uploadedPath);
      const releaseYear = numberOrNull(data.get("releaseYear"));
      const payload = {
        title: textValue(data.get("title")),
        artist: textValue(data.get("artist")),
        album: textValue(data.get("album")) || null,
        genre: textValue(data.get("genre")),
        release_year: releaseYear,
        music_url: textValue(data.get("musicUrl")) || null,
        cover_image_url: textValue(data.get("coverImageUrl")) || null,
        // PlayList.description is NOT NULL; an empty optional description is stored as an empty string.
        description: textValue(data.get("description")),
        display_order: numberOrNull(data.get("displayOrder")) ?? 0,
        is_active: data.get("isActive") === "on",
        created_by: editing ? undefined : session.user.id,
        audio_path: uploadedPath ?? (keepExisting ? editing?.audio_path : null) ?? null,
        audio_filename: file?.name ?? (keepExisting ? editing?.audio_filename : null) ?? null,
        audio_size_bytes: file?.size ?? (keepExisting ? editing?.audio_size_bytes : null) ?? null,
      };

      if (!payload.title || !payload.artist || !payload.genre) throw new Error("필수 곡 정보를 입력해 주세요.");
      const query = editing
        ? supabase.from("PlayList").update(payload).eq("id", editing.id)
        : supabase.from("PlayList").insert(payload);
      const { error } = await query.select("id").single();
      if (error) throw new Error(playlistWriteError(error, Boolean(editing)));

      if (editing?.audio_path && editing.audio_path !== payload.audio_path) {
        await supabase.storage.from("kpop-audio").remove([editing.audio_path]);
      }
      uploadedPath = null;
      setNotice({ tone: "success", text: editing
        ? "PLAYLIST 곡 정보를 수정했습니다. 메인 화면에는 최대 30분 이내 반영됩니다."
        : "MP3와 곡 정보를 저장했습니다. 메인 화면에는 최대 30분 이내 반영됩니다." });
      setEditing(null);
      setAudioFile(null);
      form.reset();
      await loadEntries();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("kpop-audio").remove([uploadedPath]);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow"><i /> ADMINISTRATION / PLAYLIST</p>
          <h1>SHAPE<br /><em>THE SOUND.</em></h1>
        </div>
        <div className="session-card">
          <span>AUTHENTICATED</span>
          <strong>관리자 세션 연결됨</strong>
          <small>SUPABASE AUTH · RLS ACTIVE</small>
          <button onClick={() => void supabase?.auth.signOut()} type="button">로그아웃</button>
        </div>
      </section>

      <section className="workspace">
        <form className={editing ? "playlist-form editing" : "playlist-form"} key={editing?.id ?? "new"} onSubmit={submit} ref={formRef}>
          {editing && <div className="edit-banner"><span>EDIT MODE</span><strong>{editing.artist} — {editing.title}</strong><button onClick={cancelEdit} type="button">수정 취소</button></div>}
          <SectionTitle number="01" title="PLAYLIST 곡 정보" copy={editing ? "선택한 곡 정보를 수정합니다." : "새로운 큐레이션 곡을 등록합니다."} />
          <div className="form-grid">
            <Field label="곡 제목 *"><input defaultValue={editing?.title ?? ""} maxLength={200} name="title" required /></Field>
            <Field label="아티스트 *"><input defaultValue={editing?.artist ?? ""} maxLength={160} name="artist" required /></Field>
            <Field label="앨범명"><input defaultValue={editing?.album ?? ""} maxLength={200} name="album" /></Field>
            <Field label="장르 *"><select defaultValue={editing?.genre ?? ""} name="genre" required><option disabled value="">장르 선택</option>{genres.map((genre) => <option key={genre}>{genre}</option>)}</select></Field>
            <Field label="발매연도"><input defaultValue={editing?.release_year ?? ""} max={2100} min={1990} name="releaseYear" type="number" /></Field>
            <Field label="노출 순서"><input defaultValue={editing?.display_order ?? 0} max={9999} min={0} name="displayOrder" type="number" /></Field>
          </div>

          <SectionTitle number="02" title="오디오와 큐레이션" copy="저작권이 확인된 MP3와 공식 정보를 등록해 주세요." />
          <label className="field full audio-field">
            <span>{editing?.audio_filename ? "MP3 교체파일" : "MP3 첨부파일"}</span>
            <span className="dropzone">
              <input accept=".mp3,audio/mpeg" name="audioFile" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} type="file" />
              <b>♪</b>
              <span><strong>{audioFile?.name ?? editing?.audio_filename ?? "MP3 파일 선택"}</strong><small>{audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : "최대 25MB · MP3 형식"}</small></span>
            </span>
          </label>
          {editing?.audio_filename && <label className="remove-toggle"><input name="removeAudio" type="checkbox" /><span>기존 MP3 파일 제거</span></label>}
          <Field full label="공식 음악 링크 (선택)"><input defaultValue={editing?.music_url ?? ""} maxLength={500} name="musicUrl" placeholder="https://" type="url" /></Field>
          <Field full label="커버 이미지 주소"><input defaultValue={editing?.cover_image_url ?? ""} maxLength={500} name="coverImageUrl" placeholder="https://" type="url" /></Field>
          <Field full label="큐레이션 노트"><textarea defaultValue={editing?.description ?? ""} maxLength={3000} name="description" rows={5} /></Field>
          <label className="publish-toggle"><input aria-label="PLAYLIST에 노출" defaultChecked={editing?.is_active ?? true} name="isActive" type="checkbox" /><span className="switch" /><span><strong>PLAYLIST에 노출</strong><small>해제하면 DB에만 저장됩니다.</small></span></label>
          <div className="form-actions"><p>* 필수 항목 · 파일명에 개인정보를 넣지 마세요.</p><div>{editing && <button className="button secondary" onClick={cancelEdit} type="button">취소</button>}<button className="button primary" disabled={saving} type="submit">{saving ? "업로드 및 저장 중..." : editing ? "수정 내용 저장" : "PlayList에 저장"}<b>↗</b></button></div></div>
        </form>

        <aside className="database-card">
          <span>PLAYLIST DATABASE</span>
          <p className="connected"><i /> SUPABASE CONNECTED</p>
          <dl><div><dt>MODE</dt><dd>{editing ? "EDIT" : "CREATE"}</dd></div><div><dt>TABLE</dt><dd>PlayList</dd></div><div><dt>RECORDS</dt><dd>{String(entries.length).padStart(2, "0")}</dd></div></dl>
          <p>로그인 세션과 데이터 정책이 모두 확인된 요청만 저장됩니다.</p>
          {notice && <div className={`notice-box ${notice.tone}`} role="status"><strong>{notice.tone === "success" ? "SAVE COMPLETE" : "CHECK REQUIRED"}</strong><p>{notice.text}</p></div>}
        </aside>
      </section>

      <section className="manager">
        <div className="manager-heading"><div><p className="eyebrow">DATABASE / 등록 목록</p><h2>REGISTERED PLAYLIST</h2></div><button className="button secondary" disabled={loading} onClick={() => void loadEntries()} type="button">{loading ? "불러오는 중" : "목록 새로고침"}</button></div>
        {loading ? <p className="empty">등록된 PLAYLIST를 불러오고 있습니다.</p> : entries.length === 0 ? <p className="empty">등록된 PLAYLIST 곡이 없습니다.</p> : <div className="entry-list">{entries.map((entry) => <article className={editing?.id === entry.id ? "entry active" : "entry"} key={entry.id}><span className="order">{String(entry.display_order).padStart(2, "0")}</span><div><small>{entry.artist}</small><strong>{entry.title}</strong><span>{entry.genre}{entry.release_year ? ` · ${entry.release_year}` : ""}</span></div><div className="flags"><span className={entry.is_active ? "live" : "hidden"}>{entry.is_active ? "노출 중" : "비노출"}</span>{entry.audio_filename && <small>MP3 · {entry.audio_filename}</small>}</div><button className="button dark" disabled={editing?.id === entry.id} onClick={() => beginEdit(entry)} type="button">{editing?.id === entry.id ? "수정 중" : "수정"}<b>↗</b></button></article>)}</div>}
      </section>
    </Shell>
  );
}

function SectionTitle({ copy, number, title }: { copy: string; number: string; title: string }) {
  return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div>;
}

function Field({ children, full, label }: { children: React.ReactNode; full?: boolean; label: string }) {
  return <label className={full ? "field full" : "field"}><span>{label}</span>{children}</label>;
}

async function hasMp3Signature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  return bytes.length === 3 && ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
}

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = textValue(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isInteger(number) ? number : null;
}

const root = document.getElementById("root");
if (!root) throw new Error("GitHub Pages admin root element is missing.");
createRoot(root).render(<StrictMode><App /></StrictMode>);
