"use client";

import { FormEvent, useState } from "react";

type SavedEntry = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  release_year: number | null;
  is_published: boolean;
  created_at: string;
};

const genres = [
  "댄스 팝",
  "힙합",
  "R&B",
  "일렉트로닉",
  "록",
  "발라드",
  "기타",
];

export default function AdminForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [savedEntry, setSavedEntry] = useState<SavedEntry | null>(null);

  const submitEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    setSavedEntry(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      title: formData.get("title"),
      artist: formData.get("artist"),
      genre: formData.get("genre"),
      releaseYear: formData.get("releaseYear"),
      description: formData.get("description"),
      musicUrl: formData.get("musicUrl"),
      isPublished: formData.get("isPublished") === "on",
    };

    try {
      const result = await fetch("/api/kpop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await result.json()) as { entry?: SavedEntry; error?: string };

      if (!result.ok || !body.entry) {
        throw new Error(body.error || "저장하지 못했습니다.");
      }

      setStatus("success");
      setMessage("Supabase의 kpopList 테이블에 저장했습니다.");
      setSavedEntry(body.entry);
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  };

  return (
    <div className="admin-workspace">
      <form className="admin-form" onSubmit={submitEntry}>
        <div className="form-section-title">
          <span>01</span>
          <div>
            <h2>기본 정보</h2>
            <p>블로그에서 소개할 곡과 아티스트 정보를 입력합니다.</p>
          </div>
        </div>

        <div className="form-grid">
          <label>
            <span>곡 제목 *</span>
            <input name="title" maxLength={200} placeholder="예: Super Shy" required />
          </label>
          <label>
            <span>아티스트 *</span>
            <input name="artist" maxLength={160} placeholder="예: NewJeans" required />
          </label>
          <label>
            <span>장르 *</span>
            <select name="genre" defaultValue="" required>
              <option value="" disabled>장르 선택</option>
              {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
            </select>
          </label>
          <label>
            <span>발매연도</span>
            <input name="releaseYear" inputMode="numeric" min={1990} max={2100} placeholder="2026" type="number" />
          </label>
        </div>

        <div className="form-section-title second">
          <span>02</span>
          <div>
            <h2>소개 콘텐츠</h2>
            <p>민감정보나 권리가 확인되지 않은 내부 자료는 입력하지 마세요.</p>
          </div>
        </div>

        <label className="field-wide">
          <span>소개글</span>
          <textarea name="description" maxLength={3000} placeholder="곡의 매력, 사운드, 퍼포먼스 포인트를 소개해 주세요." rows={6} />
        </label>

        <label className="field-wide">
          <span>음악 링크</span>
          <input name="musicUrl" maxLength={500} placeholder="https://" type="url" />
        </label>

        <label className="publish-toggle">
          <input name="isPublished" type="checkbox" />
          <span className="toggle-track" aria-hidden="true" />
          <span><strong>바로 공개</strong><small>체크하지 않으면 비공개 초안으로 저장됩니다.</small></span>
        </label>

        <div className="admin-submit-row">
          <p>필수 항목은 *로 표시됩니다.</p>
          <button className="button button-dark" disabled={status === "saving"} type="submit">
            {status === "saving" ? "저장 중..." : "kpopList에 저장"} <span>↗</span>
          </button>
        </div>
      </form>

      <aside className="admin-sidecard">
        <span className="sidecard-label">DATABASE STATUS</span>
        <div className="db-pulse"><i /> SUPABASE CONNECTED</div>
        <dl>
          <div><dt>PROJECT</dt><dd>BlogProject</dd></div>
          <div><dt>TABLE</dt><dd>kpopList</dd></div>
          <div><dt>ACCESS</dt><dd>ADMIN ONLY</dd></div>
        </dl>
        <p>입력값은 서버에서 검증된 후 데이터베이스에 저장됩니다.</p>

        {message && (
          <div className={`save-message ${status}`} role="status" aria-live="polite">
            <strong>{status === "success" ? "SAVE COMPLETE" : "CHECK REQUIRED"}</strong>
            <p>{message}</p>
            {savedEntry && (
              <div className="saved-record">
                <span>{savedEntry.artist}</span>
                <strong>{savedEntry.title}</strong>
                <small>{savedEntry.genre} / {savedEntry.release_year ?? "연도 미입력"}</small>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
