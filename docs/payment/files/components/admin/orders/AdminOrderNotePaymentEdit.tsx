"use client";

import { useEffect, useState } from "react";
import {
  formFieldHintClass,
  formNestedPanelClass,
  formPrimaryButtonInlineClass,
  formSectionOverlineClass,
  labelClass,
  selectClass,
  textareaClass,
} from "@/components/admin/adminStyles";
import { isPaidPaymentStatus } from "@/lib/orders/adminOrderFilters";
import {
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_UNPAID_LABEL,
} from "@/lib/orders/adminPaymentPatch";
import type { Order } from "@/lib/orders/types";

type Props = {
  order: Order;
  onAfterSave: () => void;
};

async function readApiErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: unknown };
    if (typeof j.error === "string" && j.error) return j.error;
  } catch {
    /* ignore */
  }
  return res.statusText || "Đã xảy ra lỗi.";
}

export function AdminOrderNotePaymentEdit({ order, onAfterSave }: Props) {
  const [note, setNote] = useState(order.note ?? "");
  const [paymentStatus, setPaymentStatus] = useState(
    isPaidPaymentStatus(order.payment_status)
      ? PAYMENT_STATUS_PAID
      : PAYMENT_STATUS_UNPAID_LABEL,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote(order.note ?? "");
    setPaymentStatus(
      isPaidPaymentStatus(order.payment_status)
        ? PAYMENT_STATUS_PAID
        : PAYMENT_STATUS_UNPAID_LABEL,
    );
  }, [order.id, order.note, order.payment_status]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(order.id)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: note.trim() === "" ? null : note,
            payment_status: paymentStatus.trim() === "" ? null : paymentStatus,
          }),
        },
      );
      if (!res.ok) {
        setError(await readApiErrorMessage(res));
        setSaving(false);
        return;
      }
      onAfterSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
  };

  return (
    <section className={formNestedPanelClass}>
      <h3 className={`${formSectionOverlineClass} mb-3`}>Sửa ghi chú và thanh toán</h3>
      <p className={`${formFieldHintClass} mb-4`}>
        Chỉ dùng khi cần chỉnh tay. Trạng thái « Đã thanh toán » nên khớp với SePay để tránh lệch sổ quỹ.
      </p>
      <div className="space-y-4">
        <div>
          <label htmlFor={`admin-order-note-${order.id}`} className={labelClass}>
            Ghi chú
          </label>
          <textarea
            id={`admin-order-note-${order.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className={textareaClass}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor={`admin-order-pay-${order.id}`} className={labelClass}>
            Thanh toán
          </label>
          <select
            id={`admin-order-pay-${order.id}`}
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className={selectClass}
          >
            <option value={PAYMENT_STATUS_UNPAID_LABEL}>{PAYMENT_STATUS_UNPAID_LABEL}</option>
            <option value={PAYMENT_STATUS_PAID}>{PAYMENT_STATUS_PAID}</option>
          </select>
        </div>
        {error && (
          <p className="rounded-lg bg-danger px-3 py-2 text-sm text-danger-foreground" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className={formPrimaryButtonInlineClass}
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </section>
  );
}
