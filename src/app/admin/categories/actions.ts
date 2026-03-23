"use server";

import { createClient } from "@/lib/supabase/server";
import { requireDocumentManagerContext } from "@/lib/admin/guards";
import { revalidatePath } from "next/cache";
import type { CategoryType } from "@/lib/types";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export type CategoryRow = { id: number; name: string; type: string; created_at?: string };

export async function createCategory(name: string, type: CategoryType): Promise<ActionResult<CategoryRow>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);
  const trimmed = name.trim();
  if (!trimmed) return fail("Tên không được để trống.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: trimmed, type })
    .select("id, name, type, created_at")
    .single();
  if (error) return fail(error.message);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/documents");
  revalidatePath("/");
  revalidatePath("/tai-lieu");
  return ok(data as CategoryRow);
}

export async function updateCategory(id: number, name: string): Promise<ActionResult<CategoryRow>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);
  const trimmed = name.trim();
  if (!trimmed) return fail("Tên không được để trống.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name: trimmed })
    .eq("id", id)
    .select("id, name, type, created_at")
    .single();
  if (error) return fail(error.message);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/documents");
  revalidatePath("/");
  revalidatePath("/tai-lieu");
  return ok(data as CategoryRow);
}

export async function deleteCategory(id: number): Promise<ActionResult<void>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/documents");
  revalidatePath("/");
  revalidatePath("/tai-lieu");
  return ok();
}
