"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { PDFDocumentProxy } from "@/features/documents/read/pdfTypes";

function Watermark({ userEmail }: { userEmail: string }) {
  return (
    <div className="reader-watermark-doc absolute inset-0 z-20 overflow-hidden pointer-events-none select-none" aria-hidden>
      {[
        [15, 20],
        [50, 15],
        [85, 25],
        [10, 50],
        [50, 50],
        [90, 48],
        [18, 78],
        [52, 82],
        [88, 75],
      ].map(([x, y], i) => (
        <div
          key={i}
          className="absolute text-base font-semibold text-slate-500 whitespace-nowrap"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: "translate(-50%, -50%) rotate(-25deg)",
            opacity: 0.28,
          }}
        >
          {userEmail} · Doc2Share
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
  userEmail,
}: {
  pdfDoc: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  scale: number;
  pagesPerView: 1 | 2;
  userEmail: string;
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
          <Watermark userEmail={userEmail} />
        </div>

        {pagesPerView === 2 && currentPage + 1 <= numPages && (
          <div className="relative inline-block">
            <canvas ref={canvasRef2} className="bg-white shadow-lg block" />
            <Watermark userEmail={userEmail} />
          </div>
        )}
      </div>
    </div>
  );
}

