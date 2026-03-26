"use client";

import { useState } from "react";
import { forensicLookup } from "@/app/admin/security/actions";
import { toast } from "sonner";
import { Search, ShieldAlert, User, FileText, Globe, Monitor } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export default function AdminSecurityForensicSection() {
    const [token, setToken] = useState("");
    const [docId, setDocId] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[] | null>(null);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        const cleanToken = token.replace("D2S:", "").trim();
        if (!cleanToken) {
            toast.error("Vui lòng nhập mã token (vd: A7K9M2QX)");
            return;
        }

        setLoading(true);
        const res = await forensicLookup({ wmShort: cleanToken, documentId: docId || undefined });
        setLoading(false);

        if (!res.ok) {
            toast.error(res.error);
            return;
        }
        setResults(res.data ?? []);
        if (res.data?.length === 0) {
            toast.info("Không tìm thấy bản ghi nào khớp với mã token này.");
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-slate-900 dark:text-slate-100 font-semibold text-lg">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    <h2>Truy vết Forensic Watermark</h2>
                </div>

                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Mã Watermark (D2S:Token)
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="vd: A7K9M2QX"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-0 rounded-lg focus:ring-2 focus:ring-slate-400 transition-all outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            ID Tài liệu (Optional)
                        </label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="UUID tài liệu"
                                value={docId}
                                onChange={(e) => setDocId(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-0 rounded-lg focus:ring-2 focus:ring-slate-400 transition-all outline-none text-sm"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="h-10 px-6 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? "Đang tìm..." : "Truy vết ngay"}
                    </button>
                </form>
            </div>

            {results && results.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pl-1">
                        Kết quả tìm thấy ({results.length})
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {results.map((row) => (
                            <div
                                key={row.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition-colors">
                                                <Link href={`/admin/users?q=${row.profiles?.id}`}>
                                                    {row.profiles?.full_name || "N/A"}
                                                </Link>
                                            </p>
                                            <p className="text-xs text-slate-500 font-mono">{row.profiles?.id}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-4 md:gap-8 items-center text-sm">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                            <FileText className="w-4 h-4" />
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase tracking-tighter">Tài liệu</p>
                                                <p className="font-medium truncate max-w-[200px]" title={row.documents?.title}>
                                                    {row.documents?.title || "N/A"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                            <Globe className="w-4 h-4" />
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase tracking-tighter">Địa chỉ IP</p>
                                                <p className="font-medium">{row.ip_address || "N/A"}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                            <Monitor className="w-4 h-4" />
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase tracking-tighter">Thiết bị</p>
                                                <p className="font-medium truncate max-w-[120px]" title={row.device_id}>
                                                    {row.device_id || "N/A"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 border-l border-slate-100 dark:border-slate-800 pl-4">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400 uppercase tracking-tighter">Thời điểm</p>
                                                <p className="font-medium whitespace-nowrap">
                                                    {format(new Date(row.created_at), "HH:mm:ss dd/MM/yyyy", { locale: vi })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {row.metadata && (
                                    <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50 flex flex-wrap gap-x-6 gap-y-2">
                                        <span className="text-[10px] text-slate-400">
                                            WM_ID: {row.metadata.wm_id}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            WM_BUCKET: {row.metadata.wm_issued_at_bucket}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            VERSION: {row.metadata.wm_version}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
