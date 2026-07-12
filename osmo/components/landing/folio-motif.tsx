"use client";

// Decorative geometric motif — echoes the Bauhaus mosaic in /landing.png.
// Reads as a small folio "bloom": a four-petal flower (the SEF token) ringed
// by five orbiting dots (the five basket assets). Purely decorative.

import { useCallback, useState } from "react";

const NAVY = "#132347";
const BLUE = "#5b6ef2";
const SLATE = "#9aa3ba";
const ACCENT = "#1f4fb4";

// Five orbiting assets, evenly spaced around the bloom.
const ORBIT = Array.from({ length: 5 }, (_, i) => {
  const a = (-90 + i * 72) * (Math.PI / 180);
  return { x: 130 + Math.cos(a) * 96, y: 130 + Math.sin(a) * 96 };
});

export function FolioMotif() {
  const [spin, setSpin] = useState(0);

  // Gentle tilt toward the cursor for a touch of life.
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSpin(((e.clientX - r.left) / r.width - 0.5) * 16);
  }, []);

  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={() => setSpin(0)}
      className="pointer-events-auto hidden shrink-0 select-none md:block"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 260 260"
        className="h-56 w-56 drop-shadow-[0_18px_40px_rgba(19,35,71,0.18)]"
      >
        {/* soft halo */}
        <circle cx="130" cy="130" r="120" fill={ACCENT} opacity="0.06" />
        <circle cx="130" cy="130" r="96" fill="none" stroke={SLATE} strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="2 8" />

        {/* orbiting basket assets */}
        {ORBIT.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="13" fill={i % 2 ? BLUE : NAVY} />
            <circle cx={p.x} cy={p.y} r="5" fill="#f8f8f8" opacity={i % 2 ? 0.9 : 0.55} />
          </g>
        ))}

        {/* the bloom — four petals + core, tilts with the cursor */}
        <g style={{ transform: `rotate(${spin}deg)`, transformOrigin: "130px 130px", transition: "transform .4s ease-out" }}>
          {[45, 135, 225, 315].map((deg, i) => (
            <path
              key={deg}
              d="M130 130 C150 96 176 96 176 130 C176 164 150 164 130 130 Z"
              fill={i % 2 ? NAVY : BLUE}
              opacity={i % 2 ? 1 : 0.92}
              transform={`rotate(${deg} 130 130)`}
            />
          ))}
          <circle cx="130" cy="130" r="18" fill={ACCENT} />
          <circle cx="130" cy="130" r="7" fill="#f8f8f8" />
        </g>
      </svg>
    </div>
  );
}
