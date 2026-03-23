"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";
import AdminTable from "@/components/admin/AdminTable";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
}

export default function AdminCouponsClient({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [creating, setCreating] = useState(false);
  const supabase = createClient();

  async function createCoupon() {
    if (!code.trim() || !discountValue) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("coupons")
      .insert({
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCode("");
    setDiscountValue("");
    setCoupons((c) => [data as Coupon, ...c]);
    toast.success("Đã tạo mã giảm giá");
  }

  return (
    <div className="mt-4">
      <div className="premium-panel mb-4 flex flex-wrap items-end gap-2 rounded-xl p-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-500">Mã</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ONTHI2026"
            className="input-premium mt-0.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500">Loại</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
            className="input-premium mt-0.5 py-1.5 text-sm"
          >
            <option value="percent">%</option>
            <option value="fixed">Số tiền (₫)</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500">Giá trị</label>
          <input
            type="number"
            min={0}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === "percent" ? "10" : "50000"}
            className="input-premium mt-0.5 w-24 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={createCoupon}
          disabled={creating}
          className="btn-primary flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Tạo mã
        </button>
      </div>

      <AdminTable<Coupon>
        columns={[
          { id: "code", header: "Mã", cell: (c) => <span className="font-mono font-medium">{c.code}</span> },
          { id: "discount", header: "Giảm", cell: (c) => c.discount_type === "percent" ? `${c.discount_value}%` : `${Number(c.discount_value).toLocaleString("vi-VN")} ₫` },
          { id: "used", header: "Đã dùng", cell: (c) => `${c.used_count}${c.max_uses != null ? ` / ${c.max_uses}` : ""}` },
          { id: "valid_until", header: "Hạn", cell: (c) => <span className="text-slate-600 dark:text-slate-400">{c.valid_until ? formatDate(c.valid_until) : "—"}</span> },
          { id: "created_at", header: "Tạo lúc", cell: (c) => <span className="text-slate-600 dark:text-slate-400">{formatDate(c.created_at)}</span> },
        ]}
        data={coupons}
        emptyMessage="Chưa có mã. Tạo mã ở trên."
        getRowId={(c) => c.id}
        wrapperClassName="overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900"
      />
    </div>
  );
}
