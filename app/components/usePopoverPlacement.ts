"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

// useLayoutEffect warns during server rendering; it only matters in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const GAP = 8; // space between the trigger and the panel
const EDGE = 16; // breathing room from the screen edge
const TOP_INSET = 64; // sticky 64px menu bar covers the top of the screen
const MIN_HEIGHT = 160;

/**
 * Places a popover (dropdown menu, date picker, row menu) so it stays on screen: it opens
 * below its trigger, flips above when there isn't room below and there is more room above,
 * and caps its height to the space on that side (the panel then scrolls) so every item can
 * still be reached. Measured once per open, before paint, so there is no visible jump.
 *
 * Spread the returned style onto the absolutely positioned panel.
 */
export function usePopoverPlacement(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>
): { up: boolean; style: CSSProperties | undefined } {
  const [placement, setPlacement] = useState<{ up: boolean; maxHeight?: number }>({ up: false });

  useIsoLayoutEffect(() => {
    if (!open) {
      setPlacement({ up: false });
      return;
    }
    const anchor = anchorRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const cssMax = parseFloat(getComputedStyle(panel).maxHeight);
    const wanted = Math.min(panel.scrollHeight, Number.isFinite(cssMax) ? cssMax : Infinity);
    const below = window.innerHeight - anchor.bottom - GAP - EDGE;
    const above = anchor.top - GAP - EDGE - TOP_INSET;
    const up = below < wanted && above > below;
    const room = up ? above : below;
    setPlacement({ up, maxHeight: room < wanted ? Math.max(MIN_HEIGHT, room) : undefined });
  }, [open]);

  const style: CSSProperties | undefined =
    placement.up || placement.maxHeight
      ? {
          ...(placement.up ? { top: "auto", bottom: `calc(100% + ${GAP}px)`, marginTop: 0 } : {}),
          ...(placement.maxHeight ? { maxHeight: placement.maxHeight, overflowY: "auto" } : {}),
        }
      : undefined;

  return { up: placement.up, style };
}
