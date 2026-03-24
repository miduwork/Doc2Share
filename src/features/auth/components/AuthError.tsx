"use client";

export default function AuthError({
  message,
  variant = "block",
  id,
}: {
  message: string | null;
  variant?: "block" | "field";
  id?: string;
}) {
  if (!message) return null;
  return (
    <div
      id={id}
      className={
        variant === "field"
          ? "mt-1.5 text-sm text-red-600 dark:text-red-400"
          : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
      }
      role="alert"
    >
      {message}
    </div>
  );
}

