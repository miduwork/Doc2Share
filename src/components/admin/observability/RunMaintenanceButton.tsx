"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { runMaintenanceNow } from "@/app/admin/observability/actions";

export default function RunMaintenanceButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await runMaintenanceNow();
      if (result.ok) {
        toast.success(result.data?.message ?? "Maintenance hoàn tất.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      title="Chạy cleanup + alert checks ngay bây giờ"
    >
      {isPending ? "Running..." : "Run maintenance now"}
    </button>
  );
}
