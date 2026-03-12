"use client";

import { useEffect, useRef, useState } from "react";

export function DemoAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          videoRef.current?.play();
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
                app.menlocobranca.com.br
              </span>
            </div>
          </div>

          {/* Video area */}
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
        </div>
      </div>
    </section>
  );
}
