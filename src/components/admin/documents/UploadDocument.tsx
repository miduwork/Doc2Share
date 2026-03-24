"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Upload, Loader2, FileText, ListOrdered } from "lucide-react";
import {
  uploadDocumentWithMetadata,
  saveDocumentDraft,
  getDocumentDrafts,
  uploadDocumentFromDraft,
  type DraftSessionRow,
} from "@/app/admin/documents/upload-actions";
import type { Category } from "@/lib/types";
import { uploadSchema, type UploadFormData, buildFormDataFromUploadFormData } from "./upload/upload-document-schema";
import {
  MAX_QUEUE_SIZE,
  type QueueItem,
  type QueueStatus,
  buildFormDataFromQueueItem,
} from "./upload/upload-queue-types";
import { UploadDocumentDraftSection } from "./upload/UploadDocumentDraftSection";
import { UploadDocumentFileFields, UploadDocumentFormFields } from "./upload/UploadDocumentFormFields";
import { UploadDocumentQueueSection } from "./upload/UploadDocumentQueueSection";

interface Props {
  categories: Category[];
  onSuccess?: () => void;
}

export default function UploadDocument({ categories, onSuccess }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [queueConcurrency, setQueueConcurrency] = useState<1 | 2 | 3>(1);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [drafts, setDrafts] = useState<DraftSessionRow[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  useEffect(() => {
    setLoadingDrafts(true);
    getDocumentDrafts()
      .then((r) => {
        if (r.ok && r.data) setDrafts(r.data);
      })
      .finally(() => setLoadingDrafts(false));
  }, []);

  const subjects = categories.filter((c) => c.type === "subject");
  const grades = categories.filter((c) => c.type === "grade");
  const exams = categories.filter((c) => c.type === "exam");

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
    reset,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema) as Resolver<UploadFormData>,
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      is_downloadable: false,
      subject_id: "" as unknown as number | null,
      grade_id: "" as unknown as number | null,
      exam_id: "" as unknown as number | null,
    },
  });

  const addToQueue = useCallback(
    (data: UploadFormData) => {
      if (queue.length >= MAX_QUEUE_SIZE) {
        toast.error(`Tối đa ${MAX_QUEUE_SIZE} tài liệu trong hàng đợi.`);
        return;
      }
      const main = (data.mainFile as FileList)[0];
      const cover = (data.coverFile as FileList)[0];
      const preview =
        data.previewFile != null && (data.previewFile as FileList).length
          ? (data.previewFile as FileList)[0]
          : null;
      const item: QueueItem = {
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description ?? "",
        price: data.price,
        subject_id: data.subject_id ?? null,
        grade_id: data.grade_id ?? null,
        exam_id: data.exam_id ?? null,
        is_downloadable: data.is_downloadable,
        mainFile: main,
        coverFile: cover,
        previewFile: preview,
        status: "pending",
      };
      setQueue((prev) => [...prev, item]);
      reset();
      (document.getElementById("upload-form") as HTMLFormElement)?.reset();
      toast.success("Đã thêm vào hàng đợi.");
    },
    [queue.length, reset]
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const handleSaveDraft = useCallback(async () => {
    const v = getValues();
    const title = (v.title ?? "").trim();
    if (!title) {
      toast.error("Nhập tiêu đề để lưu nháp.");
      return;
    }
    setSavingDraft(true);
    try {
      const result = await saveDocumentDraft({
        title,
        description: v.description ?? null,
        price: Number(v.price) || 0,
        subject_id: v.subject_id ?? null,
        grade_id: v.grade_id ?? null,
        exam_id: v.exam_id ?? null,
        is_downloadable: v.is_downloadable ?? false,
        session_id: draftSessionId,
      });
      if (result.ok && result.data) {
        setDraftSessionId(result.data.session_id);
        toast.success(`Đã lưu nháp. Mã phiên: ${result.data.session_id.slice(0, 8)}…`);
      } else {
        toast.error("error" in result ? result.error : "Không lưu được nháp.");
      }
    } finally {
      setSavingDraft(false);
    }
  }, [getValues, draftSessionId]);

  const selectDraft = useCallback(
    (draft: DraftSessionRow) => {
      setDraftSessionId(draft.id);
      setValue("title", draft.title);
      setValue("description", draft.description ?? "");
      setValue("price", draft.price);
      setValue("subject_id", draft.subject_id != null ? draft.subject_id : ("" as unknown as number | null));
      setValue("grade_id", draft.grade_id != null ? draft.grade_id : ("" as unknown as number | null));
      setValue("exam_id", draft.exam_id != null ? draft.exam_id : ("" as unknown as number | null));
      setValue("is_downloadable", draft.is_downloadable);
      toast.success(`Đang tiếp tục nháp: ${draft.title}`);
    },
    [setValue]
  );

  const clearDraftSelection = useCallback(() => {
    setDraftSessionId(null);
  }, []);

  const processAllQueue = useCallback(async () => {
    const pending = queue.filter((q) => q.status === "pending");
    if (pending.length === 0) return;
    setProcessingQueue(true);
    const concurrency = Math.max(1, Math.min(3, queueConcurrency));
    for (let i = 0; i < pending.length; i += concurrency) {
      const chunk = pending.slice(i, i + concurrency);
      const chunkIds = new Set(chunk.map((c) => c.id));
      setQueue((prev) =>
        prev.map((q) => (chunkIds.has(q.id) ? { ...q, status: "uploading" as QueueStatus } : q))
      );
      const results = await Promise.all(
        chunk.map(async (item) => {
          const formData = buildFormDataFromQueueItem(item);
          return { id: item.id, result: await uploadDocumentWithMetadata(formData) };
        })
      );
      setQueue((prev) =>
        prev.map((q) => {
          const r = results.find((x) => x.id === q.id);
          if (!r) return q;
          return {
            ...q,
            status: (r.result.ok ? "done" : "error") as QueueStatus,
            error: r.result.ok ? undefined : r.result.error,
          };
        })
      );
      results.filter((r) => r.result.ok).forEach(() => onSuccess?.());
    }
    setProcessingQueue(false);
    toast.success("Đã xử lý xong hàng đợi.");
  }, [queue, onSuccess, queueConcurrency]);

  const onSubmit = async (data: UploadFormData) => {
    const activeDraftId = draftSessionId;
    setUploading(true);
    setProgress(10);
    try {
      setProgress(30);
      const formData = buildFormDataFromUploadFormData(
        data,
        activeDraftId ? { session_id: activeDraftId } : undefined
      );

      setProgress(50);
      const result = activeDraftId ? await uploadDocumentFromDraft(formData) : await uploadDocumentWithMetadata(formData);

      setProgress(100);
      if (result.ok) {
        toast.success(activeDraftId ? "Đã gắn file và hoàn tất nháp." : "Tải lên thành công. Tài liệu đã được lưu.");
        setDraftSessionId(null);
        if (activeDraftId) {
          setDrafts((prev) => prev.filter((d) => d.id !== activeDraftId));
        }
        reset();
        (document.getElementById("upload-form") as HTMLFormElement)?.reset();
        onSuccess?.();
      } else {
        toast.error("error" in result ? result.error : "Lỗi tải lên");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi tải lên";
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <form
      id="upload-form"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-xl border border-line bg-surface p-4"
      aria-labelledby="upload-form-heading"
    >
      <h2 id="upload-form-heading" className="text-lg font-semibold text-semantic-heading">
        Tải tài liệu mới
      </h2>

      <UploadDocumentDraftSection
        draftSessionId={draftSessionId}
        drafts={drafts}
        loadingDrafts={loadingDrafts}
        onClearDraft={clearDraftSelection}
        onSelectDraft={selectDraft}
      />

      <UploadDocumentFormFields
        register={register}
        errors={errors}
        subjects={subjects}
        grades={grades}
        exams={exams}
      />

      <UploadDocumentFileFields register={register} errors={errors} />

      <section className="premium-panel space-y-2 border-transparent p-2.5 shadow-none" aria-label="Hành động tải lên">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {uploading ? "Đang xử lý..." : draftSessionId ? "Gắn file và hoàn tất" : "Tải lên ngay"}
          </button>
          <button
            type="button"
            disabled={uploading || queue.length >= MAX_QUEUE_SIZE}
            onClick={handleSubmit(addToQueue)}
            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-surface-muted disabled:opacity-50"
          >
            <ListOrdered className="h-4 w-4" aria-hidden />
            Thêm vào hàng đợi
          </button>
          <button
            type="button"
            disabled={uploading || savingDraft}
            onClick={handleSaveDraft}
            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-surface-muted/50 px-3.5 py-2 text-sm font-medium text-muted transition hover:border-primary/50 hover:text-fg disabled:opacity-50"
            aria-label="Lưu nháp chỉ metadata, không cần chọn file"
          >
            {savingDraft ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )}
            {savingDraft ? "Đang lưu…" : "Lưu nháp"}
          </button>
        </div>
      </section>

      {uploading && (
        <div className="rounded-lg bg-surface-muted" role="status" aria-live="polite">
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            <span className="text-sm font-medium text-semantic-heading">Đang tải lên và đồng bộ...</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-b-lg bg-line"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ tải lên"
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: progress ? `${progress}%` : "30%" }}
            />
          </div>
        </div>
      )}

      <UploadDocumentQueueSection
        queue={queue}
        queueConcurrency={queueConcurrency}
        processingQueue={processingQueue}
        onConcurrencyChange={setQueueConcurrency}
        onProcessAll={processAllQueue}
        onRemove={removeFromQueue}
      />
    </form>
  );
}
