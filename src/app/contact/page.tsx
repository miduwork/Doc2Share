import Link from "next/link";
import PublicLayout from "@/features/layout/components/PublicLayout";

export const metadata = {
  title: "Liên hệ / FAQ | Doc2Share",
  description: "Liên hệ và câu hỏi thường gặp về Doc2Share.",
};

export default function ContactPage() {
  return (
    <PublicLayout>
      <article className="content-prose section-container mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-semantic-heading">Liên hệ / FAQ</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Bạn có câu hỏi hoặc cần hỗ trợ? Gửi email cho chúng tôi hoặc xem các câu hỏi thường gặp bên dưới. Nội dung chi tiết đang được bổ sung.
        </p>
        <p className="mt-4">
          <Link href="/">Về trang chủ</Link>
        </p>
      </article>
    </PublicLayout>
  );
}
