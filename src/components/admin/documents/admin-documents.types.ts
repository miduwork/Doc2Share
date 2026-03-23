export interface DocRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  preview_url: string | null;
  thumbnail_url?: string | null;
  subject_id: number | null;
  grade_id: number | null;
  exam_id: number | null;
  is_downloadable: boolean;
  status?: string;
  quality_score?: number;
  data_quality_status?: string;
  quality_flags?: string[];
  approval_status?: string;
  created_at: string;
}

export interface JobRow {
  document_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  updated_at: string;
}

export interface FiltersState {
  q: string;
  status: string;
  subject_id: string;
  grade_id: string;
  exam_id: string;
  sort: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  preset: string;
}

export type DocumentStatusOption = "draft" | "processing" | "ready" | "failed" | "archived" | "deleted";

export interface EditFormState {
  title: string;
  description: string;
  price: number;
  subject_id: number | null;
  grade_id: number | null;
  exam_id: number | null;
  is_downloadable: boolean;
  status: DocumentStatusOption;
}

export type BulkActionOption =
  | "publish"
  | "submit_approval"
  | "approve"
  | "reject"
  | "archive"
  | "retry_processing"
  | "delete";

export type AdminRoleOption = "super_admin" | "content_manager" | "support_agent" | null;
