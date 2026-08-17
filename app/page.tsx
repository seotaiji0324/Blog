"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Story = {
  id: string;
  issue: string;
  category: "입문" | "사운드" | "퍼포먼스" | "팬덤";
  englishCategory: string;
  title: string;
  summary: string;
  readTime: string;
  cover: string;
  image: string;
  imageAlt: string;
  note: string;
};

const stories: Story[] = [
  {
    id: "01",
    issue: "START HERE",
    category: "입문",
    englishCategory: "GUIDE",
    title: "처음 만나는 K-pop, 무엇부터 들을까?",
    summary: "멜로디, 퍼포먼스, 세계관. 취향을 찾는 가장 쉬운 세 갈래 입문 지도.",
    readTime: "4 MIN",
    cover: "cover-coral",
    image: "/story-01-discover.png",
    imageAlt: "코발트 조명의 레코드 숍에서 음악을 탐색하는 가상의 K-pop 팬",
    note: "한 곡의 후렴을 먼저 듣고, 무대 영상으로 안무를 본 뒤, 앨범 전체의 흐름을 따라가 보세요. K-pop은 소리와 이미지가 함께 완성되는 장르이기 때문에 이 세 단계를 오갈 때 매력이 가장 선명해집니다.",
  },
  {
    id: "02",
    issue: "SONIC LAYERS",
    category: "사운드",
    englishCategory: "SOUND",
    title: "한 곡 안에서 장르가 바뀌는 순간",
    summary: "힙합에서 일렉트로닉으로, 다시 팝으로. 역동적인 송폼을 듣는 방법.",
    readTime: "6 MIN",
    cover: "cover-blue",
    image: "/story-02-sound.png",
    imageAlt: "푸른빛 녹음실의 믹싱 콘솔에서 사운드를 만드는 가상의 K-pop 프로듀서",
    note: "벌스와 프리코러스, 후렴의 리듬이 어떻게 달라지는지 표시하며 들어보세요. 서로 다른 장르를 이어 붙이는 전환부와, 모든 파트를 하나로 묶는 반복 훅이 K-pop 프로덕션의 긴장감을 만듭니다.",
  },
  {
    id: "03",
    issue: "ON STAGE",
    category: "퍼포먼스",
    englishCategory: "PERFORMANCE",
    title: "카메라까지 춤추게 만드는 안무",
    summary: "포인트 안무, 대형 변화, 표정 연기까지 무대를 읽는 세 가지 시선.",
    readTime: "5 MIN",
    cover: "cover-lime",
    image: "/story-03-performance.png",
    imageAlt: "미래적인 무대에서 군무를 펼치는 가상의 5인조 K-pop 퍼포먼스 그룹",
    note: "전체 대형을 보는 고정 카메라와 표정을 담는 방송 카메라를 번갈아 비교해 보세요. 같은 안무도 시선의 방향과 화면 전환에 따라 전혀 다른 장면으로 읽힙니다.",
  },
  {
    id: "04",
    issue: "FAN LANGUAGE",
    category: "팬덤",
    englishCategory: "CULTURE",
    title: "응원봉에서 떼창까지, 함께 만드는 무대",
    summary: "관객이 소비자를 넘어 공연의 일부가 되는 K-pop 팬 문화 이야기.",
    readTime: "7 MIN",
    cover: "cover-violet",
    image: "/story-04-fandom.png",
    imageAlt: "푸른빛 응원봉을 들고 공연을 함께 즐기는 K-pop 팬들",
    note: "팬 컬러, 응원법, 생일 광고처럼 팬덤은 음악 밖에서도 고유한 언어를 만듭니다. 이 문화는 지역마다 새롭게 번역되며 K-pop을 세계적인 참여형 경험으로 확장합니다.",
  },
  {
    id: "05",
    issue: "VOCAL FOCUS",
    category: "사운드",
    englishCategory: "SOUND",
    title: "목소리가 겹칠 때 생기는 색",
    summary: "리드, 하모니, 애드리브를 따라가며 그룹 보컬의 층을 발견해 보세요.",
    readTime: "5 MIN",
    cover: "cover-yellow",
    image: "/story-05-vocal.png",
    imageAlt: "어두운 스튜디오에서 헤드폰을 쓰고 노래하는 가상의 K-pop 보컬리스트",
    note: "처음에는 리드 보컬만, 두 번째에는 코러스와 낮게 깔린 화음을 들어보세요. 마지막 후렴에서 더해지는 애드리브까지 찾으면 한 곡의 감정선이 어떻게 커지는지 느낄 수 있습니다.",
  },
  {
    id: "06",
    issue: "VISUAL CODE",
    category: "퍼포먼스",
    englishCategory: "VISUAL",
    title: "3분의 뮤직비디오에 숨은 세계",
    summary: "색, 오브제, 편집 리듬으로 읽는 K-pop 비주얼 스토리텔링.",
    readTime: "8 MIN",
    cover: "cover-red",
    image: "/story-06-visual.png",
    imageAlt: "거울과 크롬 오브제가 있는 미래적인 뮤직비디오 세트의 가상 퍼포머",
    note: "반복해서 등장하는 색과 오브제를 메모해 보세요. 가사와 직접 연결되지 않는 이미지도 편집의 속도와 화면 구도를 통해 곡의 정서를 강화하고 다음 이야기의 단서가 됩니다.",
  },
];

type PlaylistTrack = {
  id?: string;
  artist: string;
  title: string;
  mood: string;
  year: string;
  musicUrl?: string | null;
  uploadedAudio?: boolean;
};

const categories = ["전체", "입문", "사운드", "퍼포먼스", "팬덤"] as const;
const GITHUB_PAGES_BASE = "/Blog";

function isGitHubPagesDeployment() {
  return typeof window !== "undefined"
    && (window.location.hostname === "seotaiji0324.github.io" || window.location.pathname.startsWith(`${GITHUB_PAGES_BASE}/`));
}

function publicPath(path: string) {
  return isGitHubPagesDeployment() ? `${GITHUB_PAGES_BASE}${path}` : path;
}

function adminPath() {
  return isGitHubPagesDeployment() ? publicPath("/admin/") : "/admin";
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("전체");
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queuePlaying, setQueuePlaying] = useState(false);
  const [queueRepeat, setQueueRepeat] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const queueAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let active = true;
    const pagesDeployment = isGitHubPagesDeployment();
    const playlistBridge = pagesDeployment ? window.__SEOULWAVE_PLAYLIST__ : undefined;

    const applyPlaylist = (body: { entries?: Array<Record<string, unknown>> }) => {
      if (!active || !body.entries) return;
      setPlaylistTracks(
        body.entries.map((entry) => ({
          id: String(entry.id),
          title: String(entry.title),
          artist: String(entry.artist),
          mood: String(entry.genre),
          year: entry.release_year ? String(entry.release_year) : "—",
          musicUrl: entry.playback_url
            ? String(entry.playback_url)
            : entry.music_url
              ? String(entry.music_url)
              : null,
          uploadedAudio: Boolean(entry.audio_path && entry.playback_url),
        })),
      );
    };

    const loadPlaylist = async () => {
      try {
        if (playlistBridge) {
          applyPlaylist(await playlistBridge.load());
          return;
        }
        const response = await fetch(publicPath(pagesDeployment ? "/playlist.json" : "/api/playlist"), { cache: "no-store" });
        applyPlaylist(await response.json());
      } catch {
        if (!pagesDeployment || !playlistBridge) return;
        try {
          const fallback = await fetch(publicPath("/playlist.json"), { cache: "no-store" });
          applyPlaylist(await fallback.json());
        } catch {
          // Keep the last successfully loaded playlist if both live and snapshot sources fail.
        }
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadPlaylist();
    };

    void loadPlaylist();
    const unsubscribe = playlistBridge?.subscribe(() => void loadPlaylist());
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      unsubscribe?.();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const filteredStories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return stories.filter((story) => {
      const matchesCategory = activeCategory === "전체" || story.category === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        `${story.title} ${story.summary} ${story.category} ${story.englishCategory}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const playableQueue = useMemo(
    () => queue
      .map((title) => playlistTracks.find((track) => track.title === title))
      .filter((track): track is PlaylistTrack => Boolean(track?.uploadedAudio && track.musicUrl)),
    [playlistTracks, queue],
  );
  const currentQueueTrack = playableQueue[queueIndex] ?? playableQueue[0] ?? null;

  const toggleQueue = (title: string) => {
    setQueue((current) => {
      if (!current.includes(title)) return [...current, title];
      if (currentQueueTrack?.title === title) {
        queueAudioRef.current?.pause();
        setQueuePlaying(false);
        setQueueIndex(0);
      }
      return current.filter((item) => item !== title);
    });
  };

  const toggleQueuePlayback = async () => {
    const audio = queueAudioRef.current;
    if (!audio || !currentQueueTrack?.musicUrl) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (audio.dataset.trackTitle !== currentQueueTrack.title) {
      audio.src = currentQueueTrack.musicUrl;
      audio.dataset.trackTitle = currentQueueTrack.title;
      audio.load();
    }
    document.querySelectorAll<HTMLAudioElement>("#playlist .track-audio").forEach((item) => item.pause());
    try {
      await audio.play();
      setQueuePlaying(true);
    } catch {
      setQueuePlaying(false);
    }
  };

  const advanceQueue = (audio = queueAudioRef.current) => {
    if (!audio || playableQueue.length === 0) return;
    const activeIndex = Math.max(0, playableQueue.findIndex((track) => track.title === currentQueueTrack?.title));
    const reachedEnd = activeIndex >= playableQueue.length - 1;
    if (reachedEnd && !queueRepeat) {
      audio.pause();
      audio.currentTime = 0;
      setQueuePlaying(false);
      return;
    }
    const nextIndex = reachedEnd ? 0 : activeIndex + 1;
    const nextTrack = playableQueue[nextIndex];
    if (!nextTrack?.musicUrl) return;
    setQueueIndex(nextIndex);
    audio.src = nextTrack.musicUrl;
    audio.dataset.trackTitle = nextTrack.title;
    audio.load();
    audio.currentTime = 0;
    void audio.play()
      .then(() => setQueuePlaying(true))
      .catch(() => setQueuePlaying(false));
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <a className="skip-link" href="#main-content">본문 바로가기</a>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          <span>NEW WAVE / LIVE NOW / SEOUL 37.5665° N</span>
          <span>NEW WAVE / LIVE NOW / SEOUL 37.5665° N</span>
          <span>NEW WAVE / LIVE NOW / SEOUL 37.5665° N</span>
        </div>
      </div>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Seoulwave 홈">
          SEOUL<span>WAVE</span><sup>®</sup>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#stories">STORIES</a>
          <a href="#playlist">PLAYLIST</a>
          <a href="#culture">CULTURE</a>
          <a href={adminPath()}>ADMIN</a>
        </nav>
        <a className="header-cta" href="#letter">WEEKLY DROP <span aria-hidden="true">↗</span></a>
      </header>

      <main id="main-content">
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow"><span>ISSUE 001</span> THE NEXT GENERATION</p>
            <h1>K-POP<br />BEYOND<br /><em>THE FRAME.</em></h1>
            <p className="hero-description">
              사운드와 퍼포먼스, 서울의 밤이 만나는 순간.<br />지금 가장 선명한 K-pop을 기록하는 디지털 매거진.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="#stories">이야기 탐색하기 <span>↘</span></a>
              <a className="text-link" href="#playlist">{playlistTracks.length}곡으로 시작하기 <span>→</span></a>
            </div>
          </div>

          <div className="hero-art">
            <img
              alt="코발트 조명 아래 공연하는 가상의 K-pop 퍼포먼스 그룹"
              className="hero-photo"
              fetchPriority="high"
              src={publicPath("/hero-stage-v2.png")}
            />
            <div className="hero-image-meta" aria-hidden="true">
              <span>SEOUL / 22:14</span>
              <span>LIVE SIGNAL 001</span>
            </div>
          </div>
        </section>

        <section className="issue-strip" aria-label="이번 호 요약">
          <div><span>CURATED STORIES</span><strong>06</strong></div>
          <div><span>SOUNDS TO EXPLORE</span><strong>{String(playlistTracks.length).padStart(2, "0")}</strong></div>
          <div><span>LANGUAGE</span><strong>KR / EN</strong></div>
          <div className="issue-stamp"><span>NEW DROP</span><strong>MONDAY</strong></div>
        </section>

        <section className="stories section-shell" id="stories">
          <div className="section-heading">
            <div>
              <p className="eyebrow">EDITOR&apos;S PICK / 에디터 추천</p>
              <h2>READ THE<br /><em>WAVE</em></h2>
            </div>
            <p className="section-intro">
              좋아하는 한 곡을 더 깊게 만드는 여섯 가지 관점. 익숙한 무대도 새로운 귀와 눈으로 다시 만나보세요.
            </p>
          </div>

          <div className="story-tools">
            <div className="filters" aria-label="글 카테고리 필터">
              {categories.map((category) => (
                <button
                  className={activeCategory === category ? "active" : ""}
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>
            <form className="search" onSubmit={submitSearch} role="search">
              <label className="sr-only" htmlFor="story-search">블로그 글 검색</label>
              <input
                id="story-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SEARCH STORIES"
                type="search"
                value={query}
              />
              <button type="submit" aria-label="검색">⌕</button>
            </form>
          </div>

          <div className="story-grid" aria-live="polite">
            {filteredStories.map((story) => (
              <article className="story-card" key={story.id}>
                <div className={`story-cover ${story.cover}`}>
                  <Image
                    alt={story.imageAlt}
                    className="story-cover-image"
                    fill
                    sizes="(max-width: 700px) 100vw, (max-width: 980px) 50vw, 33vw"
                    src={publicPath(story.image)}
                  />
                  <span className="cover-issue">SW / {story.id}</span>
                  <span className="cover-word">{story.issue.split(" ")[0]}</span>
                  <span className="cover-number">{story.id}</span>
                  <span className="cover-mark">✦</span>
                </div>
                <div className="story-body">
                  <div className="story-meta">
                    <span>{story.category} / {story.englishCategory}</span><span>{story.readTime}</span>
                  </div>
                  <h3>{story.title}</h3>
                  <p>{story.summary}</p>
                  <details>
                    <summary>READ NOTE <span aria-hidden="true">↗</span></summary>
                    <p>{story.note}</p>
                  </details>
                </div>
              </article>
            ))}
          </div>

          {filteredStories.length === 0 && (
            <div className="empty-state">
              <strong>검색 결과가 없어요.</strong>
              <span>다른 단어를 입력하거나 전체 카테고리를 선택해 보세요.</span>
            </div>
          )}
        </section>

        <section className="playlist" id="playlist">
          <div className="playlist-copy">
            <p className="eyebrow light">LISTENING ROOM / 입문 플레이리스트</p>
            <h2>CURATED TRACKS.<br /><em>ONE DISTINCT WAVE.</em></h2>
            <p>
              서로 다른 결의 큐레이션으로 K-pop의 넓은 스펙트럼을 만나보세요. 첨부된 MP3는 바로 재생하고, 공식 링크가 등록된 곡은 제목을 눌러 감상할 수 있습니다.
            </p>
            <div className="queue-player">
              <div className="queue-counter" aria-live="polite">
                <span>MY QUEUE</span><strong>{String(queue.length).padStart(2, "0")}</strong>
              </div>
              <div className="queue-actions">
                <button disabled={!currentQueueTrack} onClick={() => void toggleQueuePlayback()} type="button">
                  {queuePlaying ? "일시정지" : "선택곡 재생"}
                </button>
                <button disabled={playableQueue.length < 2} onClick={() => advanceQueue()} type="button">다음 곡</button>
                <button
                  aria-pressed={queueRepeat}
                  disabled={playableQueue.length === 0}
                  onClick={() => setQueueRepeat((current) => !current)}
                  type="button"
                >
                  반복 {queueRepeat ? "ON" : "OFF"}
                </button>
              </div>
              {currentQueueTrack ? (
                <div className="queue-now" aria-live="polite">
                  <span>NOW IN QUEUE</span>
                  <strong>{currentQueueTrack.title}</strong>
                  <small>{currentQueueTrack.artist}</small>
                  {/* Music-only previews contain no spoken dialogue. */}
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio
                    controls
                    onEnded={(event) => advanceQueue(event.currentTarget)}
                    onPause={() => setQueuePlaying(false)}
                    onPlay={() => setQueuePlaying(true)}
                    preload="metadata"
                    ref={queueAudioRef}
                  />
                </div>
              ) : (
                <p className="queue-empty">오른쪽 + 버튼으로 반복 재생할 곡을 선택하세요.</p>
              )}
            </div>
          </div>
          <ol className="track-list">
            {playlistTracks.length === 0 && (
              <li className="playlist-empty">
                <strong>등록된 PLAYLIST가 없습니다.</strong>
                <span>관리자 페이지에서 곡을 등록하면 이곳에 자동으로 표시됩니다.</span>
              </li>
            )}
            {playlistTracks.map((track, index) => {
              const selected = queue.includes(track.title);
              return (
                <li key={track.id ?? track.title}>
                  <span className="track-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="track-name">
                    {track.uploadedAudio ? (
                      <strong>{track.title}</strong>
                    ) : track.musicUrl ? (
                      <a href={track.musicUrl} target="_blank" rel="noreferrer"><strong>{track.title}</strong></a>
                    ) : <strong>{track.title}</strong>}
                    <span>{track.artist}</span>
                    {track.uploadedAudio && track.musicUrl && (
                      // The uploaded previews contain music only and no spoken dialogue.
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio
                        aria-label={`${track.artist}의 ${track.title} 재생`}
                        className="track-audio"
                        controls
                        onPlay={() => {
                          queueAudioRef.current?.pause();
                          setQueuePlaying(false);
                        }}
                        preload="none"
                        src={track.musicUrl}
                      />
                    )}
                  </div>
                  <span className="track-mood">{track.mood} / {track.year}</span>
                  <button
                    aria-label={`${track.title} ${selected ? "큐에서 빼기" : "큐에 담기"}`}
                    aria-pressed={selected}
                    onClick={() => toggleQueue(track.title)}
                    type="button"
                  >
                    {selected ? "✓" : "+"}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="culture section-shell" id="culture">
          <div className="culture-title">
            <div>
              <p className="eyebrow">BEYOND THE MUSIC</p>
              <h2>음악을 넘어,<br /><em>하나의 문화로.</em></h2>
            </div>
          </div>
          <div className="culture-grid">
            <article>
              <span className="culture-number">01</span><div className="culture-icon">◉</div>
              <h3>듣고 / LISTEN</h3><p>장르의 경계를 자유롭게 넘나드는 프로덕션과 목소리의 조합을 발견합니다.</p>
            </article>
            <article>
              <span className="culture-number">02</span><div className="culture-icon">✣</div>
              <h3>보고 / WATCH</h3><p>안무, 의상, 카메라 움직임이 음악과 만나 만드는 완성된 장면을 읽습니다.</p>
            </article>
            <article>
              <span className="culture-number">03</span><div className="culture-icon">✦</div>
              <h3>함께하고 / JOIN</h3><p>번역하고 응원하고 연결되는 팬들의 참여가 만드는 새로운 문화를 만납니다.</p>
            </article>
          </div>
        </section>

        <section className="letter" id="letter">
          <div className="letter-star" aria-hidden="true">✦</div>
          <p className="eyebrow">SEOULWAVE LETTER / EVERY MONDAY</p>
          <h2>YOUR WEEKLY<br />DOSE OF <em>K-POP.</em></h2>
          <p>매주 한 번, 놓치기 아쉬운 음악과 이야기를 골라 소개합니다.</p>
          <button className="button button-dark" onClick={() => setLetterOpen(!letterOpen)} type="button">
            {letterOpen ? "미리보기 닫기" : "이번 주 레터 미리보기"} <span>↗</span>
          </button>
          {letterOpen && (
            <div className="letter-preview" aria-live="polite">
              <span>WEEK 01</span>
              <strong>“후렴 15초 전에 이미 시작되는 K-pop의 빌드업”</strong>
              <p>레터 구독 연결 전의 미리보기입니다. 개인정보 입력 없이 콘텐츠 구성을 확인할 수 있어요.</p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <div className="footer-brand">SEOUL<span>WAVE</span></div>
        <p>K-POP MUSIC, CULTURE &amp; STORIES<br />CURATED IN SEOUL.</p>
        <div className="footer-links">
          <a href="#stories">STORIES</a><a href="#playlist">PLAYLIST</a><a href="#culture">ABOUT</a><a href={adminPath()}>ADMIN</a>
        </div>
        <small>© 2026 SEOULWAVE. EDITORIAL DEMO.</small>
      </footer>
    </>
  );
}
