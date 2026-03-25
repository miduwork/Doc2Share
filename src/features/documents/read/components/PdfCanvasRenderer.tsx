"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { PDFDocumentProxy } from "@/features/documents/read/pdfTypes";
import type { WatermarkDisplayPayload } from "@/lib/watermark/watermark-contract";
import { toIssuedAtBucketLabel } from "@/lib/watermark/watermark-contract";
import { buildWatermarkGrid, getAdaptiveWatermarkPaint } from "@/lib/watermark/watermark-overlay";

function Watermark({
  watermark,
  canvasRef,
}: {
  watermark: WatermarkDisplayPayload | null;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
}) {
  const points = watermark ? buildWatermarkGrid(watermark, 10) : [];
  const bucketLabel = watermark ? toIssuedAtBucketLabel(watermark.wmIssuedAtBucket) : "--:--";
  const paintRef = useRef(getAdaptiveWatermarkPaint(0.75));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    try {
      const sampleX = Math.max(0, Math.floor(canvas.width * 0.5));
      const sampleY = Math.max(0, Math.floor(canvas.height * 0.5));
      const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
      const luma = (0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]) / 255;
      paintRef.current = getAdaptiveWatermarkPaint(luma);
    } catch {
      paintRef.current = getAdaptiveWatermarkPaint(0.75);
    }
  }, [canvasRef, watermark?.wmShort, watermark?.wmIssuedAtBucket]);

  if (!watermark) return null;

  return (
    <div className="reader-watermark-doc absolute inset-0 z-20 overflow-hidden pointer-events-none select-none" aria-hidden>
      {points.map((point, i) => (
        <div
          key={i}
          className="absolute whitespace-nowrap"
          style={{
            left: `${point.xPercent}%`,
            top: `${point.yPercent}%`,
            transform: `translate(-50%, -50%) rotate(${point.rotationDeg}deg)`,
            opacity: paintRef.current.opacity,
            color: paintRef.current.color,
          }}
        >
          <div className="text-sm font-semibold tracking-wide">D2S:{watermark.wmShort}</div>
          <div className="text-xs font-medium">DOC:{watermark.wmDocShort} T:{bucketLabel}</div>
        </div>
      ))}
    </div>
  );
}

export default function PdfCanvasRenderer({
  pdfDoc,
  numPages,
  currentPage,
  scale,
  pagesPerView,
  watermark,
}: {
  pdfDoc: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  scale: number;
  pagesPerView: 1 | 2;
  watermark: WatermarkDisplayPayload | null;
}) {
  const canvasRef1 = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const renderTaskRef1 = useRef<{ cancel: () => void } | null>(null);
  const renderTaskRef2 = useRef<{ cancel: () => void } | null>(null);
  const renderRunIdRef = useRef(0);

  useEffect(() => {
    if (!pdfDoc) return;

    const runId = ++renderRunIdRef.current;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const renderOne = (
      pageNum: number,
      canvas: HTMLCanvasElement | null,
      taskRef: MutableRefObject<{ cancel: () => void } | null>
    ) => {
      if (!canvas || pageNum < 1 || pageNum > numPages) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (taskRef.current) {
        taskRef.current.cancel();
        taskRef.current = null;
      }

      pdfDoc
        .getPage(pageNum)
        .then((page) => {
          if (renderRunIdRef.current !== runId) return;
          const viewport = page.getViewport({ scale });

          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);

          const task = page.render({
            canvasContext: ctx,
            canvas,
            viewport,
            intent: "display",
          });
          taskRef.current = task as { cancel: () => void };

          task.promise
            .then(() => {
              taskRef.current = null;
            })
            .catch(() => {});
        })
        .catch(() => {});
    };

    if (pagesPerView === 1) {
      renderOne(currentPage, canvasRef1.current, renderTaskRef1);
      if (renderTaskRef2.current) {
        renderTaskRef2.current.cancel();
        renderTaskRef2.current = null;
      }
    } else {
      renderOne(currentPage, canvasRef1.current, renderTaskRef1);
      renderOne(currentPage + 1, canvasRef2.current, renderTaskRef2);
    }

    return () => {
      if (renderTaskRef1.current) {
        renderTaskRef1.current.cancel();
        renderTaskRef1.current = null;
      }
      if (renderTaskRef2.current) {
        renderTaskRef2.current.cancel();
        renderTaskRef2.current = null;
      }
    };
  }, [pdfDoc, currentPage, scale, numPages, pagesPerView]);

  return (
    <div className="flex justify-center overflow-auto p-4" style={{ minHeight: "100%" }}>
      <div className={pagesPerView === 2 ? "flex flex-wrap justify-center gap-4 items-start" : "relative inline-block"}>
        <div className="relative inline-block">
          <canvas ref={canvasRef1} className="bg-white shadow-lg block" />
          <Watermark watermark={watermark} canvasRef={canvasRef1} />
        </div>

        {pagesPerView === 2 && currentPage + 1 <= numPages && (
          <div className="relative inline-block">
            <canvas ref={canvasRef2} className="bg-white shadow-lg block" />
            <Watermark watermark={watermark} canvasRef={canvasRef2} />
          </div>
        )}
      </div>
    </div>
  );
}

