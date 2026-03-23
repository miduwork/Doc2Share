import { buildUploadFormDataFromParts } from "./upload-document-schema";

export const MAX_QUEUE_SIZE = 20;

export type QueueStatus = "pending" | "uploading" | "done" | "error";

export interface QueueItem {
  id: string;
  title: string;
  description: string;
  price: number;
  subject_id: number | null;
  grade_id: number | null;
  exam_id: number | null;
  is_downloadable: boolean;
  mainFile: File;
  coverFile: File;
  previewFile: File | null;
  status: QueueStatus;
  error?: string;
}

export function buildFormDataFromQueueItem(item: QueueItem): FormData {
  return buildUploadFormDataFromParts({
    title: item.title,
    description: item.description ?? "",
    price: item.price,
    subject_id: item.subject_id,
    grade_id: item.grade_id,
    exam_id: item.exam_id,
    is_downloadable: item.is_downloadable,
    mainFile: item.mainFile,
    coverFile: item.coverFile,
    previewFile: item.previewFile,
  });
}
