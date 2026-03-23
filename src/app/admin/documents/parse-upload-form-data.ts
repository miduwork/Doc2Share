/**
 * Parse FormData từ client upload — dùng chung cho upload trực tiếp và hoàn tất nháp.
 * Không phải Server Action (hàm thuần, có thể test).
 */
export type ParsedUploadFormData = {
  title: string;
  description: string | null;
  price: number;
  subject_id: number | null;
  grade_id: number | null;
  exam_id: number | null;
  is_downloadable: boolean;
  mainFile: File | null;
  coverFile: File | null;
  previewFile: File | null;
};

function toCategoryId(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseUploadFormData(formData: FormData): ParsedUploadFormData {
  const title = (formData.get("title") as string) ?? "";
  const description = (formData.get("description") as string) || null;
  const price = Number(formData.get("price"));
  const subject_id = formData.get("subject_id");
  const grade_id = formData.get("grade_id");
  const exam_id = formData.get("exam_id");
  const is_downloadable = formData.get("is_downloadable") === "true" || formData.get("is_downloadable") === "on";
  const mainFile = formData.get("mainFile") as File | null;
  const coverFile = formData.get("coverFile") as File | null;
  const previewFile = (formData.get("previewFile") as File | null) ?? null;

  return {
    title,
    description,
    price: Number.isFinite(price) ? price : 0,
    subject_id: toCategoryId(subject_id as FormDataEntryValue | null),
    grade_id: toCategoryId(grade_id as FormDataEntryValue | null),
    exam_id: toCategoryId(exam_id as FormDataEntryValue | null),
    is_downloadable,
    mainFile,
    coverFile,
    previewFile: previewFile && previewFile.size > 0 ? previewFile : null,
  };
}
