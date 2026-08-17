"use client";

import { FormEvent, useState } from "react";

type SavedPlaylist = {
  title: string;
  artist: string;
  genre: string;
  release_year: number | null;
  display_order: number;
  audio_filename?: string | null;
};

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

  const submitPlaylist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    setSavedEntry(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const selectedAudio = data.get("audioFile");
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

      const payload = {
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
        audioPath: preparedAudio?.path ?? null,
        audioFilename: preparedAudio?.filename ?? null,
        audioSizeBytes: selectedAudio instanceof File && preparedAudio ? selectedAudio.size : null,
      };

      const result = await fetch("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readApiResponse<{ entry?: SavedPlaylist }>(result);
      if (!result.ok || !body.entry) throw new Error(body.error || "저장하지 못했습니다.");

      preparedPath = null;
      setStatus("success");
      setMessage(body.entry.audio_filename
        ? "MP3 파일과 곡 정보를 안전하게 저장했습니다."
        : "Supabase의 PlayList 테이블에 저장했습니다.");
      setSavedEntry(body.entry);
      form.reset();
      setAudioFile(null);
    } catch (error) {
      if (preparedPath) await cancelPreparedUpload(preparedPath);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  };

  return (
    <div className="admin-workspace">
      <form className="admin-form" onSubmit={submitPlaylist}>
        <div className="form-section-title">
          <span>01</span>
          <div><h2>PLAYLIST 곡 정보</h2><p>메인 PLAYLIST에 노출할 곡을 등록합니다.</p></div>
        </div>

        <div className="form-grid">
          <label><span>곡 제목 *</span><input name="title" maxLength={200} required /></label>
          <label><span>아티스트 *</span><input name="artist" maxLength={160} required /></label>
          <label><span>앨범명</span><input name="album" maxLength={200} /></label>
          <label>
            <span>장르 *</span>
            <select name="genre" defaultValue="" required>
              <option value="" disabled>장르 선택</option>
              {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
            </select>
          </label>
          <label><span>발매연도</span><input name="releaseYear" min={1990} max={2100} type="number" /></label>
          <label><span>노출 순서</span><input name="displayOrder" min={0} max={9999} type="number" defaultValue={0} /></label>
        </div>

        <div className="form-section-title second">
          <span>02</span>
          <div><h2>오디오와 큐레이션</h2><p>저작권이 확인된 MP3 또는 공식 음악 링크를 등록해 주세요.</p></div>
        </div>

        <label className="field-wide audio-upload">
          <span>MP3 첨부파일</span>
          <span className="audio-upload-box">
            <input
              accept=".mp3,audio/mpeg"
              aria-describedby="audio-upload-help"
              name="audioFile"
              onChange={(event) => setAudioFile(event.currentTarget.files?.[0] ?? null)}
              type="file"
            />
            <span>
              <strong>{audioFile ? audioFile.name : "MP3 파일 선택"}</strong>
              <small>{audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : "클릭하여 음악 파일을 첨부하세요"}</small>
            </span>
          </span>
          <small className="field-help" id="audio-upload-help">최대 25MB · MP3만 가능 · 파일명에 개인정보를 넣지 마세요.</small>
        </label>
        <label className="field-wide"><span>공식 음악 링크 (선택)</span><input name="musicUrl" maxLength={500} placeholder="https://" type="url" /></label>
        <label className="field-wide"><span>커버 이미지 주소</span><input name="coverImageUrl" maxLength={500} placeholder="https://" type="url" /></label>
        <label className="field-wide"><span>큐레이션 노트</span><textarea name="description" maxLength={3000} rows={5} /></label>

        <label className="publish-toggle">
          <input aria-label="PLAYLIST에 노출" name="isActive" type="checkbox" defaultChecked />
          <span className="toggle-track" aria-hidden="true" />
          <span><strong>PLAYLIST에 노출</strong><small>해제하면 DB에는 저장되지만 화면에는 표시되지 않습니다.</small></span>
        </label>

        <div className="admin-submit-row">
          <p>필수 항목은 *로 표시됩니다.</p>
          <button className="button button-dark" disabled={status === "saving"} type="submit">
            {status === "saving" ? "업로드 및 저장 중..." : "PlayList에 저장"} <span>↗</span>
          </button>
        </div>
      </form>

      <aside className="admin-sidecard">
        <span className="sidecard-label">PLAYLIST DATABASE</span>
        <div className="db-pulse"><i /> SUPABASE CONNECTED</div>
        <dl>
          <div><dt>PROJECT</dt><dd>BlogProject</dd></div>
          <div><dt>TABLE</dt><dd>PlayList</dd></div>
          <div><dt>SORT</dt><dd>DISPLAY ORDER</dd></div>
        </dl>
        <p>활성 상태로 저장된 곡은 메인 PLAYLIST에 순서대로 표시됩니다.</p>
        {message && (
          <div className={`save-message ${status}`} role="status" aria-live="polite">
            <strong>{status === "success" ? "SAVE COMPLETE" : "CHECK REQUIRED"}</strong>
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
