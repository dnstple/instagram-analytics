"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Maximize2,
  X,
  ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/meta/metrics";
import type { OrganicMedia } from "@/lib/meta/types";

function typeLabel(m: OrganicMedia): string {
  if (m.contentType === "REEL") return "Reel";
  if (m.contentType === "CAROUSEL") return "Carousel";
  if (m.mediaType === "VIDEO") return "Video";
  return "Post";
}

interface Slide {
  url: string | null;
  isVideo: boolean;
}

function buildSlides(m: OrganicMedia): Slide[] {
  if (m.children && m.children.length > 0) {
    return m.children.map((c) => ({
      url: c.mediaUrl ?? c.thumbnailUrl ?? null,
      isVideo: c.mediaType === "VIDEO",
    }));
  }
  const isVideo = m.contentType === "REEL" || m.mediaType === "VIDEO";
  return [{ url: m.mediaUrl ?? m.thumbnailUrl ?? null, isVideo }];
}

export function MediaLightbox({
  media,
  onClose,
}: {
  media: OrganicMedia | null;
  onClose: () => void;
}) {
  const slides = media ? buildSlides(media) : [];
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const prev = useCallback(
    () => setIdx((i) => (i > 0 ? i - 1 : slides.length - 1)),
    [slides.length]
  );
  const next = useCallback(
    () => setIdx((i) => (i < slides.length - 1 ? i + 1 : 0)),
    [slides.length]
  );

  useEffect(() => {
    setIdx(0);
  }, [media]);

  useEffect(() => {
    setLoading(true);
    setErrored(false);
  }, [idx, media]);

  useEffect(() => {
    if (!media) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (slides.length > 1) {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media, slides.length, prev, next, onClose]);

  if (!media) return null;

  const slide = slides[idx];
  const goFullscreen = () => containerRef.current?.requestFullscreen?.();
  const copyLink = () => {
    if (media.permalink) navigator.clipboard?.writeText(media.permalink);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Badge variant={media.contentType === "REEL" ? "default" : "secondary"}>
              {typeLabel(media)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {fmtDate(media.timestamp)}
              {slides.length > 1 ? ` · ${idx + 1}/${slides.length}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goFullscreen} title="Full screen">
              <Maximize2 className="h-4 w-4" />
            </Button>
            {media.permalink ? (
              <Button variant="ghost" size="icon" onClick={copyLink} title="Copy link">
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
            {media.permalink ? (
              <Button asChild variant="ghost" size="icon" title="Open on Instagram">
                <a href={media.permalink} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" onClick={onClose} title="Close (Esc)">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Media stage */}
        <div className="relative flex min-h-[40vh] flex-1 items-center justify-center bg-black">
          {slide?.url && !errored ? (
            slide.isVideo ? (
              <video
                key={slide.url}
                src={slide.url}
                controls
                autoPlay
                playsInline
                className="max-h-[70vh] w-auto object-contain"
                onLoadedData={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setErrored(true);
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={slide.url}
                src={slide.url}
                alt={media.caption ?? "Instagram media"}
                className="max-h-[70vh] w-auto object-contain"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setErrored(true);
                }}
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-white/70">
              <ImageOff className="h-8 w-8" />
              Media URL is missing or expired. Use “Open on Instagram”.
            </div>
          )}

          {loading && slide?.url && !errored ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          ) : null}

          {slides.length > 1 ? (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>

        {/* Thumbnail strip for carousels */}
        {slides.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-t bg-card p-2">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-12 w-12 shrink-0 overflow-hidden rounded border-2 ${
                  i === idx ? "border-primary" : "border-transparent"
                }`}
              >
                {s.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <ImageOff className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : null}

        {/* Caption */}
        {media.caption ? (
          <div className="max-h-28 overflow-y-auto border-t px-4 py-3 text-sm text-muted-foreground">
            {media.caption}
          </div>
        ) : null}
      </div>
    </div>
  );
}
