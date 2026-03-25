import type { Order } from "@/lib/orders/types";

const BOM = "\uFEFF";

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return escapeCsvCell(String(v));
}

const HEADER = [
  "id",
  "created_at",
  "customer_name",
  "phone_number",
  "status",
  "payment_status",
  "priority",
  "total_price",
  "page_count",
  "copies",
  "delivery_method",
  "delivery_address",
  "shipping_fee",
  "completed_at",
  "delivered_at",
  "note",
];

/**
 * CSV UTF-8 với BOM để Excel hiển thị tiếng Việt đúng.
 */
export function ordersToCsv(orders: Order[]): string {
  const lines = [HEADER.join(",")];
  for (const o of orders) {
    lines.push(
      [
        cell(o.id),
        cell(o.created_at),
        cell(o.customer_name),
        cell(o.phone_number),
        cell(o.status),
        cell(o.payment_status),
        cell(o.priority),
        cell(o.total_price),
        cell(o.page_count),
        cell(o.copies),
        cell(o.delivery_method),
        cell(o.delivery_address),
        cell(o.shipping_fee),
        cell(o.completed_at),
        cell(o.delivered_at),
        cell(o.note),
      ].join(","),
    );
  }
  return BOM + lines.join("\r\n");
}

async function readApiErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: unknown };
    if (typeof j.error === "string" && j.error) return j.error;
  } catch {
    /* ignore */
  }
  return res.statusText || "Đã xảy ra lỗi.";
}

async function downloadCsvFromResponse(res: Response): Promise<void> {
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res));
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  let filename = `don-hang-${new Date().toISOString().slice(0, 10)}.csv`;
  const m = cd?.match(/filename="([^"]+)"/);
  if (m?.[1]) filename = m[1];
  const urlObj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = urlObj;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(urlObj);
}

/** Tải CSV từ `GET /api/admin/orders/export` (cùng filter với danh sách). */
export async function downloadAdminOrdersExportFromApi(
  queryString: string,
): Promise<void> {
  const url = queryString
    ? `/api/admin/orders/export?${queryString}`
    : "/api/admin/orders/export";
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  await downloadCsvFromResponse(res);
}

/** Tải CSV theo danh sách id đã chọn (`POST /api/admin/orders/export`). */
export async function downloadAdminOrdersExportSelectedFromApi(
  ids: string[],
): Promise<void> {
  const res = await fetch("/api/admin/orders/export", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  await downloadCsvFromResponse(res);
}

export function downloadOrdersCsv(orders: Order[], filenameBase = "don-hang"): void {
  const csv = ordersToCsv(orders);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
