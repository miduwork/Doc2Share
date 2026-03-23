"use client";

import type { DraftSessionRow } from "@/app/admin/documents/upload-actions";

interface Props {
  draftSessionId: string | null;
  drafts: DraftSessionRow[];
  loadingDrafts: boolean;
  onClearDraft: () => void;
  onSelectDraft: (_draft: DraftSessionRow) => void;
}

export function UploadDocumentDraftSection({
  draftSessionId,
  drafts,
  loadingDrafts,
  onClearDraft,
  onSelectDraft,
}: Props) {
  return (
    <>
      {draftSessionId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium text-semantic-heading">
            Đang tiếp tục nháp — chọn file bên dưới rồi bấm &quot;Gắn file và hoàn tất&quot;
          </span>
          <button
            type="button"
            onClick={onClearDraft}
            className="rounded-lg border border-line bg-surface px-3 py-1 text-sm font-medium text-fg hover:bg-muted"
          >
            Hủy
          </button>
        </div>
      )}

      {drafts.length > 0 && (
        <section aria-labelledby="drafts-heading" className="space-y-2">
          <h3 id="drafts-heading" className="text-sm font-medium text-semantic-heading">
            Tiếp tục từ nháp
          </h3>
          <ul className="flex flex-wrap gap-2" role="list">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted/50 px-3 py-2">
                <span className="min-w-0 max-w-[200px] truncate text-sm text-fg" title={d.title}>
                  {d.title}
                </span>
                <span className="text-xs text-muted">
                  {new Date(d.created_at).toLocaleDateString("vi-VN")}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectDraft(d)}
                  disabled={!!draftSessionId}
                  className="shrink-0 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Chọn
                </button>
              </li>
            ))}
          </ul>
          {loadingDrafts && (
            <p className="text-xs text-muted" role="status">
              Đang tải danh sách nháp…
            </p>
          )}
        </section>
      )}
    </>
  );
}
