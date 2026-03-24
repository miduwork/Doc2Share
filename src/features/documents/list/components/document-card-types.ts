import type { ReactNode } from "react";
import type { Category } from "@/lib/types";

/** Dữ liệu tài liệu dùng chung cho DocumentCard và DocumentListCard */
export type DocumentCardDoc = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  preview_url?: string | null;
  thumbnail_url?: string | null;
  is_downloadable?: boolean;
  subject_id?: number | null;
  grade_id?: number | null;
  exam_id?: number | null;
};

export type DocumentListCardProps = {
  doc: DocumentCardDoc;
  categories: Category[];
  viewCount?: number | null;
  soldCount?: number;
  ratingCount?: number;
  avgRating?: number | null;
  /** Badge góc trên ảnh — đồng bộ với DocumentCard */
  topBadge?: "premium" | "free" | false | ReactNode;
};
