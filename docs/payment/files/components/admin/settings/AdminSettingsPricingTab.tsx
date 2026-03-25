"use client";

import { useEffect, useState } from "react";
import { inputClass, labelClass } from "@/components/admin/adminStyles";
import {
  defaultBindingFeeVnd,
  type AppConfigV1,
} from "@/lib/config/appConfigSchema";
import type { BindingType } from "@/lib/orders/printJobSpec";
import {
  BINDING_LABEL,
  BINDING_OPTIONS,
} from "@/lib/orders/printJobSpec";
import type { AdminSettingsPricingTabProps } from "@/components/admin/settings/settingsTabTypes";

export function AdminSettingsPricingTab({
  config,
  setConfig,
  overrideJsonError,
  setOverrideJsonError,
  onApplyMults,
  onRecomputeAllOverrides,
}: AdminSettingsPricingTabProps) {
  const p = config.pricing;

  const [overrideStr, setOverrideStr] = useState(() =>
    JSON.stringify(p.overridePerPage ?? {}, null, 2),
  );

  const overrideKey = JSON.stringify(config.pricing.overridePerPage ?? {});
  useEffect(() => {
    setOverrideStr(
      JSON.stringify(config.pricing.overridePerPage ?? {}, null, 2),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overrideKey thay cho overridePerPage
  }, [overrideKey]);

  const setMult = (key: "bw" | "color", val: number) => {
    setConfig((c) =>
      c
        ? {
            ...c,
            pricing: {
              ...c.pricing,
              multByColor: { ...c.pricing.multByColor, [key]: val },
            },
          }
        : c,
    );
  };

  const setMultSides = (key: "double" | "single", val: number) => {
    setConfig((c) =>
      c
        ? {
            ...c,
            pricing: {
              ...c.pricing,
              multBySides: { ...c.pricing.multBySides, [key]: val },
            },
          }
        : c,
    );
  };

  const setBindingFee = (key: BindingType, val: number) => {
    setConfig((c) =>
      c
        ? {
            ...c,
            pricing: {
              ...c.pricing,
              bindingFeeVnd: {
                ...defaultBindingFeeVnd(),
                ...c.pricing.bindingFeeVnd,
                [key]: val,
              },
            },
          }
        : c,
    );
  };

  const setBase = (paper: string, gsm: string, val: number) => {
    setConfig((c) => {
      if (!c) return c;
      const row = { ...(c.pricing.basePerPageByPaper[paper] ?? {}) };
      row[gsm] = val;
      return {
        ...c,
        pricing: {
          ...c.pricing,
          basePerPageByPaper: {
            ...c.pricing.basePerPageByPaper,
            [paper]: row,
          },
        },
      };
    });
  };

  return (
    <div
      className="space-y-6"
      id="admin-settings-panel-pricing"
      role="tabpanel"
      aria-labelledby="admin-settings-tab-pricing"
    >
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <strong className="text-foreground">Lưu ý:</strong> Nếu JSON override bên dưới đã có giá từng ô, đó là{" "}
        <strong className="text-foreground">giá cuối</strong> — hệ số màu/mặt{" "}
        <em>không</em> nhân thêm. Để giá ô khớp base × hệ số hiện tại, dùng nút &quot;Tính lại toàn bộ ô…&quot; hoặc
        xóa override về <code className="text-xs">{"{}"}</code> để chỉ dùng công thức (không ghi đè từng ô).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className={labelClass}>Hệ số màu (bw)</p>
          <input
            type="number"
            step="0.01"
            min={0.01}
            className={inputClass}
            value={p.multByColor.bw}
            onChange={(e) => setMult("bw", Number(e.target.value))}
          />
        </div>
        <div>
          <p className={labelClass}>Hệ số màu (color)</p>
          <input
            type="number"
            step="0.01"
            min={0.01}
            className={inputClass}
            value={p.multByColor.color}
            onChange={(e) => setMult("color", Number(e.target.value))}
          />
        </div>
        <div>
          <p className={labelClass}>Hệ số mặt (2 mặt)</p>
          <input
            type="number"
            step="0.01"
            min={0.01}
            className={inputClass}
            value={p.multBySides.double}
            onChange={(e) => setMultSides("double", Number(e.target.value))}
          />
        </div>
        <div>
          <p className={labelClass}>Hệ số mặt (1 mặt)</p>
          <input
            type="number"
            step="0.01"
            min={0.01}
            className={inputClass}
            value={p.multBySides.single}
            onChange={(e) => setMultSides("single", Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <p className="font-medium">Phí đóng gáy sách (VNĐ / 1 cuốn)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cộng vào tiền in đơn sách; nhân theo số bản in.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-1">
          {BINDING_OPTIONS.map((key) => (
            <div key={key}>
              <p className={labelClass}>{BINDING_LABEL[key]}</p>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={
                  p.bindingFeeVnd?.[key] ??
                  defaultBindingFeeVnd()[key]
                }
                onChange={(e) => setBindingFee(key, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="font-medium">Giá base (VNĐ/trang)</p>
        {config.catalog.paperSizes.map((paper) => (
          <div key={paper} className="overflow-x-auto">
            <p className="mb-2 text-sm font-medium">{paper}</p>
            <table className="w-full min-w-[320px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-border bg-muted px-2 py-1 text-left">
                    gsm
                  </th>
                  {config.catalog.gsmOptions.map((gsm) => (
                    <th
                      key={gsm}
                      className="border border-border bg-muted px-2 py-1"
                    >
                      {gsm}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border px-2 py-1">Giá gốc</td>
                  {config.catalog.gsmOptions.map((gsm) => (
                    <td key={gsm} className="border border-border p-1">
                      <input
                        type="number"
                        min={0}
                        className="w-full min-w-[4rem] rounded border border-border px-1 py-0.5"
                        value={p.basePerPageByPaper[paper]?.[gsm] ?? 0}
                        onChange={(e) =>
                          setBase(paper, gsm, Number(e.target.value))
                        }
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div>
        <p className={labelClass}>Override (JSON — giá cuối ô theo khổ/gsm/màu/mặt)</p>
        <textarea
          className="mt-1 min-h-[160px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          value={overrideStr}
          onChange={(e) => setOverrideStr(e.target.value)}
          onBlur={() => {
            try {
              const parsed = JSON.parse(overrideStr) as unknown;
              setConfig((c) =>
                c
                  ? {
                      ...c,
                      pricing: {
                        ...c.pricing,
                        overridePerPage:
                          parsed as AppConfigV1["pricing"]["overridePerPage"],
                      },
                    }
                  : c,
              );
              setOverrideJsonError(null);
            } catch (e) {
              setOverrideJsonError(
                e instanceof Error ? e.message : "JSON không hợp lệ.",
              );
            }
          }}
        />
        {overrideJsonError && (
          <p className="mt-1 text-sm text-destructive">{overrideJsonError}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              try {
                JSON.parse(overrideStr);
                setOverrideJsonError(null);
              } catch (e) {
                setOverrideJsonError(
                  e instanceof Error ? e.message : "JSON không hợp lệ.",
                );
              }
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Kiểm tra JSON
          </button>
          <button
            type="button"
            onClick={onApplyMults}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Chỉ điền ô override còn trống
          </button>
          <button
            type="button"
            onClick={onRecomputeAllOverrides}
            className="rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-sm font-medium"
          >
            Tính lại toàn bộ ô từ base × hệ số
          </button>
        </div>
      </div>
    </div>
  );
}
