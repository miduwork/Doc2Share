"use client";

import { useEffect, useRef, useState } from "react";

const BLUR_HIDE_DELAY_MS = 400;

export default function useReaderSecurityGuards() {
  const [contentHidden, setContentHidden] = useState(false);
  const blurHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chặn sao chép, in, lưu, cắt, kéo thả, phím tắt chụp màn hình, F12; khi bấm Print Screen → che đen toàn màn hình
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

  // Bảo vệ màn hình: chỉ che màn hình khi tab bị ẩn (chuyển tab/minimize cửa sổ).
  // Đã gỡ bỏ window blur/focus để cho phép đọc side-by-side thoải mái.
  // Đã gỡ bỏ mouseLeave viewport để tránh vô tình che khi dùng taskbar.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (blurHideTimerRef.current) {
          clearTimeout(blurHideTimerRef.current);
          blurHideTimerRef.current = null;
        }
        setContentHidden(true);
      } else {
        setContentHidden(false);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (blurHideTimerRef.current) {
        clearTimeout(blurHideTimerRef.current);
        blurHideTimerRef.current = null;
      }
    };
  }, []);

  return { contentHidden, setContentHidden };
}

