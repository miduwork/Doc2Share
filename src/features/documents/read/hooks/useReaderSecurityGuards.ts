"use client";

import { useEffect, useRef, useState } from "react";

const BLUR_HIDE_DELAY_MS = 400;

export default function useReaderSecurityGuards() {
  const [mouseInView, setMouseInView] = useState(true);
  const [contentHidden, setContentHidden] = useState(false);
  const blurHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chặn sao chép, in, lưu, cắt, kéo thả, phím tắt chụp màn hình, F12; khi bấm Print Screen → che đen toàn màn hình ngay
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();

    const preventKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "c" || e.key === "p" || e.key === "s" || e.key === "x")) e.preventDefault();
      if (e.metaKey && (e.key === "c" || e.key === "p" || e.key === "s" || e.key === "x")) e.preventDefault();
      if (e.key === "F12") e.preventDefault();

      // Print Screen / Snapshot: chặn và che đen
      const isPrintScreen =
        e.key === "PrintScreen" || e.key === "Snapshot" || e.keyCode === 44 || e.code === "PrintScreen";
      if (isPrintScreen) {
        e.preventDefault();
        e.stopPropagation();
        setContentHidden(true);
      }

      // Cmd+Shift+3/4/5 (macOS screenshot): chặn và che đen
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && ["3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        setContentHidden(true);
      }
    };

    document.addEventListener("contextmenu", prevent);
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("dragstart", prevent);
    document.addEventListener("keydown", preventKey, true);

    return () => {
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("copy", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("dragstart", prevent);
      document.removeEventListener("keydown", preventKey, true);
    };
  }, []);

  // Mouse leave viewport -> blur
  useEffect(() => {
    const onLeave = () => setMouseInView(false);
    const onEnter = () => setMouseInView(true);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    return () => {
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
    };
  }, []);

  // Chống chụp màn hình: che khi tab ẩn (ngay) hoặc mất focus (sau delay để tránh che nhấp nháy)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (blurHideTimerRef.current) {
          clearTimeout(blurHideTimerRef.current);
          blurHideTimerRef.current = null;
        }
        setContentHidden(true);
      }
    };

    const onBlur = () => {
      if (blurHideTimerRef.current) clearTimeout(blurHideTimerRef.current);
      blurHideTimerRef.current = setTimeout(() => {
        blurHideTimerRef.current = null;
        setContentHidden(true);
      }, BLUR_HIDE_DELAY_MS);
    };

    const onFocus = () => {
      if (blurHideTimerRef.current) {
        clearTimeout(blurHideTimerRef.current);
        blurHideTimerRef.current = null;
      }
      setContentHidden(false);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (blurHideTimerRef.current) {
        clearTimeout(blurHideTimerRef.current);
        blurHideTimerRef.current = null;
      }
    };
  }, []);

  return { contentHidden, mouseInView, setContentHidden };
}

