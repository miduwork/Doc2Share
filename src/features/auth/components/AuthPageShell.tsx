"use client";

import type { ReactNode } from "react";
import PublicLayout from "@/features/layout/components/PublicLayout";

export default function AuthPageShell({
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <PublicLayout>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-700 dark:bg-slate-800">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-card">
                {icon}
              </span>
            </div>
            <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-semantic-heading">{title}</h1>
            {subtitle ? <div className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
            {children}
            {footer ? <div>{footer}</div> : null}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

