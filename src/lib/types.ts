/**
 * Shared app types. Only types actually imported elsewhere are kept.
 * Order/checkout types live in @/lib/domain/checkout/ports.
 */
export type CategoryType = "subject" | "grade" | "exam";
export type ProfileRole = "student" | "teacher" | "admin";
export type AdminRole = "super_admin" | "content_manager" | "support_agent";

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  position: number;
  created_at?: string;
}
