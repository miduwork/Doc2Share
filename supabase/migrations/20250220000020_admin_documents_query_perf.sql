-- P0/P1 admin documents query performance

CREATE INDEX IF NOT EXISTS idx_documents_status_created_desc
  ON documents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_status_grade_created
  ON documents (status, grade_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_status_subject_created
  ON documents (status, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_status_exam_created
  ON documents (status, exam_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_doc_status_updated
  ON document_processing_jobs (document_id, status, updated_at DESC);
