import { Activity, AlertTriangle, Database, Wrench } from "lucide-react";
import KpiCard from "@/components/admin/KpiCard";
import type { KpiSectionViewModel } from "@/features/admin/observability/dashboard/model/dashboard.types";
import { toQueryString } from "@/features/admin/observability/shared/query-string";

interface Props {
  viewModel: KpiSectionViewModel;
}

export default function ObservabilityKpiSection({ viewModel }: Props) {
  const { metrics, pipeline, watermarkDegraded24h } = viewModel;
  const watermarkDegradedHref = `/admin/observability?${toQueryString({
    preset: "reader-watermark-degraded",
    window: "24h",
    severity: "warn",
    source: "next.reader",
    event_type: "watermark_degraded_fallback",
    alerts_cursor: "",
    alerts_dir: "next",
    alerts_page: "1",
    runs_page: "1",
    alerts_page_size: "20",
    runs_page_size: "20",
    export_limit: "2000",
  })}#alerts-panel`;
  return (
    <section className="mt-4 reveal-section">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Events 24h"
          value={String(metrics?.events_24h ?? 0)}
          sub={`Errors: ${metrics?.errors_24h ?? 0}`}
          tooltip="Tổng số event observability và số lỗi trong 24h qua (từ bảng observability_events)."
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Webhook Health"
          value={String(metrics?.webhook_events_24h ?? 0)}
          sub={`Webhook errors: ${metrics?.webhook_errors_24h ?? 0}`}
          tooltip="Số event từ payment webhook và số webhook lỗi trong 24h. Dùng preset Webhook errors để xem chi tiết."
        />
        <KpiCard
          icon={<Database className="h-4 w-4" />}
          label="Latency (avg)"
          value={`${Math.round(Number(metrics?.webhook_avg_latency_ms_24h ?? 0))} ms`}
          sub={`Secure-doc access: ${Math.round(Number(metrics?.secure_link_avg_latency_ms_24h ?? 0))} ms`}
          tooltip="Độ trễ trung bình: webhook (thanh toán) và luồng truy cập tài liệu bảo mật trong 24h."
        />
        <KpiCard
          icon={<Wrench className="h-4 w-4" />}
          label="Secure-doc blocked"
          value={String(metrics?.secure_link_blocked_24h ?? 0)}
          sub={`Events: ${metrics?.secure_link_events_24h ?? 0}`}
          tooltip="Số lần truy cập tài liệu bị từ chối (device/session/permission/expired/rate-limit/high-frequency) và tổng số event secure-document-access trong 24h."
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Watermark degraded 24h"
          value={String(watermarkDegraded24h)}
          sub="event_type: watermark_degraded_fallback"
          tooltip="Số lần reader phải dùng watermark fallback do thiếu watermark headers từ luồng secure-pdf trong 24h."
          href={watermarkDegradedHref}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Pipeline tài liệu"
          value={`${pipeline.queued + pipeline.processing} đang chờ/xử lý`}
          sub={`Lỗi (job): ${pipeline.failed}`}
          tooltip="Snapshot từ document_processing_jobs: queued + processing và số job đang ở trạng thái failed (có thể đang chờ retry). Khác với bảng Alerts bên dưới khi preset Pipeline: chỉ event pipeline_tick (tổng hợp mỗi lần cron). Tài liệu lỗi xử lý: Admin → Tài liệu, preset Lỗi xử lý."
          href="/admin/documents?workspace=manage&preset=failed&status=failed"
        />
      </div>
    </section>
  );
}
