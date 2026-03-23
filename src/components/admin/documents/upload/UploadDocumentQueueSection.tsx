"use client";

import { Upload, Loader2, Trash2 } from "lucide-react";
import type { QueueItem, QueueStatus } from "./upload-queue-types";

interface Props {
  queue: QueueItem[];
  queueConcurrency: 1 | 2 | 3;
  processingQueue: boolean;
  onConcurrencyChange: (_value: 1 | 2 | 3) => void;
  onProcessAll: () => void;
  onRemove: (_id: string) => void;
}

export function UploadDocumentQueueSection({
  queue,
  queueConcurrency,
  processingQueue,
  onConcurrencyChange,
  onProcessAll,
  onRemove,
}: Props) {
  if (queue.length === 0) return null;

  return (
    <section
      className="space-y-3 rounded-2xl border border-line bg-surface-muted/50 p-4"
      aria-labelledby="queue-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="queue-heading" className="text-base font-semibold text-semantic-heading">
          Hàng đợi ({queue.length})
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="queue-concurrency" className="text-sm text-muted">
            Xử lý:
          </label>
          <select
            id="queue-concurrency"
            value={queueConcurrency}
            onChange={(e) => onConcurrencyChange(Number(e.target.value) as 1 | 2 | 3)}
            className="rounded border border-line bg-surface px-2 py-1 text-sm text-fg"
            aria-describedby="queue-concurrency-desc"
          >
            <option value={1}>Tuần tự</option>
            <option value={2}>Song song 2</option>
            <option value={3}>Song song 3</option>
          </select>
          <span id="queue-concurrency-desc" className="sr-only">
            Số tài liệu tải lên đồng thời khi bấm Tải lên tất cả
          </span>
          <button
            type="button"
            disabled={processingQueue || queue.every((q) => q.status !== "pending")}
            onClick={onProcessAll}
            className="flex items-center gap-2 rounded-xl bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {processingQueue ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Đang tải…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" aria-hidden />
                Tải lên tất cả
              </>
            )}
          </button>
        </div>
      </div>
      <ul className="max-h-48 space-y-2 overflow-y-auto" role="list">
        {queue.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate font-medium text-semantic-heading" title={item.title}>
              {item.title}
            </span>
            <span className="shrink-0">
              <QueueStatusBadge status={item.status} error={item.error} />
            </span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={item.status === "uploading"}
              className="shrink-0 rounded p-1 text-muted hover:bg-muted/50 hover:text-fg disabled:opacity-50"
              aria-label={`Xóa "${item.title}" khỏi hàng đợi`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QueueStatusBadge({ status, error }: { status: QueueStatus; error?: string }) {
  if (status === "pending") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        Chờ
      </span>
    );
  }
  if (status === "uploading") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Đang tải
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-300">
        Xong
      </span>
    );
  }
  return (
    <span
      className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900/40 dark:text-red-300"
      title={error}
    >
      Lỗi
    </span>
  );
}
