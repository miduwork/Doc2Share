"use client";

import { useState } from "react";
import Link from "next/link";
import PublicLayout from "@/components/layout/PublicLayout";
import { t } from "@/lib/i18n";
import { mapAuthError } from "@/lib/authErrors";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [errorEmail, setErrorEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorEmail("");
    setLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      const { field, message } = mapAuthError(err, "forgot");
      if (field === "email") setErrorEmail(message);
      else setError(message);
      return;
    }
    setSent(true);
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
              {t("auth.forgotPassword.title")}
            </h1>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("auth.forgotPassword.subtitle")}
            </p>
            {sent ? (
              <div className="mt-8 rounded-xl bg-emerald-50 p-4 text-center dark:bg-emerald-900/20">
                <Mail className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                <p className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  {t("auth.forgotPassword.sentTitle")}
                </p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  {t("auth.forgotPassword.sentMessage")}
                </p>
                <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                  {t("auth.forgotPassword.backToLogin")}
                </Link>
              </div>
            ) : (
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
                    aria-describedby={errorEmail ? "forgot-email-error" : undefined}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                  />
                  {errorEmail && (
                    <p id="forgot-email-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{errorEmail}</p>
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
                  className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-card transition hover:bg-primary-700 hover:shadow-cardHover disabled:opacity-50"
                >
                  {loading ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
                </button>
              </form>
            )}
            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("auth.forgotPassword.backToLogin")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
