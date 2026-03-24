"use client";

import { Smartphone, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/date";
import { getFriendlyDeviceName } from "@/lib/deviceName";

interface DeviceItem {
    id: string;
    device_id: string;
    device_info: Record<string, unknown>;
    last_login: string;
}

interface DeviceSectionProps {
    devices: DeviceItem[];
    currentDeviceId: string;
    onRemoveDevice: (deviceId: string) => void;
}

export default function DeviceSection({ devices, currentDeviceId, onRemoveDevice }: DeviceSectionProps) {
    return (
        <section className="reveal-section lg:col-span-1" aria-labelledby="devices-heading">
            <h2 id="devices-heading" className="flex items-center gap-1 text-base font-semibold text-semantic-heading sm:text-lg">
                <Smartphone className="h-4 w-4 text-primary" />
                Quản lý thiết bị
            </h2>
            <div className="mt-1 text-sm text-muted">Tối đa 2 thiết bị. Gỡ thiết bị không dùng để thêm thiết bị mới.</div>
            {devices.length === 0 ? (
                <div className="mt-4 premium-panel border-dashed py-10 text-center">
                    <div className="text-sm text-muted">Chưa có thiết bị nào.</div>
                </div>
            ) : (
                <div className="mt-4 space-y-3">
                    {devices.map((d) => {
                        const isCurrentDevice = d.device_id === currentDeviceId;
                        return (
                            <div
                                key={d.id}
                                className={[
                                    "premium-panel flex items-center justify-between gap-4 rounded-2xl p-4 sm:p-5",
                                    isCurrentDevice
                                        ? "border-primary-500 bg-primary/10 ring-1 ring-primary-300/30 dark:ring-primary-400/30"
                                        : "",
                                ].join(" ")}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 font-medium text-semantic-heading">
                                        {getFriendlyDeviceName(d.device_info)}
                                        {isCurrentDevice ? (
                                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                                Đang dùng
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-0.5 text-sm text-muted">Đăng nhập lúc {formatDate(d.last_login)}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onRemoveDevice(d.device_id)}
                                    className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400 sm:p-2.5"
                                    title="Gỡ thiết bị"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
