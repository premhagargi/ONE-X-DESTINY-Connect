"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_THRESHOLD_PX = 120;

/**
 * Deliberate scroll management for the message list (see README/spec
 * "Proper conversation scrolling" — we do not rely on browser defaults):
 *
 * - Tracks whether the reader is "near the bottom" of the list.
 * - Exposes `scrollToBottom()` for sends and initial load.
 * - Exposes `prepareForPrepend()` / `restoreAfterPrepend()` so loading
 *   older history doesn't yank the reader's current view.
 * - Exposes `newBelowCount` for the "jump to latest" affordance when
 *   messages arrive while the reader is scrolled up.
 */
export function useAutoScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newBelowCount, setNewBelowCount] = useState(0);
  const pendingPrependRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(
    null,
  );

  const checkNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < NEAR_BOTTOM_THRESHOLD_PX;
    setIsNearBottom(near);
    if (near) setNewBelowCount(0);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkNearBottom, { passive: true });
    return () => el.removeEventListener("scroll", checkNearBottom);
  }, [checkNearBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setNewBelowCount(0);
    setIsNearBottom(true);
  }, []);

  /** Call this when a message arrives (ours or someone else's). Follows the
   * new message automatically only if the reader was already near the
   * bottom; otherwise just bumps the "new messages" counter. */
  const onMessageArrived = useCallback(
    (isMine: boolean) => {
      if (isMine || isNearBottom) {
        // requestAnimationFrame lets the new bubble's height land in the
        // DOM before we measure scrollHeight.
        requestAnimationFrame(() => scrollToBottom(isMine ? "smooth" : "auto"));
      } else {
        setNewBelowCount((n) => n + 1);
      }
    },
    [isNearBottom, scrollToBottom],
  );

  /** Call right before prepending older messages to the DOM. */
  const prepareForPrepend = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    pendingPrependRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
  }, []);

  /** Call right after the older messages have been rendered. Keeps
   * whatever the reader was looking at in the same visual position. */
  const restoreAfterPrepend = useCallback(() => {
    const el = containerRef.current;
    const prev = pendingPrependRef.current;
    if (!el || !prev) return;
    const delta = el.scrollHeight - prev.scrollHeight;
    el.scrollTop = prev.scrollTop + delta;
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
