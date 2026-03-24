import type { GeoPoint } from "@/lib/admin/security-dashboard.types";
import { MapPin } from "lucide-react";

export default function AdminSecurityGeoSection({ geoPoints }: { geoPoints: GeoPoint[] }) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
        <MapPin className="h-4 w-4" />
        Bản đồ IP (gợi ý)
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">Vị trí đăng nhập — cảnh báo khi IP thay đổi nhanh.</p>
      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
        {geoPoints.length === 0 ? (
          <div>Unknown</div>
        ) : (
          <div className="space-y-1">
            {geoPoints.slice(0, 12).map((g) => (
              <div key={g.ip} className="flex items-center justify-between rounded bg-white px-2 py-1 dark:bg-slate-900">
                <span className="font-mono">{g.ip}</span>
                <span>
                  {g.status === "resolved"
                    ? `${g.countryName ?? g.countryCode ?? "Unknown"} / ${g.city ?? "Unknown"}`
                    : "Unknown"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
