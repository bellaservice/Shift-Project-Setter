"use client";

import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";

/**
 * Home's top bar, parked out of sight until you pull down for it.
 *
 * The screen leads with the picture and the wordmark, so the two controls do not
 * get a row of their own by default — they are revealed by a downward swipe from
 * the top, the way a phone reveals its own shade, and they come back in *above*
 * the wordmark rather than on top of it: the bar takes real height when open and
 * pushes the page down, so nothing is ever covered by it.
 *
 * Two constraints shaped how the animation is built, and both are easy to
 * reintroduce by accident:
 *
 * - **No transform on this wrapper.** NavMenu's sheet is `fixed inset-0`, and any
 *   `transform`/`translate` on an ancestor — even an identity `translateY(0)` —
 *   makes that ancestor the containing block, so the sheet would size itself to
 *   this 44px bar instead of the viewport. Height and opacity only.
 * - **No `overflow-hidden` either.** SettingsMenu's panel is absolutely
 *   positioned below its button and would be clipped away. Closed state hides
 *   the bar with `opacity-0` instead, which clips nothing.
 *
 * `-mb-4` while closed cancels the parent's `gap-4`, so a zero-height bar leaves
 * a zero-height hole rather than a stray 16px band above the wordmark.
 *
 * The swipe is not the only way in, because a gesture nobody can see is not an
 * accessible control and this is Home's only route to five other pages: tabbing
 * to either button reveals the bar (the controls stay focusable while hidden),
 * and on a mouse the top edge reveals it on hover.
 */
export function PullDownBar() {
  const [open, setOpen] = useState(false);
  const finePointer = useRef(false);

  useEffect(() => {
    finePointer.current = window.matchMedia("(pointer: fine)").matches;

    let startY = 0;
    let tracking = false;

    function onTouchStart(event: TouchEvent) {
      // Only claim the gesture at the very top of the page, so a normal scroll
      // further down is never mistaken for a pull.
      tracking = window.scrollY <= 0;
      startY = event.touches[0].clientY;
    }

    function onTouchMove(event: TouchEvent) {
      if (!tracking) return;
      const dy = event.touches[0].clientY - startY;
      // A threshold rather than any movement at all: without one, the drift in
      // an ordinary tap opens the bar by accident.
      if (dy > 44) {
        setOpen(true);
        tracking = false;
      } else if (dy < -44) {
        setOpen(false);
        tracking = false;
      }
    }

    function onScroll() {
      if (window.scrollY > 8) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      // Tabbing into either control reveals the bar it lives in; without this a
      // keyboard user would be operating a menu they cannot see.
      onFocusCapture={() => setOpen(true)}
      onMouseEnter={() => {
        if (finePointer.current) setOpen(true);
      }}
      onMouseLeave={() => {
        if (finePointer.current) setOpen(false);
      }}
      className={`transition-[height,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
        open ? "h-11 opacity-100" : "pointer-events-none -mb-4 h-0 opacity-0"
      }`}
    >
      <TopBar />
    </div>
  );
}
