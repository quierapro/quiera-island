// SPDX-License-Identifier: GPL-3.0-only
//
// Adapted from Bloom's TitleMarquee (src/CompactMediaPlayer.tsx, commit
// fa32e83, https://github.com/SehajveerSingh2005/bloom),
// Copyright © 2026 Sehajveer Singh, GPL-3.0-only.
// Changes: generic text and class names, scroll distance passed through a
// single measurement function.

import { useEffect, useRef, useState, type CSSProperties } from "react";

/** Pixels per second; short overflows still take this long at least. */
const SPEED = 30;
const MIN_DURATION_S = 5;

/**
 * One line of text that scrolls back and forth when it does not fit, and
 * stays still when it does.
 */
export function Marquee({ text, className }: { text: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!wrap.current || !inner.current) return;
      setDistance(Math.max(0, inner.current.scrollWidth - wrap.current.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (wrap.current) observer.observe(wrap.current);
    return () => observer.disconnect();
  }, [text]);

  const style =
    distance > 0
      ? ({
          "--scroll-distance": `-${distance}px`,
          "--scroll-duration": `${Math.max(distance / SPEED, MIN_DURATION_S)}s`,
        } as CSSProperties)
      : undefined;

  return (
    <div ref={wrap} className={`marquee ${distance > 0 ? "marquee--overflow" : ""}`}>
      <span ref={inner} className={`marquee-text ${className ?? ""}`} style={style}>
        {text}
      </span>
    </div>
  );
}
