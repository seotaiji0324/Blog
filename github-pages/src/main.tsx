import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "../../app/globals.css";
import Home from "../../app/page";

const root = document.getElementById("root");
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type PublicPlaylistBody = { entries: Array<Record<string, unknown>> };
type PlaylistChangeHandler = () => void;

declare global {
  interface Window {
    __SEOULWAVE_PLAYLIST__?: {
      load: () => Promise<PublicPlaylistBody>;
      subscribe: (onChange: PlaylistChangeHandler) => () => void;
    };
  }
}

if (supabaseUrl && supabaseKey) {
  const publicClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  window.__SEOULWAVE_PLAYLIST__ = {
    async load() {
      const { data, error } = await publicClient
        .from("PlayList")
        .select("id,title,artist,genre,release_year,music_url,audio_path,display_order,created_at")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const entries = await Promise.all((data ?? []).map(async (entry) => {
        let playbackUrl: string | null = null;
        if (entry.audio_path) {
          const { data: signedAudio, error: signingError } = await publicClient.storage
            .from("kpop-audio")
            .createSignedUrl(entry.audio_path, 60 * 60);
          if (!signingError) playbackUrl = signedAudio.signedUrl;
        }
        return { ...entry, playback_url: playbackUrl };
      }));

      return { entries };
    },
    subscribe(onChange) {
      const channel = publicClient
        .channel("seoulwave-public-playlist")
        .on("postgres_changes", { event: "*", schema: "public", table: "PlayList" }, onChange)
        .subscribe();
      return () => { void publicClient.removeChannel(channel); };
    },
  };
}

if (!root) throw new Error("GitHub Pages root element is missing.");

createRoot(root).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
