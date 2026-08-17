"use client";

import { useState } from "react";
import AdminForm from "./AdminForm";
import PlaylistForm from "./PlaylistForm";

export default function AdminDashboard() {
  const [section, setSection] = useState<"content" | "playlist">("playlist");

  return (
    <section>
      <div className="admin-tabs" role="tablist" aria-label="관리자 등록 종류">
        <button
          aria-selected={section === "playlist"}
          className={section === "playlist" ? "active" : ""}
          onClick={() => setSection("playlist")}
          role="tab"
          type="button"
        >
          <span>01</span> PLAYLIST 등록
        </button>
        <button
          aria-selected={section === "content"}
          className={section === "content" ? "active" : ""}
          onClick={() => setSection("content")}
          role="tab"
          type="button"
        >
          <span>02</span> 콘텐츠 등록
        </button>
      </div>
      <div role="tabpanel">
        {section === "playlist" ? <PlaylistForm /> : <AdminForm />}
      </div>
    </section>
  );
}
