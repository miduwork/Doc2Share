"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Filter, Search, X } from "lucide-react";
import { formatDate } from "@/lib/date";
import { registerDeviceAndSession } from "@/lib/auth/single-session/registerDeviceAndSession";
import { collectHardwareFingerprint } from "@/lib/auth/fingerprint";
import { toast } from "sonner";
import type { Category } from "@/lib/types";
import DiscoveryFilters from "@/features/documents/list/components/DiscoveryFilters";
import DeviceSection from "./DeviceSection";
import FilterSheet from "./FilterSheet";

interface LibItem {
  id: string;
  title: string;
  preview_url: string | null;
  thumbnail_url?: string | null;
  granted_at: string;
  grade_id?: string | null;
  subject_id?: string | null;
  exam_id?: string | null;
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
  grades,
  subjects,
  exams,
  devices,
}: {
  hasSessionCookie: boolean;
  library: LibItem[];
  grades: Category[];
  subjects: Category[];
  exams: Category[];
  devices: DeviceItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState("");
  const openedFiltersSignatureRef = useRef<string>("");
  const registerAttemptedRef = useRef(false);

  const searchParams = useSearchParams();
  const gradeId = searchParams.get("grade") ?? "";
  const subjectId = searchParams.get("subject") ?? "";
  const examId = searchParams.get("exam") ?? "";
  const sort = searchParams.get("sort") ?? "granted_desc";

  const filteredLibrary = useMemo(() => {
    const q = query.trim().toLowerCase();
    let results: LibItem[] = library ?? [];

    if (q) {
      results = results.filter((item: LibItem) => (item.title ?? "").toLowerCase().includes(q));
    }
    if (gradeId) results = results.filter((item: LibItem) => item.grade_id === gradeId);
    if (subjectId) results = results.filter((item: LibItem) => item.subject_id === subjectId);
    if (examId) results = results.filter((item: LibItem) => item.exam_id === examId);

    const normalizeTitle = (t: string | null | undefined) => t ?? "";

    const sorted = [...results];
    if (sort === "granted_asc") {
      sorted.sort((a, b) => new Date(a.granted_at).getTime() - new Date(b.granted_at).getTime());
    } else if (sort === "title_asc") {
      sorted.sort((a, b) => normalizeTitle(a.title).localeCompare(normalizeTitle(b.title), "vi", { sensitivity: "base" }));
    } else if (sort === "title_desc") {
      sorted.sort((a, b) => normalizeTitle(b.title).localeCompare(normalizeTitle(a.title), "vi", { sensitivity: "base" }));
    } else {
      sorted.sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime());
    }

    return sorted;
  }, [query, library, gradeId, subjectId, examId, sort]);

  useEffect(() => {
    setCurrentDeviceId(getDeviceId());
  }, []);

  const updateSort = (nextSort: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextSort === "granted_desc") next.delete("sort");
    else next.set("sort", nextSort);

    const qs = next.toString();
    router.push(qs ? `/tu-sach?${qs}` : "/tu-sach");
  };

  const syncSessionBinding = useCallback(async () => {
    try {
      const dId = getDeviceId();
      const { signalsSummary, hardwareHash } = await collectHardwareFingerprint();
      const res = await registerDeviceAndSession(dId, undefined, hardwareHash);

      if (res.ok && res.data?.recoveredDeviceId) {
        localStorage.setItem("doc2share_device_id", res.data.recoveredDeviceId);
      }

      if (!res.ok) {
        console.error("Dashboard session binding failed:", res.error);
      }
    } catch (e) {
      console.error("syncSessionBinding err", e);
    }
  }, []);

  useEffect(() => {
    if (registerAttemptedRef.current) return;
    registerAttemptedRef.current = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await syncSessionBinding();
      if (!hasSessionCookie) router.refresh();
    })();
  }, [hasSessionCookie, supabase, router, syncSessionBinding]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const nextSignature = `${gradeId}|${subjectId}|${examId}|${sort}`;
    if (openedFiltersSignatureRef.current !== nextSignature) setFiltersOpen(false);
  }, [filtersOpen, gradeId, subjectId, examId, sort]);

  async function removeDevice(deviceId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("device_logs")
      .delete()
      .eq("user_id", user.id)
      .eq("device_id", deviceId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Đã gỡ thiết bị");
    router.refresh();
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-semantic-heading sm:text-3xl">Tủ sách của tôi</h1>
      <div className="mt-2 text-muted">
        Các tài liệu bạn đã mua. Tối đa 2 thiết bị, một phiên đăng nhập tại một thời điểm.
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <section className="reveal-section lg:col-span-2" aria-labelledby="library-heading">
          <h2 id="library-heading" className="flex items-center gap-1 text-base font-semibold text-semantic-heading sm:text-lg">
            <BookOpen className="h-4 w-4 text-primary" />
            Tài liệu đã mua
          </h2>

          <div className="mt-4 premium-panel p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Search className="h-5 w-5 text-primary" />
                <div className="relative min-w-0 flex-1">
                  <label htmlFor="library-search" className="sr-only">
                    Tìm kiếm theo tiêu đề tài liệu
                  </label>
                  <input
                    id="library-search"
                    type="search"
                    inputMode="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm theo tiêu đề..."
                    className="input-premium pr-10"
                  />
                  {query.trim() ? (
                    <button
                      type="button"
                      aria-label="Xóa tìm kiếm"
                      onClick={() => setQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:bg-surface-muted hover:text-primary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="text-sm text-muted whitespace-nowrap">{filteredLibrary.length} kết quả</div>
                <div className="flex items-center gap-2">
                  <label htmlFor="library-sort" className="text-sm font-medium text-muted whitespace-nowrap">
                    Sắp xếp
                  </label>
                  <select
                    id="library-sort"
                    value={sort}
                    onChange={(e) => updateSort(e.target.value)}
                    className="input-premium w-auto min-w-[180px] pr-8"
                    aria-label="Sắp xếp tài liệu"
                  >
                    <option value="granted_desc">Mới nhất</option>
                    <option value="granted_asc">Cũ nhất</option>
                    <option value="title_asc">A-Z</option>
                    <option value="title_desc">Z-A</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 md:hidden">
            <button
              type="button"
              onClick={() => {
                openedFiltersSignatureRef.current = `${gradeId}|${subjectId}|${examId}|${sort}`;
                setFiltersOpen(true);
              }}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Bộ lọc
            </button>
          </div>

          <div className="mt-3 hidden md:block">
            <DiscoveryFilters basePath="/tu-sach" grades={grades} subjects={subjects} exams={exams} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {filteredLibrary.length === 0 ? (
              <div className="premium-panel col-span-full border-dashed py-12 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-border-strong" />
                <div className="mt-3 text-muted">
                  {library.length === 0
                    ? "Chưa có tài liệu."
                    : query.trim()
                      ? "Không có tài liệu phù hợp."
                      : "Không có tài liệu phù hợp bộ lọc hiện tại."}
                </div>
                <Link href="/cua-hang" className="mt-2 inline-block text-primary font-medium hover:underline">
                  Mua ngay
                </Link>
              </div>
            ) : (
              filteredLibrary.map((item: LibItem) => (
                <div
                  key={item.id}
                  className="premium-card premium-card-hover flex items-center gap-4 p-4"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-slate-100 dark:bg-slate-700">
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external/signed URL; fixed size
                      <img
                        src={item.thumbnail_url}
                        alt={item.title ? `Bìa: ${item.title}` : "Tài liệu"}
                        loading="lazy"
                        decoding="async"
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-border-strong">
                        <BookOpen className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-semantic-heading line-clamp-1">{item.title}</div>
                    <div className="text-xs text-muted">Mua lúc {formatDate(item.granted_at)}</div>
                  </div>
                  <Link href={`/doc/${item.id}/read`} className="btn-primary shrink-0">
                    Đọc
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>

        <DeviceSection
          devices={devices}
          currentDeviceId={currentDeviceId}
          onRemoveDevice={removeDevice}
        />

        <FilterSheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          grades={grades}
          subjects={subjects}
          exams={exams}
        />
      </div>
    </>
  );
}
