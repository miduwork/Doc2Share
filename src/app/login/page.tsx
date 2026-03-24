import { Suspense } from "react";
import { t } from "@/lib/i18n";
import LoginForm from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="text-slate-500">{t("common.loading")}</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

