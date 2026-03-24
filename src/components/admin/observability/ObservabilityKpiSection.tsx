import { Activity, AlertTriangle, Database, Wrench } from "lucide-react";
import KpiCard from "@/components/admin/KpiCard";
import type { KpiSectionViewModel } from "@/features/admin/observability/dashboard/model/dashboard.types";

interface Props {
  viewModel: KpiSectionViewModel;
}

export default function ObservabilityKpiSection({ viewModel }: Props) {
  const { metrics, pipeline } = viewModel;
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
          sub={`Secure-link: ${Math.round(Number(metrics?.secure_link_avg_latency_ms_24h ?? 0))} ms`}
          tooltip="Độ trễ trung bình: webhook (thanh toán) và secure-link (lấy link đọc tài liệu) trong 24h."
        />
        <KpiCard
          icon={<Wrench className="h-4 w-4" />}
          label="Secure-link blocked"
          value={String(metrics?.secure_link_blocked_24h ?? 0)}
          sub={`Events: ${metrics?.secure_link_events_24h ?? 0}`}
          tooltip="Số lần từ chối cấp link (device/session vượt giới hạn) và tổng số gọi secure-link trong 24h."
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Pipeline tài liệu"
          value={`${pipeline.queued + pipeline.processing} đang chờ/xử lý`}
          sub={`Lỗi: ${pipeline.failed}`}
          tooltip="Số job tài liệu đang chờ, đang xử lý và số job lỗi (document_processing_jobs). Cảnh báo khi lỗi ≥ 10 hoặc backlog ≥ 200."
        />
      </div>
    </section>
  );
}
