import Link from "next/link";
import PublicLayout from "@/features/layout/components/PublicLayout";

export const metadata = {
  title: "Điều khoản sử dụng | Doc2Share",
  description: "Điều khoản sử dụng dịch vụ Doc2Share.",
};

export default function TermsPage() {
  return (
    <PublicLayout>
      <article className="content-prose mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-semantic-heading">Điều khoản sử dụng</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Nội dung điều khoản đang được cập nhật. Bạn vui lòng quay lại sau hoặc liên hệ qua trang Liên hệ / FAQ.
        </p>
        <p className="mt-4">
          <Link href="/">Về trang chủ</Link>
        </p>
      </article>
    </PublicLayout>
  );
}
