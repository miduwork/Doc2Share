"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useRef, useEffect } from "react";
import { User, LogOut, BookOpen, Shield, ChevronDown, Menu } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useUserRole } from "@/hooks/useUserRole";

export default function Header() {
  const pathname = usePathname();
  const supabase = createClient();
  const { user, isAdmin } = useUserRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const [docMenuOpen, setDocMenuOpen] = useState(false);
  const docMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!docMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (docMenuRef.current && !docMenuRef.current.contains(e.target as Node)) setDocMenuOpen(false);
    };
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  }, [docMenuOpen]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const navLink = (href: string, label: string, active?: boolean) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
        active
          ? "bg-primary/10 text-primary shadow-insetSoft"
          : "text-muted hover:bg-surface-muted hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="section-container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-primary transition hover:opacity-90"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-glow">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">Doc2Share</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLink("/", "Trang chủ", pathname === "/")}
          <div className="relative" ref={docMenuRef}>
            <button
              type="button"
              onClick={() => setDocMenuOpen((o) => !o)}
              onMouseEnter={() => setDocMenuOpen(true)}
              onMouseLeave={() => setDocMenuOpen(false)}
              aria-expanded={docMenuOpen}
              aria-haspopup="true"
              aria-controls="doc-menu"
              id="doc-menu-button"
              className={`flex items-center gap-1 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                pathname.startsWith("/tai-lieu")
                  ? "bg-primary/10 text-primary shadow-insetSoft"
                  : "text-muted hover:bg-surface-muted hover:text-fg"
              }`}
            >
              Tài liệu
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>
            {docMenuOpen && (
              <div
                id="doc-menu"
                role="menu"
                aria-labelledby="doc-menu-button"
                className="absolute left-0 top-full pt-1"
                onMouseEnter={() => setDocMenuOpen(true)}
                onMouseLeave={() => setDocMenuOpen(false)}
              >
                <div className="w-56 rounded-2xl border border-line bg-surface py-2 shadow-premium">
                  <Link
                    href="/tai-lieu"
                    role="menuitem"
                    onClick={() => setDocMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-fg hover:bg-surface-muted"
                  >
                    Tất cả tài liệu
                  </Link>
                  <Link
                    href="/tai-lieu?grade="
                    role="menuitem"
                    onClick={() => setDocMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-fg hover:bg-surface-muted"
                  >
                    Lọc theo khối lớp
                  </Link>
                  <Link
                    href="/tai-lieu?subject="
                    role="menuitem"
                    onClick={() => setDocMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-fg hover:bg-surface-muted"
                  >
                    Lọc theo môn học
                  </Link>
                  <Link
                    href="/tai-lieu?exam="
                    role="menuitem"
                    onClick={() => setDocMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-fg hover:bg-surface-muted"
                  >
                    Lọc theo kỳ thi
                  </Link>
                </div>
              </div>
            )}
          </div>
          {user ? (
            <>
              {navLink("/dashboard", "Tủ sách", pathname === "/dashboard")}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-accent-600 transition hover:bg-accent-50 dark:hover:bg-accent-900/20"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              )}
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-muted py-1 pl-3 pr-1">
              <User className="h-4 w-4 text-muted" />
              <span className="max-w-[120px] truncate text-sm font-medium text-fg sm:max-w-[160px]">
                {user.email}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-xl p-2 text-muted transition hover:bg-surface-muted hover:text-fg"
                aria-label="Đăng xuất"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-secondary"
              >
                Đăng nhập
              </Link>
              <Link
                href="/signup"
                className="btn-primary"
              >
                Đăng ký
              </Link>
            </>
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

      {menuOpen && (
        <div className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-2">
            {navLink("/", "Trang chủ", pathname === "/")}
            {navLink("/tai-lieu", "Tài liệu", pathname.startsWith("/tai-lieu"))}
            {user && navLink("/dashboard", "Tủ sách", pathname === "/dashboard")}
            {user && isAdmin && (
              <Link href="/admin" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-accent-600">
                Admin
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
