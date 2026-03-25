import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
import { isSingleSessionValidForCurrentUser } from "@/lib/auth/single-session";
import { canManageDocuments } from "@/lib/admin/guards-core";
import SecureReader from "@/features/documents/read/components/SecureReader";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReadDocumentPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && !(await isSingleSessionValidForCurrentUser())) {
    return (
      <div className="content-prose flex min-h-screen items-center justify-center">
        <p className="text-slate-600">
          Phiên đăng nhập đã được thay thế bởi thiết bị khác.{" "}
          <Link href="/login">Đăng nhập lại</Link>.
        </p>
      </div>
    );
  }
  const { data: doc } = await supabase
    .from("documents")
    .select("id, title")
    .eq("id", id)
    .single();
  if (!doc) notFound();

  if (!user) {
    return (
      <div className="content-prose flex min-h-screen items-center justify-center">
        <p className="text-slate-600">
          <Link href={`/login?redirect=/doc/${id}/read`}>Đăng nhập</Link> để xem tài liệu.
        </p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_role")
    .eq("id", user.id)
    .maybeSingle();
  const adminRole = profile?.admin_role as "super_admin" | "content_manager" | "support_agent" | null;
  const isAdminCanReadAny = profile?.role === "admin" && canManageDocuments(adminRole);

  if (!isAdminCanReadAny) {
    const { data: perm } = await supabase
      .from("permissions")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .eq("document_id", id)
      .maybeSingle();
    if (!perm) {
      return (
        <div className="content-prose flex min-h-screen items-center justify-center">
          <p className="text-slate-600">Bạn chưa mua tài liệu này. <Link href="/cua-hang">Mua ngay</Link>.</p>
        </div>
      );
    }
    if (perm.expires_at && new Date(perm.expires_at) < new Date()) {
      return (
        <div className="content-prose flex min-h-screen items-center justify-center">
          <p className="text-slate-600">Quyền xem tài liệu đã hết hạn. <Link href="/cua-hang">Mua lại</Link>.</p>
        </div>
      );
    }
  }

  const service = createServiceRoleClient();
  const { data: docStorage, error: docStorageError } = await service
    .from("documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  if (docStorageError) {
    return (
      <div className="content-prose flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-center text-slate-600">
          Không kiểm tra được trạng thái file tài liệu. Vui lòng thử lại sau hoặc{" "}
          <Link href="/tu-sach">về Tủ sách</Link>.
        </p>
      </div>
    );
  }

  const filePathReady = typeof docStorage?.file_path === "string" && docStorage.file_path.trim() !== "";
  if (!filePathReady) {
    return (
      <div className="content-prose flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-center text-slate-600 max-w-md">
          Tài liệu chưa sẵn sàng để đọc (file đang xử lý trong pipeline hoặc chưa được gắn vào bản ghi). Thử lại sau
          hoặc kiểm tra trạng thái xử lý trong quản trị.
        </p>
        <Link href="/tu-sach" className="text-blue-600 underline">
          Về Tủ sách
        </Link>
      </div>
    );
  }

  return (
    <SecureReader
      documentId={id}
      documentTitle={doc.title}
    />
  );
}
