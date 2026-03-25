"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/feedback/Spinner";
import { AdminSettingsCatalogTab } from "@/components/admin/settings/AdminSettingsCatalogTab";
import { AdminSettingsDeliveryTab } from "@/components/admin/settings/AdminSettingsDeliveryTab";
import { AdminSettingsPricingTab } from "@/components/admin/settings/AdminSettingsPricingTab";
import type { AdminSettingsTabId } from "@/components/admin/settings/settingsTabTypes";
import {
  adminMainContentClass,
  formPrimaryButtonInlineClass,
} from "@/components/admin/adminStyles";
import {
  applyMultOverridesToEmptyCells,
  recomputeOverridePerPageFromBaseMult,
  type AppConfigV1,
} from "@/lib/config/appConfigSchema";

export function AdminSettingsClient() {
  const [tab, setTab] = useState<AdminSettingsTabId>("pricing");
  const [config, setConfig] = useState<AppConfigV1 | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [overrideJsonError, setOverrideJsonError] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/admin/settings", { credentials: "include" });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      config?: AppConfigV1;
      updatedAt?: string;
    } | null;
    if (!res.ok) {
      setLoadError(data?.error || "Không tải được cấu hình.");
      return;
    }
    if (data?.config) {
      setConfig(data.config);
      setUpdatedAt(data.updatedAt ?? null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        config?: AppConfigV1;
        updatedAt?: string;
      } | null;
      if (!res.ok) {
        setSaveMessage(data?.error || "Lưu thất bại.");
        return;
      }
      if (data?.config) {
        setConfig(data.config);
        setUpdatedAt(data.updatedAt ?? null);
        setSaveMessage("Đã lưu.");
      }
    } finally {
      setSaving(false);
    }
  }, [config]);

  const applyMults = useCallback(() => {
    if (!config) return;
    setConfig((c) =>
      c
        ? {
            ...c,
            pricing: applyMultOverridesToEmptyCells(c.pricing),
          }
        : c,
    );
    setSaveMessage(null);
  }, [config]);

  const recomputeAllOverrideCells = useCallback(() => {
    if (!config) return;
    setConfig((c) =>
      c
        ? {
            ...c,
            pricing: recomputeOverridePerPageFromBaseMult(c.pricing),
          }
        : c,
    );
    setSaveMessage(null);
  }, [config]);

  if (loadError) {
    return (
      <main className={adminMainContentClass}>
        <p className="text-destructive">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className={`${formPrimaryButtonInlineClass} mt-4`}
        >
          Thử lại
        </button>
      </main>
    );
  }

  if (!config) {
    return (
      <main className={adminMainContentClass}>
        <div
          className="flex items-center gap-3 py-16"
          role="status"
          aria-live="polite"
        >
          <Spinner size="md" />
          <span className="text-muted-foreground">Đang tải cấu hình...</span>
        </div>
      </main>
    );
  }

  return (
    <main className={adminMainContentClass}>
      <h2 className="mb-6 text-xl font-semibold tracking-tight">
        Cài đặt cửa hàng
      </h2>
      <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
        Giá mới áp dụng cho <strong>đơn mới</strong>. Đơn đã tạo giữ nguyên.
      </div>

      <div
        className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3"
        role="tablist"
        aria-label="Nhóm tab cài đặt"
      >
        {(
          [
            ["pricing", "Giá & phí", "admin-settings-tab-pricing", "admin-settings-panel-pricing"],
            ["catalog", "Danh mục in", "admin-settings-tab-catalog", "admin-settings-panel-catalog"],
            ["delivery", "Giao hàng", "admin-settings-tab-delivery", "admin-settings-panel-delivery"],
          ] as const
        ).map(([id, label, tabId, panelId]) => (
          <button
            key={id}
            id={tabId}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={panelId}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {updatedAt && (
        <p className="mb-4 text-xs text-muted-foreground">
          Cập nhật lần cuối: {new Date(updatedAt).toLocaleString("vi-VN")}
        </p>
      )}

      {tab === "pricing" && (
        <AdminSettingsPricingTab
          config={config}
          setConfig={setConfig}
          overrideJsonError={overrideJsonError}
          setOverrideJsonError={setOverrideJsonError}
          onApplyMults={applyMults}
          onRecomputeAllOverrides={recomputeAllOverrideCells}
        />
      )}
      {tab === "catalog" && (
        <AdminSettingsCatalogTab config={config} setConfig={setConfig} />
      )}
      {tab === "delivery" && (
        <AdminSettingsDeliveryTab config={config} setConfig={setConfig} />
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className={formPrimaryButtonInlineClass}
        >
          {saving ? "Đang lưu…" : "Lưu cài đặt"}
        </button>
        {saveMessage && (
          <span
            className={
              saveMessage.startsWith("Đã") ? "text-green-600" : "text-destructive"
            }
          >
            {saveMessage}
          </span>
        )}
      </div>
    </main>
  );
}
