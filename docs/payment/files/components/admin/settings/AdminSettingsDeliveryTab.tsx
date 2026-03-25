"use client";

import { inputClass, labelClass } from "@/components/admin/adminStyles";
import type { AdminSettingsDeliveryTabProps } from "@/components/admin/settings/settingsTabTypes";

export function AdminSettingsDeliveryTab({
  config,
  setConfig,
}: AdminSettingsDeliveryTabProps) {
  const d = config.delivery;
  return (
    <div
      className="space-y-4"
      id="admin-settings-panel-delivery"
      role="tabpanel"
      aria-labelledby="admin-settings-tab-delivery"
    >
      <div>
        <p className={labelClass}>Ngưỡng freeship (VNĐ — phần in, chưa ship)</p>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={d.freeshipThresholdVnd}
          onChange={(e) =>
            setConfig((c) =>
              c
                ? {
                    ...c,
                    delivery: {
                      ...c.delivery,
                      freeshipThresholdVnd: Number(e.target.value),
                    },
                  }
                : c,
            )
          }
        />
      </div>
      <div>
        <p className={labelClass}>Phí giao hàng (VNĐ)</p>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={d.shippingFeeDelivery}
          onChange={(e) =>
            setConfig((c) =>
              c
                ? {
                    ...c,
                    delivery: {
                      ...c.delivery,
                      shippingFeeDelivery: Number(e.target.value),
                    },
                  }
                : c,
            )
          }
        />
      </div>
      <div>
        <p className={labelClass}>Tỉnh/Thành phố (hiển thị form)</p>
        <input
          type="text"
          className={inputClass}
          value={d.city}
          onChange={(e) =>
            setConfig((c) =>
              c
                ? {
                    ...c,
                    delivery: { ...c.delivery, city: e.target.value },
                  }
                : c,
            )
          }
        />
      </div>
      <div>
        <p className={labelClass}>Phường/Xã (mỗi dòng một)</p>
        <textarea
          className="mt-1 min-h-[120px] w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
          value={d.wards.join("\n")}
          onChange={(e) => {
            const wards = e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            setConfig((c) =>
              c
                ? {
                    ...c,
                    delivery: { ...c.delivery, wards },
                  }
                : c,
            );
          }}
        />
      </div>
    </div>
  );
}
