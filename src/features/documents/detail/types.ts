import type { Category } from "@/lib/types";

export type CategoryRef = Pick<Category, "id" | "name">;

export type ProductPageDoc = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  preview_url: string | null;
  preview_text: string | null;
  thumbnail_url?: string | null;
  is_downloadable: boolean;
  subject: CategoryRef | null;
  grade: CategoryRef | null;
  exam: CategoryRef | null;
};

export type ReviewRow = {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type CommentRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type RelatedDoc = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  preview_url: string | null;
  thumbnail_url: string | null;
  is_downloadable: boolean;
  subject_id: number | null;
  grade_id: number | null;
  exam_id: number | null;
};

export type ProductPageClientProps = {
  doc: ProductPageDoc;
  reviews?: ReviewRow[];
  comments?: CommentRow[];
};

export type ProductPageData = {
  docForClient: ProductPageDoc;
  categories: Category[] | null;
  reviewsList: ReviewRow[];
  commentsList: CommentRow[];
  schema: Record<string, unknown>;
  relatedDocs: RelatedDoc[];
};

