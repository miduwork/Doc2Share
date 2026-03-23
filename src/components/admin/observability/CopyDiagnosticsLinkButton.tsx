"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createSignedDiagnosticsLink } from "@/app/admin/observability/actions";

type Props = {
  preset: string;
  windowValue: string;
  severity: string;
  source: string;
  eventType: string;
  alertsCursor: string;
  alertsDir: "next" | "prev";
  alertsPage: number;
  runsPage: number;
  alertsPageSize: number;
  runsPageSize: number;
  exportLimit: number;
};

export default function CopyDiagnosticsLinkButton(props: Props) {
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    startTransition(async () => {
      const result = await createSignedDiagnosticsLink({
        preset: props.preset,
        window: props.windowValue,
        severity: props.severity,
        source: props.source,
        event_type: props.eventType,
        alerts_cursor: props.alertsCursor,
        alerts_dir: props.alertsDir,
        alerts_page: String(props.alertsPage),
        runs_page: String(props.runsPage),
        alerts_page_size: String(props.alertsPageSize),
        runs_page_size: String(props.runsPageSize),
        export_limit: String(props.exportLimit),
      });
      if (!result.ok || !result.data?.link) {
        toast.error(result.ok ? "Không có link." : result.error);
        return;
      }

      try {
        await navigator.clipboard.writeText(result.data.link);
        toast.success("Đã copy signed diagnostics link.");
      } catch {
        toast.error("Copy thất bại. Trình duyệt không cho phép clipboard.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isPending}
      className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Signing..." : "Copy signed diagnostics link"}
    </button>
  );
}
