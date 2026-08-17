import type { Metadata } from "next";
import AdminDashboard from "./AdminDashboard";
import { chatGPTSignInPath, getChatGPTUser, isLocalDevelopmentUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자 등록 — SEOULWAVE",
  description: "SEOULWAVE K-pop 콘텐츠를 Supabase에 등록하는 관리자 페이지",
};

export default async function AdminPage() {
  const user = await getChatGPTUser();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const localDevelopment = isLocalDevelopmentUser(user);
  const authorized = Boolean(
    localDevelopment || (user && adminEmail && user.email.trim().toLowerCase() === adminEmail),
  );

  return (
    <>
      <header className="admin-header">
        <a className="brand" href="/">SEOUL<span>WAVE</span><sup>®</sup></a>
        <span>CONTENT ADMIN / 관리자</span>
        <a href="/">블로그로 돌아가기 →</a>
      </header>

      <main className="admin-shell">
        <div className="admin-hero">
          <p className="eyebrow"><span>ADMIN</span> DATABASE REGISTRATION</p>
          <h1>K-POP<br />CONTENT <em>DROP.</em></h1>
          <p>새로운 K-pop 소개 콘텐츠를 등록하면 Supabase의 <code>kpopList</code> 테이블에 안전하게 저장됩니다.</p>
        </div>

        {localDevelopment && (
          <div className="local-dev-notice" role="status">
            <strong>LOCAL DEVELOPMENT MODE</strong>
            <span>개발 서버에서는 플랫폼 로그인 없이 관리자 화면을 확인할 수 있습니다. 운영 배포에는 적용되지 않습니다.</span>
          </div>
        )}

        {authorized ? (
          <AdminDashboard />
        ) : (
          <section className="admin-locked">
            <span aria-hidden="true">✦</span>
            <p className="eyebrow">ADMIN ACCESS REQUIRED</p>
            <h2>관리자 확인이 필요합니다.</h2>
            <p>
              {user
                ? "현재 로그인 계정이 관리자 허용 목록과 일치하지 않습니다."
                : "ChatGPT 계정으로 로그인한 뒤 다시 시도해 주세요."}
            </p>
            {!user && (
              <a className="button button-dark" href={chatGPTSignInPath("/admin")}>
                관리자 로그인 <span>↗</span>
              </a>
            )}
          </section>
        )}
      </main>

      <footer className="admin-footer">
        <small>SEOULWAVE ADMIN / PROTECTED WRITE ACCESS</small>
        <small>SUPABASE · kpopList</small>
      </footer>
    </>
  );
}
