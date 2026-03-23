import Link from "next/link";
import PublicLayout from "@/components/layout/PublicLayout";

export const metadata = {
  title: "Chính sách bảo mật | Doc2Share",
  description: "Chính sách bảo mật thông tin người dùng Doc2Share.",
};

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <article className="content-prose section-container mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-semantic-heading">Chính sách bảo mật</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Nội dung chính sách bảo mật đang được cập nhật. Chúng tôi cam kết bảo vệ dữ liệu cá nhân của bạn. Chi tiết sẽ được công bố sớm.
        </p>
        <p className="mt-4">
          <Link href="/">Về trang chủ</Link>
        </p>
      </article>
    </PublicLayout>
  );
}
