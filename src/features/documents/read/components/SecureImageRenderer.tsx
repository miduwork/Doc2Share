"use client";

import { useEffect, useRef, useState } from "react";
import type { WatermarkDisplayPayload } from "@/lib/watermark/watermark-contract";
import { collectHardwareFingerprint } from "@/lib/auth/fingerprint";

type SecureImageRendererProps = {
    documentId: string;
    deviceId: string;
    numPages: number;
    currentPage: number;
    scale: number;
    pagesPerView: 1 | 2;
    watermark: WatermarkDisplayPayload | null;
    securePdfRequestId: string | null;
};

export default function SecureImageRenderer({
    documentId,
    deviceId,
    numPages,
    currentPage,
    scale,
    pagesPerView,
    securePdfRequestId,
}: SecureImageRendererProps) {
    const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
    const [loadingPages, setLoadingPages] = useState<Record<number, boolean>>({});

    // Track which pages have been requested to avoid duplicate fetches.
    // Using a ref (not state) prevents the infinite re-render loop that occurred
    // when imageUrls was in the useEffect dependency array.
    const requestedPagesRef = useRef<Set<number>>(new Set());

    // Reset everything when the document changes
    const prevDocIdRef = useRef(documentId);
    useEffect(() => {
        if (prevDocIdRef.current !== documentId) {
            prevDocIdRef.current = documentId;
            // Revoke old object URLs
            Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
            setImageUrls({});
            setLoadingPages({});
            requestedPagesRef.current = new Set();
        }
    }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const pagesToLoad = pagesPerView === 2 && currentPage + 1 <= numPages
            ? [currentPage, currentPage + 1]
            : [currentPage];

        pagesToLoad.forEach(async (page) => {
            if (requestedPagesRef.current.has(page)) return;
            requestedPagesRef.current.add(page);

            setLoadingPages(prev => ({ ...prev, [page]: true }));
            try {
                const { signalsSummary, hardwareHash } = await collectHardwareFingerprint();
                const res = await fetch("/api/secure-document-image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        document_id: documentId,
                        device_id: deviceId,
                        page,
                        hardware_hash: hardwareHash,
                        hardware_fingerprint: signalsSummary,
                        secure_pdf_request_id: securePdfRequestId ?? undefined
                    }),
                });

                if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setImageUrls(prev => ({ ...prev, [page]: url }));
                }
            } catch (err) {
                console.error(`Failed to load page ${page}`, err);
                // Allow retry on failure by removing from requested set
                requestedPagesRef.current.delete(page);
            } finally {
                setLoadingPages(prev => ({ ...prev, [page]: false }));
            }
        });
    }, [currentPage, documentId, deviceId, numPages, pagesPerView, securePdfRequestId]);

    // Cleanup: revoke all object URLs on unmount
    useEffect(() => {
        return () => {
            Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const renderPage = (pageNumber: number) => {
        const url = imageUrls[pageNumber];
        const isLoading = loadingPages[pageNumber];

        return (
            <div
                key={pageNumber}
                className="relative flex flex-col items-center shadow-2xl"
                style={{
                    width: `${Math.floor(600 * scale)}px`,
                    minHeight: `${Math.floor(800 * scale)}px`,
                    backgroundColor: "#1e293b"
                }}
            >
                {url ? (
                    <img
                        src={url}
                        alt={`Trang ${pageNumber}`}
                        className="h-auto w-full"
                        style={{ pointerEvents: "none" }}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                ) : isLoading ? (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <span className="animate-pulse">Đang giải mã trang {pageNumber}...</span>
                    </div>
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-red-400">
                        Lỗi tải trang
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center gap-8 py-10">
            <div className={`flex flex-wrap justify-center items-start gap-4 ${pagesPerView === 2 ? 'max-w-[95vw]' : ''}`}>
                {renderPage(currentPage)}
                {pagesPerView === 2 && currentPage + 1 <= numPages && renderPage(currentPage + 1)}
            </div>

            <div className="fixed inset-0 z-10 pointer-events-none" style={{ userSelect: "none" }} aria-hidden="true" />
        </div>
    );
}
