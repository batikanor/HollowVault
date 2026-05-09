"use client";

import { useEffect, useState } from "react";

interface Props {
  active: boolean;
}

interface Ray {
  id: number;
  left: number;
  delay: number;
}

export function CosmicAnimation({ active }: Props) {
  const [rays, setRays] = useState<Ray[]>([]);

  useEffect(() => {
    if (!active) return;
    const next: Ray[] = Array.from({ length: 24 }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
    }));
    setRays(next);
    const t = window.setTimeout(() => setRays([]), 2200);
    return () => window.clearTimeout(t);
  }, [active]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {rays.map((r) => (
        <span
          key={r.id}
          className="ray"
          style={{ left: `${r.left}%`, animationDelay: `${r.delay}s` }}
        />
      ))}
    </div>
  );
}
