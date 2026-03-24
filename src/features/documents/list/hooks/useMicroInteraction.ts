"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Hook for 3D tilt micro-interaction on document cards.
 * Uses CSS custom properties (--card-rx, --card-ry) with requestAnimationFrame batching.
 */
export function useMicroInteraction(enabled: boolean) {
    const cardRef = useRef<HTMLElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const pending = useRef<{ rx: number; ry: number } | null>(null);

    useEffect(() => {
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const flushTransform = () => {
        const el = cardRef.current;
        const value = pending.current;
        if (!el || !value) return;
        el.style.setProperty("--card-rx", `${value.rx}deg`);
        el.style.setProperty("--card-ry", `${value.ry}deg`);
        pending.current = null;
        rafRef.current = null;
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
        if (!enabled || e.pointerType !== "mouse") return;
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - y) * 4;
        const ry = (x - 0.5) * 4;
        pending.current = { rx, ry };
        if (rafRef.current == null) {
            rafRef.current = requestAnimationFrame(flushTransform);
        }
    };

    const handlePointerLeave = () => {
        if (!enabled) return;
        const el = cardRef.current;
        if (!el) return;
        el.style.setProperty("--card-rx", "0deg");
        el.style.setProperty("--card-ry", "0deg");
    };

    return {
        cardRef,
        handlePointerMove: enabled ? handlePointerMove : undefined,
        handlePointerLeave: enabled ? handlePointerLeave : undefined,
    };
}
