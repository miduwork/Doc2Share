"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Smartphone, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/date";
import { getFriendlyDeviceName } from "@/lib/deviceName";
import { registerDeviceAndSession } from "@/app/login/actions";
import { toast } from "sonner";

interface LibItem {
  id: string;
  title: string;
  preview_url: string | null;
  thumbnail_url?: string | null;
  granted_at: string;
}

interface DeviceItem {
  id: string;
  device_id: string;
  device_info: Record<string, unknown>;
  last_login: string;
}

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("doc2share_device_id");
  if (!id) {
    id = "fp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("doc2share_device_id", id);
  }
  return id;
}

export default function DashboardClient({
  hasSessionCookie,
  library,
  devices,
}: {
  hasSessionCookie: boolean;
  library: LibItem[];
  devices: DeviceItem[];
}) {
  const supabase = createClient();
  const router = useRouter();

  // Luôn đăng ký phiên cho thiết bị hiện tại khi vào Tủ sách để Edge get-secure-link có bản ghi active_sessions khớp device_id
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const deviceId = getDeviceId();
      await registerDeviceAndSession(deviceId);
      if (!hasSessionCookie) router.refresh();
    })();
  }, [hasSessionCookie, supabase.auth, router]);

  async function removeDevice(deviceId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("device_logs").delete().eq("user_id", user.id).eq("device_id", deviceId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã gỡ thiết bị");
    router.refresh();
  }

  return (
    <div className="section-container py-8">
      <h1 className="text-3xl font-bold tracking-tight text-semantic-heading">
        Tủ sách của tôi
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Các tài liệu bạn đã mua. Tối đa 2 thiết bị, một phiên đăng nhập tại một thời điểm.
      </p>

      <section className="reveal-section mt-10" aria-labelledby="library-heading">
        <h2 id="library-heading" className="flex items-center gap-2 text-lg font-semibold text-semantic-heading">
          <BookOpen className="h-5 w-5 text-primary" />
          Tài liệu đã mua
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {library.length === 0 ? (
            <div className="premium-panel col-span-full border-dashed py-12 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-slate-500">Chưa có tài liệu.</p>
              <Link href="/tai-lieu" className="mt-2 inline-block text-primary font-medium hover:underline">
                Mua ngay
              </Link>
            </div>
          ) : (
            library.map((item) => (
              <div
                key={item.id}
                className="premium-card premium-card-hover flex items-center gap-4 p-4"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-slate-100 dark:bg-slate-700">
                  {item.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external/signed URL; fixed size
                    <img src={item.thumbnail_url} alt={item.title ? `Bìa: ${item.title}` : "Tài liệu"} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-semantic-heading line-clamp-1">{item.title}</p>
                  <p className="text-xs text-slate-500">Mua lúc {formatDate(item.granted_at)}</p>
                </div>
                <Link
                  href={`/doc/${item.id}/read`}
                  className="btn-primary shrink-0"
                >
                  Đọc
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="reveal-section reveal-delay-1 mt-12" aria-labelledby="devices-heading">
        <h2 id="devices-heading" className="flex items-center gap-2 text-lg font-semibold text-semantic-heading">
          <Smartphone className="h-5 w-5 text-primary" />
          Quản lý thiết bị
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Tối đa 2 thiết bị. Gỡ thiết bị không dùng để thêm thiết bị mới.
        </p>
        <div className="mt-4 space-y-3">
          {devices.map((d) => (
            <div
              key={d.id}
              className="premium-panel flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
            >
              <div>
                <p className="font-medium text-semantic-heading">
                  {getFriendlyDeviceName(d.device_info)}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Đăng nhập lúc {formatDate(d.last_login)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeDevice(d.device_id)}
                className="rounded-lg p-2.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
                title="Gỡ thiết bị"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
