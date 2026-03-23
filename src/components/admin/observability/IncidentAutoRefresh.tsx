"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IncidentAutoRefresh({
  enabled,
  intervalMs = 45000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, router]);

  if (!enabled) return null;

  return (
    <p className="text-xs text-emerald-700 dark:text-emerald-300">
      Incident auto-refresh: bật (45s, chỉ khi tab đang mở).
    </p>
  );
}
