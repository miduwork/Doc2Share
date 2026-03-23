"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PublicLayout from "@/components/layout/PublicLayout";
import { t } from "@/lib/i18n";
import { mapAuthError } from "@/lib/authErrors";
import { createClient } from "@/lib/supabase/client";
import { BookOpen } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fullName, setFullName] = useState("");
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
    if (password !== passwordConfirm) {
      setError(t("auth.signup.errorPasswordMismatch"));
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (err) {
      const { field, message } = mapAuthError(err, "signup");
      if (field === "email") setErrorEmail(message);
      else if (field === "password") setErrorPassword(message);
      else setError(message);
      return;
    }
    router.push("/dashboard");
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
              {t("auth.signup.title")}
            </h1>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("auth.signup.subtitle")}
            </p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("auth.signup.fullName")}
                </label>
                <input
                  id="fullName"
                  type="text"
                  placeholder={t("auth.signup.fullNamePlaceholder")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                />
              </div>
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
                  aria-describedby={errorEmail ? "signup-email-error" : undefined}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                />
                {errorEmail && (
                  <p id="signup-email-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{errorEmail}</p>
                )}
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("common.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder={t("common.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorPassword(""); }}
                  required
                  minLength={6}
                  aria-invalid={!!errorPassword}
                  aria-describedby={errorPassword ? "signup-password-error" : undefined}
                  autoComplete="new-password"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                />
                {errorPassword && (
                  <p id="signup-password-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{errorPassword}</p>
                )}
              </div>
              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("auth.signup.passwordConfirm")}
                </label>
                <input
                  id="passwordConfirm"
                  type="password"
                  placeholder={t("auth.signup.passwordConfirmPlaceholder")}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
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
                className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-card transition hover:bg-primary-700 hover:shadow-cardHover disabled:opacity-50 disabled:hover:shadow-card"
              >
                {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("auth.signup.hasAccount")}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("auth.signup.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
