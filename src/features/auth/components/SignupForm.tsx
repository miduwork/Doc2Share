"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { mapAuthError } from "@/lib/authErrors";
import { createClient } from "@/lib/supabase/client";
import { BookOpen } from "lucide-react";
import AuthPageShell from "@/features/auth/components/AuthPageShell";
import AuthError from "@/features/auth/components/AuthError";

export default function SignupForm() {
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

    router.push("/tu-sach");
    router.refresh();
  }

  return (
    <AuthPageShell
      icon={<BookOpen className="h-6 w-6" />}
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      footer={
        <div className="mt-6 flex items-center justify-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <span>{t("auth.signup.hasAccount")}</span>
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.signup.signIn")}
          </Link>
        </div>
      }
    >
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
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-semantic-heading placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:placeholder-slate-500"
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
            onChange={(e) => {
              setEmail(e.target.value);
              setErrorEmail("");
            }}
            required
            autoComplete="email"
            aria-invalid={!!errorEmail}
            aria-describedby={errorEmail ? "signup-email-error" : undefined}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-semantic-heading placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:placeholder-slate-500"
          />
          <AuthError id="signup-email-error" message={errorEmail || null} variant="field" />
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
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorPassword("");
            }}
            required
            minLength={6}
            aria-invalid={!!errorPassword}
            aria-describedby={errorPassword ? "signup-password-error" : undefined}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-semantic-heading placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:placeholder-slate-500"
          />
          <AuthError id="signup-password-error" message={errorPassword || null} variant="field" />
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
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-semantic-heading placeholder-slate-400 transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-700 dark:placeholder-slate-500"
          />
        </div>

        <AuthError message={error || null} />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-card transition hover:bg-primary-700 hover:shadow-cardHover disabled:opacity-50 disabled:hover:shadow-card"
        >
          {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
        </button>
      </form>
    </AuthPageShell>
  );
}

