"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { mapAuthError } from "@/lib/authErrors";
import { createClient } from "@/lib/supabase/client";
import { BookOpen } from "lucide-react";
import { loginWithPassword } from "@/app/login/actions";
import AuthPageShell from "@/features/auth/components/AuthPageShell";
import AuthError from "@/features/auth/components/AuthError";

function getDeviceId(): string {
  let id = localStorage.getItem("doc2share_device_id");
  if (!id) {
    id = "fp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("doc2share_device_id", id);
  }
  return id;
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/tu-sach";
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

    const deviceId = getDeviceId();
    const loginResult = await loginWithPassword(email, password, deviceId);

    setLoading(false);
    if (!loginResult.ok) {
      const { field, message } = mapAuthError({ message: loginResult.error } as Error, "login");
      if (field === "email") setErrorEmail(message);
      else if (field === "password") setErrorPassword(message);
      else setError(message);
      return;
    }

    window.location.href = redirect;
  }

  return (
    <AuthPageShell
      icon={<BookOpen className="h-6 w-6" />}
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <div className="mt-6 flex items-center justify-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <span>{t("auth.login.noAccount")}</span>
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t("auth.login.signUp")}
          </Link>
        </div>
      }
    >
      {successPasswordReset ? (
        <div
          className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
          role="status"
        >
          {t("auth.login.passwordResetSuccess")}
        </div>
      ) : null}

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
            onChange={(e) => {
              setEmail(e.target.value);
              setErrorEmail("");
            }}
            required
            autoComplete="email"
            aria-invalid={!!errorEmail}
            aria-describedby={errorEmail ? "login-email-error" : undefined}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-semantic-heading placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:placeholder-slate-500"
          />
          <AuthError id="login-email-error" message={errorEmail || null} variant="field" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("common.password")}
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              {t("auth.login.forgotPassword")}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            placeholder={t("common.passwordPlaceholderDots")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorPassword("");
            }}
            required
            autoComplete="current-password"
            aria-invalid={!!errorPassword}
            aria-describedby={errorPassword ? "login-password-error" : undefined}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-semantic-heading placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:placeholder-slate-500"
          />
          <AuthError id="login-password-error" message={errorPassword || null} variant="field" />
        </div>

        <AuthError message={error || null} />

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
              options: { redirectTo: `${origin}/tu-sach` },
            });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3.5 text-base font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t("auth.login.signInWithGoogle")}
        </button>
      </form>
    </AuthPageShell>
  );
}

