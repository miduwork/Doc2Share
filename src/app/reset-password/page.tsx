"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PublicLayout from "@/components/layout/PublicLayout";
import { t } from "@/lib/i18n";
import { mapAuthError } from "@/lib/authErrors";
import { createClient } from "@/lib/supabase/client";
import { BookOpen } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecovery, setHasRecovery] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const params = new URLSearchParams(hash.replace("#", ""));
    const type = params.get("type");
    setHasRecovery(type === "recovery");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorPassword("");
    if (password !== confirmPassword) {
      setError(t("auth.resetPassword.errorPasswordMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.resetPassword.errorPasswordMin"));
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      const { field, message } = mapAuthError(err, "reset");
      if (field === "password") setErrorPassword(message);
      else setError(message);
      return;
    }
    router.push("/login?success=password-reset");
    router.refresh();
  }

  if (hasRecovery === null) {
    return (
      <PublicLayout>
        <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
          <p className="text-slate-500">{t("auth.resetPassword.verifying")}</p>
        </div>
      </PublicLayout>
    );
  }

  if (!hasRecovery) {
    return (
      <PublicLayout>
        <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-700 dark:bg-slate-800 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              {t("auth.resetPassword.invalidLink")}
            </p>
            <Link href="/forgot-password" className="mt-4 inline-block font-medium text-primary hover:underline">
              {t("auth.resetPassword.requestNew")}
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-700 dark:bg-slate-800">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-card">
                <BookOpen className="h-6 w-6" />
              </span>
            </div>
            <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-semantic-heading">
              {t("auth.resetPassword.title")}
            </h1>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("auth.resetPassword.subtitle")}
            </p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("auth.resetPassword.newPassword")}
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder={t("common.passwordPlaceholderDots")}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorPassword(""); }}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  aria-invalid={!!errorPassword}
                  aria-describedby={errorPassword ? "reset-password-error" : undefined}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                />
                {errorPassword && (
                  <p id="reset-password-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{errorPassword}</p>
                )}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("auth.signup.passwordConfirm")}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder={t("common.passwordPlaceholderDots")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-card transition hover:bg-primary-700 hover:shadow-cardHover disabled:opacity-50"
              >
                {loading ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              <Link href="/login" className="font-medium text-primary hover:underline">
                ← {t("auth.resetPassword.backToLogin")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
