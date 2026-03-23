"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { FileText, Image as ImageIcon, FileStack } from "lucide-react";
import type { Category } from "@/lib/types";
import type { UploadFormData } from "./upload-document-schema";

interface Props {
  register: UseFormRegister<UploadFormData>;
  errors: FieldErrors<UploadFormData>;
  subjects: Category[];
  grades: Category[];
  exams: Category[];
}

export function UploadDocumentFormFields({ register, errors, subjects, grades, exams }: Props) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="upload-title" className="block text-sm font-medium text-semantic-heading">
            Tiêu đề *
          </label>
          <input
            id="upload-title"
            {...register("title")}
            className="input-premium mt-1"
            placeholder="VD: Đề thi thử THPT Quốc gia 2024"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "upload-title-error" : undefined}
          />
          {errors.title && (
            <p id="upload-title-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="upload-description" className="block text-sm font-medium text-semantic-heading">
            Mô tả
          </label>
          <textarea
            id="upload-description"
            {...register("description")}
            rows={3}
            className="input-premium mt-1"
            placeholder="Mô tả ngắn về tài liệu"
            aria-describedby={errors.description ? "upload-description-error" : undefined}
          />
          {errors.description && (
            <p id="upload-description-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.description.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="upload-price" className="block text-sm font-medium text-semantic-heading">
            Giá (₫) *
          </label>
          <input
            id="upload-price"
            type="number"
            min={0}
            step={1000}
            {...register("price")}
            className="input-premium mt-1"
            aria-invalid={Boolean(errors.price)}
            aria-describedby={errors.price ? "upload-price-error" : undefined}
          />
          {errors.price && (
            <p id="upload-price-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.price.message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-8">
          <input
            id="upload-downloadable"
            type="checkbox"
            {...register("is_downloadable")}
            className="rounded border-line"
            aria-describedby="upload-downloadable-desc"
          />
          <label id="upload-downloadable-desc" htmlFor="upload-downloadable" className="text-sm text-semantic-heading">
            Cho phép tải về / in
          </label>
        </div>

        <div>
          <label htmlFor="upload-subject" className="block text-sm font-medium text-semantic-heading">
            Môn học
          </label>
          <select
            id="upload-subject"
            {...register("subject_id")}
            className="input-premium mt-1 min-h-[2.25rem] cursor-pointer"
            aria-describedby="upload-subject-desc"
          >
            <option value="">— Chọn —</option>
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          <p id="upload-subject-desc" className="sr-only">
            Chọn một môn học cho tài liệu
          </p>
        </div>

        <div>
          <label htmlFor="upload-grade" className="block text-sm font-medium text-semantic-heading">
            Khối lớp
          </label>
          <select
            id="upload-grade"
            {...register("grade_id")}
            className="input-premium mt-1 min-h-[2.25rem] cursor-pointer"
            aria-describedby="upload-grade-desc"
          >
            <option value="">— Chọn —</option>
            {grades.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
          <p id="upload-grade-desc" className="sr-only">
            Chọn khối lớp
          </p>
        </div>

        <div>
          <label htmlFor="upload-exam" className="block text-sm font-medium text-semantic-heading">
            Kỳ thi
          </label>
          <select
            id="upload-exam"
            {...register("exam_id")}
            className="input-premium mt-1 min-h-[2.25rem] cursor-pointer"
            aria-describedby="upload-exam-desc"
          >
            <option value="">— Chọn —</option>
            {exams.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}
              </option>
            ))}
          </select>
          <p id="upload-exam-desc" className="sr-only">
            Chọn kỳ thi (tùy chọn)
          </p>
        </div>
      </div>

      <fieldset className="space-y-4 border-t border-line pt-6" aria-describedby="upload-files-desc">
        <legend className="sr-only">Tệp đính kèm</legend>
        <p id="upload-files-desc" className="text-sm text-muted">
          Tài liệu chính (PDF), ảnh bìa (JPG/PNG) bắt buộc; bản xem thử (PDF) tùy chọn.
        </p>
        <div>
          <label htmlFor="upload-mainFile" className="flex items-center gap-2 text-sm font-medium text-semantic-heading">
            <FileText className="h-4 w-4" aria-hidden />
            Tài liệu chính (PDF) *
          </label>
          <input
            id="upload-mainFile"
            type="file"
            accept=".pdf,application/pdf"
            {...register("mainFile")}
            className="mt-1 block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white file:transition"
            aria-invalid={Boolean(errors.mainFile)}
            aria-describedby={errors.mainFile ? "upload-mainFile-error" : undefined}
          />
          {errors.mainFile && (
            <p id="upload-mainFile-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.mainFile.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="upload-coverFile" className="flex items-center gap-2 text-sm font-medium text-semantic-heading">
            <ImageIcon className="h-4 w-4" aria-hidden />
            Ảnh bìa / Thumbnail (JPG hoặc PNG) *
          </label>
          <input
            id="upload-coverFile"
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            {...register("coverFile")}
            className="mt-1 block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white file:transition"
            aria-invalid={Boolean(errors.coverFile)}
            aria-describedby={errors.coverFile ? "upload-coverFile-error" : undefined}
          />
          {errors.coverFile && (
            <p id="upload-coverFile-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.coverFile.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="upload-previewFile" className="flex items-center gap-2 text-sm font-medium text-semantic-heading">
            <FileStack className="h-4 w-4" aria-hidden />
            Bản xem thử (PDF, 3–5 trang) — tùy chọn
          </label>
          <input
            id="upload-previewFile"
            type="file"
            accept=".pdf,application/pdf"
            {...register("previewFile")}
            className="mt-1 block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-surface-muted file:px-4 file:py-2 file:text-fg file:transition"
            aria-describedby={errors.previewFile ? "upload-previewFile-error" : undefined}
          />
          {errors.previewFile && (
            <p id="upload-previewFile-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.previewFile.message}
            </p>
          )}
        </div>
      </fieldset>
    </>
  );
}
