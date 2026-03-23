"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PublicLayout from "@/components/layout/PublicLayout";
import { t } from "@/lib/i18n";
import { mapAuthError } from "@/lib/authErrors";
import { createClient } from "@/lib/supabase/client";
import { BookOpen } from "lucide-react";
import { registerDeviceAndSession, loginWithPassword } from "./actions";

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("doc2share_device_id");
  if (!id) {
    id = "fp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("doc2share_device_id", id);
  }
  return id;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const successPasswordReset = searchParams.get("success") === "password-reset";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorEmail, setErrorEmail] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorEmail("");
    setErrorPassword("");
    setLoading(true);
    const loginResult = await loginWithPassword(email, password);
    if (!loginResult.ok) {
      setLoading(false);
      const { field, message } = mapAuthError({ message: loginResult.error } as Error, "login");
      if (field === "email") setErrorEmail(message);
      else if (field === "password") setErrorPassword(message);
      else setError(message);
      return;
    }
    const deviceId = getDeviceId();
    const regResult = await registerDeviceAndSession(deviceId);
    setLoading(false);
    if (!regResult.ok) {
      await supabase.auth.signOut();
      setError(regResult.error);
      return;
    }
    router.push(redirect);
    router.refresh();
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
              {t("auth.login.title")}
            </h1>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("auth.login.subtitle")}
            </p>
            {successPasswordReset && (
              <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-center text-sm font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" role="status">
                {t("auth.login.passwordResetSuccess")}
              </p>
            )}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("common.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder={t("common.emailPlaceholder")}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorEmail(""); }}
                  required
                  autoComplete="email"
                  aria-invalid={!!errorEmail}
                  aria-describedby={errorEmail ? "login-email-error" : undefined}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                />
                {errorEmail && (
                  <p id="login-email-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{errorEmail}</p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t("common.password")}
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t("auth.login.forgotPassword")}
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder={t("common.passwordPlaceholderDots")}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorPassword(""); }}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!errorPassword}
                  aria-describedby={errorPassword ? "login-password-error" : undefined}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                />
                {errorPassword && (
                  <p id="login-password-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{errorPassword}</p>
                )}
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-card transition hover:bg-primary-700 hover:shadow-cardHover disabled:opacity-50 disabled:hover:shadow-card"
              >
                {loading ? t("auth.login.submitting") : t("auth.login.submit")}
              </button>
              <div className="relative my-4">
                <span className="bg-white px-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{t("common.or")}</span>
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-600" />
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setError("");
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${origin}/dashboard` },
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3.5 text-base font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                {t("auth.login.signInWithGoogle")}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("auth.login.noAccount")}{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                {t("auth.login.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface"><p className="text-slate-500">{t("common.loading")}</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
