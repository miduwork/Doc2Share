import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-line py-8">
      <div className="section-container flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-sm text-muted">
        <div>© Doc2Share. Tài liệu được bảo vệ bản quyền.</div>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-primary hover:underline">
            Điều khoản
          </Link>
          <Link href="/privacy" className="hover:text-primary hover:underline">
            Chính sách bảo mật
          </Link>
          <Link href="/contact" className="hover:text-primary hover:underline">
            Liên hệ / FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
}

