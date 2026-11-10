"use client";

import { useRef, useState, type CSSProperties } from "react";

/**
 * Single-line text that is truncated normally and scrolls to reveal the rest while hovered
 * (or focused via a parent link). Only scrolls when the text actually overflows.
 */
export default function MarqueeText({ text, className = "" }: { text: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  const start = () => {
    // The box clips the text, so its scrollWidth is the full text width.
    const overflow = (box.current?.scrollWidth ?? 0) - (box.current?.clientWidth ?? 0);
    setShift(overflow > 0 ? overflow : 0);
  };
  const stop = () => setShift(0);

  const style = shift
    ? ({ "--marquee-shift": `-${shift}px`, animationDuration: `${Math.max(3, shift / 30)}s` } as CSSProperties)
    : undefined;

  return (
    <span
      ref={box}
      className={`block overflow-hidden whitespace-nowrap ${shift ? "" : "text-ellipsis"} ${className}`}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <span ref={track} className={shift ? "inline-block marquee-run" : "inline"} style={style}>
        {text}
      </span>
    </span>
  );
}
