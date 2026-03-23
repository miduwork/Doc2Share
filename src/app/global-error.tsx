"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f8fc", color: "#0f172a" }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Đã xảy ra lỗi nghiêm trọng
          </h1>
          <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
            Ứng dụng tạm thời không phản hồi. Vui lòng tải lại trang hoặc quay lại sau.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "1px solid #cbd5e1",
                borderRadius: "0.5rem",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Tải lại trang
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "0.5rem",
                background: "#1d4ed8",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Về trang chủ
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
