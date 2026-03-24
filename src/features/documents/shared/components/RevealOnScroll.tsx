"use client";

import { useRevealOnScroll } from "./hooks/useRevealOnScroll";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Bọc nội dung và thêm class is-visible khi vào viewport (dùng với .reveal-on-scroll trong globals).
 */
export default function RevealOnScroll({ children, className = "" }: Props) {
  const ref = useRevealOnScroll<HTMLDivElement>();

  return (
    <div ref={ref} className={`reveal-on-scroll ${className}`.trim()}>
      {children}
    </div>
  );
}

