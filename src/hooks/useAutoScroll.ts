"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_THRESHOLD_PX = 120;

/**
 * Deliberate scroll management for the message list:
 *
 * - Tracks whether the reader is "near the bottom" of the list.
 * - Exposes `scrollToBottom()` for sends, initial load, and keyboard adjustments.
 * - Exposes `prepareForPrepend()` / `restoreAfterPrepend()` so loading
 *   older history maintains visual scroll position with zero jumps.
 * - Exposes `newBelowCount` for the "jump to latest" affordance when
 *   messages arrive while the reader is scrolled up.
 * - Listens to `window.visualViewport` to smoothly track mobile virtual keyboard resize.
 */
export function useAutoScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newBelowCount, setNewBelowCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const scrollRafRef = useRef<number | null>(null);
  const pendingPrependRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(
    null,
  );

  const checkNearBottom = useCallback(() => {
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = containerRef.current;
      if (!el) return;

      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const near = distance < NEAR_BOTTOM_THRESHOLD_PX;

      if (near !== isNearBottomRef.current) {
        isNearBottomRef.current = near;
        setIsNearBottom(near);
      }
      if (near) {
        setNewBelowCount((prev) => (prev !== 0 ? 0 : prev));
      }
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkNearBottom, { passive: true });
    return () => {
      el.removeEventListener("scroll", checkNearBottom);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [checkNearBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setNewBelowCount(0);
    isNearBottomRef.current = true;
    setIsNearBottom(true);
  }, []);

  // Listen to visualViewport resize (e.g. mobile virtual keyboard open/close)
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;
    const handleViewportResize = () => {
      if (isNearBottomRef.current) {
        requestAnimationFrame(() => {
          scrollToBottom("auto");
        });
      }
    };

    vv.addEventListener("resize", handleViewportResize);
    return () => {
      vv.removeEventListener("resize", handleViewportResize);
    };
  }, [scrollToBottom]);

  /** Call this when a message arrives (ours or someone else's). Follows the
   * new message automatically only if the reader was already near the
   * bottom; otherwise increments the "new messages" counter. */
  const onMessageArrived = useCallback(
    (isMine: boolean) => {
      if (isMine || isNearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom(isMine ? "smooth" : "auto"));
      } else {
        setNewBelowCount((n) => n + 1);
      }
    },
    [scrollToBottom],
  );

  /** Call right before prepending older messages to the DOM. */
  const prepareForPrepend = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    pendingPrependRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
  }, []);

  /** Call right after older messages render. Keeps visual scroll position anchored. */
  const restoreAfterPrepend = useCallback(() => {
    const el = containerRef.current;
    const prev = pendingPrependRef.current;
    if (!el || !prev) return;
    const delta = el.scrollHeight - prev.scrollHeight;
    if (delta > 0) {
      el.scrollTop = prev.scrollTop + delta;
    }
    pendingPrependRef.current = null;
  }, []);

  return {
    containerRef,
    isNearBottom,
    newBelowCount,
    scrollToBottom,
    onMessageArrived,
    prepareForPrepend,
    restoreAfterPrepend,
  };
}
