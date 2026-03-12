"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

export function DemoAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          videoRef.current?.play();
          setPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <section id="demo" className="bg-menlo-offwhite px-6 py-16 md:py-24">
      <div
        ref={ref}
        className={`max-w-4xl mx-auto transition-all duration-700 ${
          visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6"
        }`}
      >
        {/* Browser frame */}
        <div className="rounded-2xl shadow-large overflow-hidden bg-white">
          {/* Chrome bar */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 ml-3 bg-gray-100 rounded-md h-7 flex items-center px-3">
              <span className="text-xs text-gray-400">
                app.menlopagamentos.com.br
              </span>
            </div>
          </div>

          {/* Video area with custom play/pause */}
          <div className="relative group cursor-pointer" onClick={togglePlay}>
            <video
              ref={videoRef}
              className="w-full"
              muted
              loop
              playsInline
              preload="metadata"
            >
              <source src="/videos/demo.webm" type="video/webm" />
            </video>

            {/* Play/Pause overlay — visible when paused, or on hover */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                playing
                  ? "opacity-0 group-hover:opacity-100"
                  : "opacity-100"
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                {playing ? (
                  <Pause className="w-6 h-6 text-white" />
                ) : (
                  <Play className="w-6 h-6 text-white ml-0.5" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
