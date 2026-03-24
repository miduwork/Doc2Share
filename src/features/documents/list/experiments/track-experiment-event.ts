"use client";

type EventPayload = Record<string, string | number | boolean | null | undefined>;

type DataLayerLike = Array<Record<string, unknown>>;

export function trackExperimentEvent(event: string, payload: EventPayload): void {
  if (typeof window === "undefined") return;

  const win = window as Window & { dataLayer?: DataLayerLike };
  const data = { event, ...payload };
  if (Array.isArray(win.dataLayer)) {
    win.dataLayer.push(data);
  }

  win.dispatchEvent(new CustomEvent("doc2share:experiment-event", { detail: data }));
}
