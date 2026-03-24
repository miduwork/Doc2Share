import Link from "next/link";
import { ShieldX } from "lucide-react";
import PublicLayout from "@/features/layout/components/PublicLayout";

export default function UnauthorizedPage() {
  return (
    <PublicLayout>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <ShieldX className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-bold text-semantic-heading">
          403 – Không có quyền truy cập
        </h1>
        <p className="max-w-md text-slate-600 dark:text-slate-400">
          Bạn không có quyền truy cập trang này. Nếu bạn tin đây là nhầm lẫn, vui lòng liên hệ quản trị viên.
        </p>
        <div className="flex gap-3">
          <Link href="/" className="btn-secondary">
            Về trang chủ
          </Link>
          <Link href="/tu-sach" className="btn-primary">
            Tủ sách
          </Link>
        </div>
        </div>
      </div>
    </PublicLayout>
  );
}
