"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, VolumeX } from "lucide-react";

export interface Snippet {
  id: number; startMs: number; endMs: number;
  label: string; transcript: string | null; severity: string;
}

const SEVERITY_FILL: Record<string, string> = {
  critical: "var(--color-danger)",
  warning: "var(--color-warn)",
  positive: "var(--color-ok)",
  info: "var(--color-info)",
};

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Interactive call waveform with flagged snippet markers.
 *
 * The envelope is precomputed server-side (see call_recordings.waveform) - the
 * alternative is shipping the whole audio file just to draw a preview. Clicking
 * the track or a marker seeks.
 *
 * When `audioUrl` is null the component stays fully interactive as a timeline
 * (seek, marker selection) but says plainly that no audio is attached, rather
 * than rendering a play button that would silently do nothing.
 */
export default function AudioWaveform({
  waveform,
  durationMs,
  snippets,
  audioUrl,
  onSelectSnippet,
  activeSnippetId,
}: {
  waveform: number[];
  durationMs: number;
  snippets: Snippet[];
  audioUrl: string | null;
  onSelectSnippet?: (s: Snippet) => void;
  activeSnippetId?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);

  const hasAudio = Boolean(audioUrl);

  // Drive the playhead from the element itself rather than a timer, so a
  // pause or a seek stays in step with what is actually audible.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setPositionMs(el.currentTime * 1000);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, durationMs));
      setPositionMs(clamped);
      if (audioRef.current) audioRef.current.currentTime = clamped / 1000;
    },
    [durationMs]
  );

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { void el.play(); setPlaying(true); }
  }, [playing]);

  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const bars = useMemo(() => (waveform.length ? waveform : Array(48).fill(0.15)), [waveform]);

  return (
    <div>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={!hasAudio}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>

        {/* Waveform track. role=slider so keyboard users can scrub. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Call position"
          aria-valuemin={0}
          aria-valuemax={durationMs}
          aria-valuenow={positionMs}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seek(positionMs + 5000);
            if (e.key === "ArrowLeft") seek(positionMs - 5000);
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - rect.left) / rect.width) * durationMs);
          }}
          className="relative h-14 flex-1 cursor-pointer select-none"
        >
          <div className="flex h-full items-center gap-[2px]">
            {bars.map((amp, i) => {
              const played = i / bars.length <= progress;
              return (
                <span
                  key={i}
                  className="flex-1 rounded-full transition-colors"
                  style={{
                    height: `${Math.max(8, amp * 100)}%`,
                    background: played ? "var(--color-accent)" : "var(--color-line-strong)",
                  }}
                />
              );
            })}
          </div>

          {/* Flagged snippets, positioned by their real timestamps. */}
          {snippets.map((s) => (
            <button
              key={s.id}
              title={`${s.label} · ${mmss(s.startMs)}`}
              onClick={(e) => { e.stopPropagation(); seek(s.startMs); onSelectSnippet?.(s); }}
              className={`absolute top-0 h-full rounded-sm transition-opacity hover:opacity-100 ${
                activeSnippetId === s.id ? "opacity-100" : "opacity-45"
              }`}
              style={{
                left: `${(s.startMs / durationMs) * 100}%`,
                width: `${Math.max(((s.endMs - s.startMs) / durationMs) * 100, 0.8)}%`,
                background: SEVERITY_FILL[s.severity] ?? SEVERITY_FILL.info,
                mixBlendMode: "multiply",
              }}
              aria-label={`Jump to ${s.label}`}
            />
          ))}

          {/* Playhead */}
          <span
            className="pointer-events-none absolute top-0 h-full w-px bg-fg"
            style={{ left: `${progress * 100}%` }}
            aria-hidden="true"
          />
        </div>

        <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-subtle">
          {mmss(positionMs)} / {mmss(durationMs)}
        </span>
      </div>

      {!hasAudio && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle">
          <VolumeX className="h-3 w-3" aria-hidden="true" />
          Transcript and markers only — no audio file is attached to this recording.
        </p>
      )}
    </div>
  );
}
