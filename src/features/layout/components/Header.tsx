"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { User, LogOut, BookOpen, Shield, Menu, Library } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useUserRole } from "@/features/layout/hooks/useUserRole";
import { useLogout } from "@/features/auth/hooks/useLogout";

export default function Header() {
  const pathname = usePathname();
  const { user, isAdmin } = useUserRole();
  const { triggerLogout, loading: logoutLoading } = useLogout();
  const showTuSach = !!user && !isAdmin;
  const showAdmin = !!user && isAdmin;
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await triggerLogout({ redirectTo: "/" });
  }

  const navLink = (href: string, label: string, active?: boolean) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      className={`rounded-xl px-4 py-2 text-sm font-bold transition whitespace-nowrap ${active
        ? "bg-primary/10 text-primary shadow-insetSoft"
        : "text-muted hover:bg-surface-muted hover:text-primary dark:hover:bg-surface-muted dark:hover:text-primary-400"
        }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="section-container flex h-16 items-center justify-between gap-4">
        {/* LOGO AREA */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3.5 font-bold text-primary transition hover:opacity-90 active:scale-[0.98]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-glow">
            <BookOpen className="h-8 w-8" />
          </span>
          <span className="logo-text hidden whitespace-nowrap text-2xl tracking-tight">Doc2Share</span>
        </Link>

        {/* CENTER NAVIGATION - ABSOLUTE CENTER ON DESKTOP */}
        <nav className="absolute-center-nav desktop-nav hidden md:flex items-center justify-center">
          {navLink("/", "Trang chủ", pathname === "/")}

          {navLink("/cua-hang", "Cửa hàng", pathname.startsWith("/cua-hang"))}

          {showTuSach ? (
            <Link
              href="/tu-sach"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition whitespace-nowrap ${pathname === "/tu-sach"
                  ? "bg-primary/10 text-primary shadow-insetSoft"
                  : "text-muted hover:bg-surface-muted hover:text-primary dark:hover:bg-surface-muted dark:hover:text-primary-400"
                }`}
            >
              <Library className="h-4 w-4" />
              Tủ sách
            </Link>
          ) : null}

          {showAdmin ? (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-accent-600 transition hover:bg-accent-50 dark:hover:bg-accent-900/20 whitespace-nowrap"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          ) : null}
        </nav>

        {/* RIGHT SIDE ACTIONS */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          {user ? (
            <div className="flex items-center gap-2 rounded-full border border-line bg-blue-50/50 px-3.5 py-1.5 dark:bg-blue-900/10">
              <User className="h-4 w-4 text-primary-500" />
              <span className="max-w-[120px] truncate text-xs font-bold text-fg sm:max-w-[160px]">
                {user.email}
              </span>
              <button
                type="button"
                onClick={signOut}
                disabled={logoutLoading}
                className="ml-1 rounded-full p-1 text-muted transition hover:bg-surface-muted hover:text-fg"
                aria-label="Đăng xuất"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Link href="/login" className="px-4 py-2 text-sm font-bold text-muted hover:text-primary transition">
                Đăng nhập
              </Link>
              <Link href="/signup" className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white shadow-glow transition hover:bg-primary-600 active:scale-95">
                Đăng ký
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-xl p-2 text-muted hover:bg-surface-muted md:hidden"
            aria-label="Menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-2">
            {navLink("/", "Trang chủ", pathname === "/")}
            {navLink("/cua-hang", "Cửa hàng", pathname.startsWith("/cua-hang"))}
            {showTuSach ? (
              <Link
                href="/tu-sach"
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition whitespace-nowrap ${pathname === "/tu-sach" ? "bg-primary/10 text-primary" : "text-muted"
                  }`}
              >
                <Library className="h-4 w-4" />
                Tủ sách
              </Link>
            ) : null}
            {showAdmin ? (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-accent-600"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
