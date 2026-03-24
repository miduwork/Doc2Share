"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { mapAuthError } from "@/lib/authErrors";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Mail } from "lucide-react";
import AuthPageShell from "@/features/auth/components/AuthPageShell";
import AuthError from "@/features/auth/components/AuthError";

export default function ForgotPasswordForm() {
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
    <AuthPageShell
      icon={<BookOpen className="h-6 w-6" />}
      title={t("auth.forgotPassword.title")}
      subtitle={t("auth.forgotPassword.subtitle")}
    >
      {sent ? (
        <div className="mt-8 rounded-xl bg-emerald-50 p-4 text-center dark:bg-emerald-900/20">
          <Mail className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <div className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">{t("auth.forgotPassword.sentTitle")}</div>
          <div className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{t("auth.forgotPassword.sentMessage")}</div>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </div>
      ) : (
        <>
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
                aria-describedby={errorEmail ? "forgot-email-error" : undefined}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-semantic-heading placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:placeholder-slate-500"
              />
              <AuthError id="forgot-email-error" message={errorEmail || null} variant="field" />
            </div>

            <AuthError message={error || null} />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-card transition hover:bg-primary-700 hover:shadow-cardHover disabled:opacity-50"
            >
              {loading ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("auth.forgotPassword.backToLogin")}
            </Link>
          </div>
        </>
      )}
    </AuthPageShell>
  );
}

