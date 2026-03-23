import { z } from "zod";

export const isFileList = (v: unknown): v is FileList =>
  typeof globalThis.FileList !== "undefined" && v instanceof globalThis.FileList;

export const uploadSchema = z
  .object({
    title: z.string().min(1, "Nhập tiêu đề"),
    description: z.string().optional(),
    price: z.coerce.number().min(0, "Giá không âm"),
    is_downloadable: z.boolean(),
    subject_id: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().nullable().optional()),
    grade_id: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().nullable().optional()),
    exam_id: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().nullable().optional()),
    mainFile: z
      .unknown()
      .refine((f) => isFileList(f) && f.length === 1 && f[0]?.type === "application/pdf", "Chọn 1 file PDF"),
    coverFile: z
      .unknown()
      .refine(
        (f) =>
          isFileList(f) &&
          f.length === 1 &&
          (f[0]?.type === "image/jpeg" || f[0]?.type === "image/png"),
        "Chọn 1 ảnh JPG hoặc PNG"
      ),
    previewFile: z
      .unknown()
      .optional()
      .refine((f) => f == null || !isFileList(f) || f.length === 0 || f[0]?.type === "application/pdf", {
        message: "Preview phải là PDF",
      }),
  })
  .refine(
    (data) =>
      !isFileList(data.previewFile) || !data.previewFile?.length || data.previewFile[0]?.type === "application/pdf",
    { message: "Preview phải là PDF", path: ["previewFile"] }
  );

export type UploadFormData = z.infer<typeof uploadSchema>;

export type UploadFormDataParts = {
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
};

function categoryIdToFormValue(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) && v > 0 ? String(v) : "";
}

/**
 * Chung cho submit form và hàng đợi — khớp với parse trên server.
 */
export function buildUploadFormDataFromParts(
  parts: UploadFormDataParts,
  options?: { session_id?: string }
): FormData {
  const formData = new FormData();
  formData.set("title", parts.title);
  formData.set("description", parts.description ?? "");
  formData.set("price", String(parts.price));
  formData.set("subject_id", categoryIdToFormValue(parts.subject_id));
  formData.set("grade_id", categoryIdToFormValue(parts.grade_id));
  formData.set("exam_id", categoryIdToFormValue(parts.exam_id));
  formData.set("is_downloadable", parts.is_downloadable ? "true" : "false");
  formData.set("mainFile", parts.mainFile);
  formData.set("coverFile", parts.coverFile);
  if (parts.previewFile) formData.set("previewFile", parts.previewFile);
  if (options?.session_id) formData.set("session_id", options.session_id);
  return formData;
}

export function buildFormDataFromUploadFormData(
  data: UploadFormData,
  options?: { session_id?: string }
): FormData {
  const main = (data.mainFile as FileList)[0];
  const cover = (data.coverFile as FileList)[0];
  const preview =
    data.previewFile != null && (data.previewFile as FileList).length
      ? (data.previewFile as FileList)[0]
      : null;
  return buildUploadFormDataFromParts(
    {
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
    },
    options
  );
}
