"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

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

type SavedPlaylist = Pick<
  PlaylistEntry,
  "title" | "artist" | "genre" | "release_year" | "display_order" | "audio_filename"
>;

type UploadPreparation = {
  url: string;
  path: string;
  filename: string;
};

const genres = ["댄스 팝", "힙합", "R&B", "일렉트로닉", "록", "발라드", "기타"];
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

export default function PlaylistForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [savedEntry, setSavedEntry] = useState<SavedPlaylist | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState("");
  const [editingEntry, setEditingEntry] = useState<PlaylistEntry | null>(null);
  const [completedAction, setCompletedAction] = useState<"create" | "update" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    setEntriesError("");
    try {
      const result = await fetch("/api/playlist?view=admin", { cache: "no-store" });
      const body = await readApiResponse<{ entries?: PlaylistEntry[] }>(result);
      if (!result.ok || !body.entries) throw new Error(body.error || "PLAYLIST 목록을 불러오지 못했습니다.");
      setEntries(body.entries);
    } catch (error) {
      setEntriesError(error instanceof Error ? error.message : "PLAYLIST 목록을 불러오지 못했습니다.");
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const beginEditing = (entry: PlaylistEntry) => {
    setEditingEntry(entry);
    setAudioFile(null);
    setSavedEntry(null);
    setCompletedAction(null);
    setStatus("idle");
    setMessage("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setAudioFile(null);
    setSavedEntry(null);
    setCompletedAction(null);
    setStatus("idle");
    setMessage("");
  };

  const submitPlaylist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    setSavedEntry(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const selectedAudio = data.get("audioFile");
    const entryBeingEdited = editingEntry;
    let preparedPath: string | null = null;

    try {
      let preparedAudio: UploadPreparation | null = null;
      if (selectedAudio instanceof File && (selectedAudio.size > 0 || selectedAudio.name)) {
        if (selectedAudio.size === 0) throw new Error("비어 있는 MP3 파일은 등록할 수 없습니다.");
        if (selectedAudio.size > MAX_AUDIO_SIZE) throw new Error("MP3 파일은 25MB 이하만 등록할 수 있습니다.");
        if (!selectedAudio.name.toLowerCase().endsWith(".mp3")) throw new Error("MP3 형식의 파일만 등록할 수 있습니다.");
        if (!(await hasMp3Signature(selectedAudio))) throw new Error("올바른 MP3 파일인지 확인해 주세요.");

        const prepareResult = await fetch("/api/playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prepareUpload",
            fileName: selectedAudio.name,
            fileSize: selectedAudio.size,
            fileType: "audio/mpeg",
          }),
        });
        const prepareBody = await readApiResponse<{ upload?: UploadPreparation }>(prepareResult);
        if (!prepareResult.ok || !prepareBody.upload) {
          throw new Error(prepareBody.error || "MP3 업로드를 준비하지 못했습니다.");
        }

        preparedAudio = prepareBody.upload;
        preparedPath = preparedAudio.path;
        const uploadData = new FormData();
        uploadData.append("cacheControl", "3600");
        uploadData.append("", new Blob([selectedAudio], { type: "audio/mpeg" }), selectedAudio.name);
        const uploadResult = await fetch(preparedAudio.url, {
          method: "PUT",
          headers: { "x-upsert": "false" },
          body: uploadData,
        });
        if (!uploadResult.ok) throw new Error("MP3 파일을 저장소에 업로드하지 못했습니다.");
      }

      const keepExistingAudio = Boolean(entryBeingEdited && data.get("removeAudio") !== "on");
      const payload = {
        id: entryBeingEdited?.id,
        title: stringValue(data.get("title")),
        artist: stringValue(data.get("artist")),
        album: stringValue(data.get("album")),
        genre: stringValue(data.get("genre")),
        releaseYear: stringValue(data.get("releaseYear")),
        musicUrl: stringValue(data.get("musicUrl")),
        coverImageUrl: stringValue(data.get("coverImageUrl")),
        description: stringValue(data.get("description")),
        displayOrder: stringValue(data.get("displayOrder")),
        isActive: data.get("isActive") === "on",
        audioPath: preparedAudio?.path ?? (keepExistingAudio ? entryBeingEdited?.audio_path : null) ?? null,
        audioFilename: preparedAudio?.filename ?? (keepExistingAudio ? entryBeingEdited?.audio_filename : null) ?? null,
        audioSizeBytes: selectedAudio instanceof File && preparedAudio
          ? selectedAudio.size
          : (keepExistingAudio ? entryBeingEdited?.audio_size_bytes : null) ?? null,
      };

      const result = await fetch("/api/playlist", {
        method: entryBeingEdited ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readApiResponse<{ entry?: SavedPlaylist }>(result);
      if (!result.ok || !body.entry) throw new Error(body.error || "저장하지 못했습니다.");

      preparedPath = null;
      setStatus("success");
      setCompletedAction(entryBeingEdited ? "update" : "create");
      setMessage(entryBeingEdited
        ? "PLAYLIST 곡 정보를 수정했습니다."
        : body.entry.audio_filename
          ? "MP3 파일과 곡 정보를 안전하게 저장했습니다."
          : "Supabase의 PlayList 테이블에 저장했습니다.");
      setSavedEntry(body.entry);
      setEditingEntry(null);
      form.reset();
      setAudioFile(null);
      await loadEntries();
    } catch (error) {
      if (preparedPath) await cancelPreparedUpload(preparedPath);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  };

  return (
    <>
      <div className="admin-workspace">
        <form
          className={`admin-form${editingEntry ? " editing" : ""}`}
          key={editingEntry?.id ?? "new-playlist"}
          onSubmit={submitPlaylist}
          ref={formRef}
        >
          {editingEntry && (
            <div className="edit-mode-banner">
              <span>EDIT MODE</span>
              <strong>{editingEntry.artist} — {editingEntry.title}</strong>
              <button onClick={cancelEditing} type="button">수정 취소</button>
            </div>
          )}

          <div className="form-section-title">
            <span>01</span>
            <div>
              <h2>PLAYLIST 곡 정보</h2>
              <p>{editingEntry ? "선택한 곡의 정보를 수정합니다." : "메인 PLAYLIST에 노출할 곡을 등록합니다."}</p>
            </div>
          </div>

          <div className="form-grid">
            <label><span>곡 제목 *</span><input defaultValue={editingEntry?.title ?? ""} name="title" maxLength={200} required /></label>
            <label><span>아티스트 *</span><input defaultValue={editingEntry?.artist ?? ""} name="artist" maxLength={160} required /></label>
            <label><span>앨범명</span><input defaultValue={editingEntry?.album ?? ""} name="album" maxLength={200} /></label>
            <label>
              <span>장르 *</span>
              <select name="genre" defaultValue={editingEntry?.genre ?? ""} required>
                <option value="" disabled>장르 선택</option>
                {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
              </select>
            </label>
            <label><span>발매연도</span><input defaultValue={editingEntry?.release_year ?? ""} name="releaseYear" min={1990} max={2100} type="number" /></label>
            <label><span>노출 순서</span><input defaultValue={editingEntry?.display_order ?? 0} name="displayOrder" min={0} max={9999} type="number" /></label>
          </div>

          <div className="form-section-title second">
            <span>02</span>
            <div><h2>오디오와 큐레이션</h2><p>저작권이 확인된 MP3 또는 공식 음악 링크를 등록해 주세요.</p></div>
          </div>

          <label className="field-wide audio-upload">
            <span>{editingEntry?.audio_filename ? "MP3 교체파일" : "MP3 첨부파일"}</span>
            <span className="audio-upload-box">
              <input
                accept=".mp3,audio/mpeg"
                aria-describedby="audio-upload-help"
                name="audioFile"
                onChange={(event) => setAudioFile(event.currentTarget.files?.[0] ?? null)}
                type="file"
              />
              <span>
                <strong>{audioFile ? audioFile.name : editingEntry?.audio_filename ?? "MP3 파일 선택"}</strong>
                <small>{audioFile
                  ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB`
                  : editingEntry?.audio_filename
                    ? "새 파일을 선택하지 않으면 기존 MP3를 유지합니다"
                    : "클릭하여 음악 파일을 첨부하세요"}</small>
              </span>
            </span>
            <small className="field-help" id="audio-upload-help">최대 25MB · MP3만 가능 · 파일명에 개인정보를 넣지 마세요.</small>
          </label>

          {editingEntry?.audio_filename && (
            <label className="remove-audio-toggle">
              <input name="removeAudio" type="checkbox" />
              <span>기존 MP3 파일 제거</span>
            </label>
          )}

          <label className="field-wide"><span>공식 음악 링크 (선택)</span><input defaultValue={editingEntry?.music_url ?? ""} name="musicUrl" maxLength={500} placeholder="https://" type="url" /></label>
          <label className="field-wide"><span>커버 이미지 주소</span><input defaultValue={editingEntry?.cover_image_url ?? ""} name="coverImageUrl" maxLength={500} placeholder="https://" type="url" /></label>
          <label className="field-wide"><span>큐레이션 노트</span><textarea defaultValue={editingEntry?.description ?? ""} name="description" maxLength={3000} rows={5} /></label>

          <label className="publish-toggle">
            <input aria-label="PLAYLIST에 노출" defaultChecked={editingEntry?.is_active ?? true} name="isActive" type="checkbox" />
            <span className="toggle-track" aria-hidden="true" />
            <span><strong>PLAYLIST에 노출</strong><small>해제하면 DB에는 저장되지만 화면에는 표시되지 않습니다.</small></span>
          </label>

          <div className="admin-submit-row">
            <p>필수 항목은 *로 표시됩니다.</p>
            <div className="admin-submit-actions">
              {editingEntry && <button className="button button-light" onClick={cancelEditing} type="button">취소</button>}
              <button className="button button-dark" disabled={status === "saving"} type="submit">
                {status === "saving"
                  ? "업로드 및 저장 중..."
                  : editingEntry
                    ? "수정 내용 저장"
                    : "PlayList에 저장"} <span>↗</span>
              </button>
            </div>
          </div>
        </form>

        <aside className="admin-sidecard">
          <span className="sidecard-label">PLAYLIST DATABASE</span>
          <div className="db-pulse"><i /> SUPABASE CONNECTED</div>
          <dl>
            <div><dt>MODE</dt><dd>{editingEntry ? "EDIT" : "CREATE"}</dd></div>
            <div><dt>TABLE</dt><dd>PlayList</dd></div>
            <div><dt>RECORDS</dt><dd>{String(entries.length).padStart(2, "0")}</dd></div>
          </dl>
          <p>아래 등록 목록에서 수정 버튼을 누르면 기존 정보가 입력 폼에 자동으로 표시됩니다.</p>
          {message && (
            <div className={`save-message ${status}`} role="status" aria-live="polite">
              <strong>{status === "success" ? (completedAction === "update" ? "UPDATE COMPLETE" : "SAVE COMPLETE") : "CHECK REQUIRED"}</strong>
              <p>{message}</p>
              {savedEntry && (
                <div className="saved-record">
                  <span>{savedEntry.artist}</span><strong>{savedEntry.title}</strong>
                  <small>{savedEntry.genre} / ORDER {savedEntry.display_order}</small>
                  {savedEntry.audio_filename && <small>MP3 / {savedEntry.audio_filename}</small>}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="playlist-manager" aria-labelledby="playlist-manager-title">
        <div className="playlist-manager-heading">
          <div>
            <p className="eyebrow">DATABASE / 등록 목록</p>
            <h2 id="playlist-manager-title">REGISTERED PLAYLIST</h2>
          </div>
          <button className="button button-light" disabled={entriesLoading} onClick={() => void loadEntries()} type="button">
            {entriesLoading ? "불러오는 중" : "목록 새로고침"}
          </button>
        </div>

        {entriesError ? (
          <p className="playlist-manager-state error" role="alert">{entriesError}</p>
        ) : entriesLoading ? (
          <p className="playlist-manager-state">등록된 PLAYLIST를 불러오고 있습니다.</p>
        ) : entries.length === 0 ? (
          <p className="playlist-manager-state">아직 등록된 PLAYLIST 곡이 없습니다.</p>
        ) : (
          <div className="playlist-admin-list">
            {entries.map((entry) => (
              <article className={`playlist-admin-item${editingEntry?.id === entry.id ? " active" : ""}`} key={entry.id}>
                <div className="playlist-admin-order">{String(entry.display_order).padStart(2, "0")}</div>
                <div className="playlist-admin-copy">
                  <span>{entry.artist}</span>
                  <strong>{entry.title}</strong>
                  <small>{entry.genre}{entry.release_year ? ` / ${entry.release_year}` : ""}</small>
                </div>
                <div className="playlist-admin-flags">
                  <span className={entry.is_active ? "published" : "hidden"}>{entry.is_active ? "노출 중" : "비노출"}</span>
                  {entry.audio_filename && <small>MP3 · {entry.audio_filename}</small>}
                </div>
                <button className="button button-dark" disabled={editingEntry?.id === entry.id} onClick={() => beginEditing(entry)} type="button">
                  {editingEntry?.id === entry.id ? "수정 중" : "수정"} <span>↗</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

async function hasMp3Signature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  if (bytes.length < 3) return false;
  return (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
    || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
}

async function readApiResponse<T>(response: Response): Promise<T & { error?: string }> {
  const raw = await response.text();
  if (!raw) return {} as T & { error?: string };
  try {
    return JSON.parse(raw) as T & { error?: string };
  } catch {
    const error = response.status === 413
      ? "파일이 서버 요청 한도를 초과했습니다. 다시 선택해 주세요."
      : response.ok
        ? "서버 응답을 처리하지 못했습니다."
        : `요청을 처리하지 못했습니다. (${response.status})`;
    return { error } as T & { error?: string };
  }
}

async function cancelPreparedUpload(audioPath: string) {
  try {
    await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancelUpload", audioPath }),
    });
  } catch {
    // Best-effort cleanup. The private object remains inaccessible if cleanup is interrupted.
  }
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}
