import type {
  DeliveryConfigV1,
  PricingConfigV1,
} from "@/lib/config/appConfigSchema";
import { DELIVERY_CITY } from "@/lib/config/orderForm";
import { publicConfig } from "@/lib/config/public";
import { grandTotalFromPrintSubtotal } from "@/lib/payments/pricing";
import { computePrintSubtotalForOrder } from "@/lib/payments/printSubtotal";
import type { DeliveryMethod } from "@/lib/orders/delivery";
import type {
  BindingType,
  OrderSpecV1,
  PageScope,
  PrintJobKind,
} from "@/lib/orders/printJobSpec";
import {
  BINDING_LABEL,
  PAPER_SIZES,
} from "@/lib/orders/printJobSpec";
import type { PrintColor, PrintSides } from "@/lib/orders/printOptions";
import type { OrderInsert } from "./types";

const BINDING_KEYS = Object.keys(BINDING_LABEL) as BindingType[];

export function isBindingType(v: string): v is BindingType {
  return (BINDING_KEYS as readonly string[]).includes(v);
}

export function isPrintJobKind(v: string): v is PrintJobKind {
  return v === "document" || v === "book";
}

export function isPageScope(v: string): v is PageScope {
  return v === "all" || v === "range";
}

export type OrderFormSnapshot = {
  customerName: string;
  phone: string;
  note: string;
  copiesInput: string;
  /** Tài liệu — toàn bộ file: số trang nhập hoặc đếm PDF */
  pageCountInput: string;
  deliveryMethod: DeliveryMethod;
  deliveryDistrict: string;
  deliveryDetail: string;
  printColor: PrintColor;
  printSides: PrintSides;
  printJobKind: PrintJobKind;
  docPaperSize: string;
  docPaperGsm: string;
  docPageScope: PageScope;
  docRangeFrom: string;
  docRangeTo: string;
  bookPaperSize: string;
  bookBodyPages: string;
  bookBodyGsm: string;
  bookBodyColor: PrintColor;
  bookBodySides: PrintSides;
  bookCoverPages: string;
  bookCoverGsm: string;
  bookCoverColor: PrintColor;
  bookBinding: BindingType;
};

/** Kết quả validate sync trước khi đếm trang / upload. */
export type OrderFormValidationResult =
  | { ok: true; copies: number }
  | { ok: false; message: string };

function validatePrintJobSnapshot(
  snap: OrderFormSnapshot,
): { ok: true } | { ok: false; message: string } {
  if (snap.printJobKind === "document") {
    if (!snap.docPaperSize.trim()) {
      return { ok: false, message: "Chọn khổ giấy." };
    }
    if (!snap.docPaperGsm.trim()) {
      return { ok: false, message: "Chọn định lượng giấy." };
    }
    if (snap.docPageScope === "range") {
      const from = parseInt(snap.docRangeFrom.trim(), 10);
      const to = parseInt(snap.docRangeTo.trim(), 10);
      if (
        !Number.isFinite(from) ||
        !Number.isFinite(to) ||
        from < 1 ||
        to < from
      ) {
        return {
          ok: false,
          message:
            "Nhập trang đầu và trang cuối hợp lệ (trang đầu ≤ trang cuối, ≥ 1).",
        };
      }
    }
    return { ok: true };
  }

  if (!snap.bookPaperSize.trim()) {
    return { ok: false, message: "Chọn khổ giấy (in sách)." };
  }
  const body = parseInt(snap.bookBodyPages.trim(), 10);
  const cover = parseInt(snap.bookCoverPages.trim(), 10);
  if (!Number.isFinite(body) || body < 1) {
    return { ok: false, message: "Ruột: nhập số trang (≥ 1)." };
  }
  if (!Number.isFinite(cover) || cover < 1) {
    return { ok: false, message: "Bìa: nhập số trang (≥ 1)." };
  }
  if (!snap.bookBodyGsm.trim()) {
    return { ok: false, message: "Ruột: chọn định lượng giấy." };
  }
  if (!snap.bookCoverGsm.trim()) {
    return { ok: false, message: "Bìa: chọn định lượng giấy." };
  }
  return { ok: true };
}

/**
 * Validate tên, SĐT, file, số bản, địa chỉ giao, tùy chọn in.
 */
export function validateOrderForm(
  snap: OrderFormSnapshot,
  file: File | null,
  opts?: { deliveryCity?: string },
): OrderFormValidationResult {
  if (!snap.customerName.trim()) {
    return { ok: false, message: "Vui lòng nhập tên khách hàng." };
  }
  if (!snap.phone.trim()) {
    return { ok: false, message: "Vui lòng nhập số điện thoại." };
  }
  if (!file) {
    return { ok: false, message: "Vui lòng chọn file tài liệu cần in." };
  }

  const parsedCopies = snap.copiesInput.trim()
    ? parseInt(snap.copiesInput.trim(), 10)
    : 1;
  if (!Number.isFinite(parsedCopies) || parsedCopies <= 0) {
    return { ok: false, message: "Vui lòng nhập số bản in (>= 1)." };
  }

  const city = (opts?.deliveryCity ?? DELIVERY_CITY).trim();
  if (
    snap.deliveryMethod === "delivery" &&
    (!city || !snap.deliveryDistrict.trim() || !snap.deliveryDetail.trim())
  ) {
    return {
      ok: false,
      message: "Vui lòng nhập đầy đủ: Xã/Phường và địa chỉ chi tiết.",
    };
  }

  const pj = validatePrintJobSnapshot(snap);
  if (!pj.ok) return pj;

  return { ok: true, copies: parsedCopies };
}

/**
 * Tổng số trang tính phí sau khi đã có file (PDF có thể đối chiếu).
 */
export async function resolveOrderTotalPages(
  file: File,
  snap: OrderFormSnapshot,
  getPdfPageCount: (f: File) => Promise<number | null>,
): Promise<{ ok: true; totalPages: number } | { ok: false; message: string }> {
  if (snap.printJobKind === "book") {
    const body = parseInt(snap.bookBodyPages.trim(), 10);
    const cover = parseInt(snap.bookCoverPages.trim(), 10);
    if (!Number.isFinite(body) || body < 1) {
      return { ok: false, message: "Ruột: nhập số trang (≥ 1)." };
    }
    if (!Number.isFinite(cover) || cover < 1) {
      return { ok: false, message: "Bìa: nhập số trang (≥ 1)." };
    }
    return { ok: true, totalPages: body + cover };
  }

  const isPdf = file.name.toLowerCase().endsWith(".pdf");

  if (snap.docPageScope === "range") {
    const from = parseInt(snap.docRangeFrom.trim(), 10);
    const to = parseInt(snap.docRangeTo.trim(), 10);
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from < 1 ||
      to < from
    ) {
      return {
        ok: false,
        message:
          "Nhập trang đầu và trang cuối hợp lệ (trang đầu ≤ trang cuối, ≥ 1).",
      };
    }
    if (isPdf) {
      const pdfCount = await getPdfPageCount(file);
      if (pdfCount != null && (from > pdfCount || to > pdfCount)) {
        return {
          ok: false,
          message: `Khoảng trang vượt quá file PDF (${pdfCount} trang).`,
        };
      }
    }
    return { ok: true, totalPages: to - from + 1 };
  }

  const enteredPages = snap.pageCountInput.trim()
    ? parseInt(snap.pageCountInput.trim(), 10)
    : null;

  if (isPdf && enteredPages !== null) {
    const actualCount = await getPdfPageCount(file);
    if (actualCount !== null && actualCount !== enteredPages) {
      return {
        ok: false,
        message: `Số trang không đúng. File PDF có ${actualCount} trang. Vui lòng nhập lại.`,
      };
    }
  }

  if (enteredPages != null && enteredPages > 0) {
    return { ok: true, totalPages: enteredPages };
  }
  if (isPdf) {
    const pdfCount = await getPdfPageCount(file);
    if (pdfCount == null || pdfCount < 1) {
      return {
        ok: false,
        message: "Không đọc được số trang PDF. Vui lòng nhập số trang.",
      };
    }
    return { ok: true, totalPages: pdfCount };
  }
  return { ok: false, message: "Vui lòng nhập số trang." };
}

/** @deprecated Dùng resolveOrderTotalPages — giữ tương thích gọi cũ. */
export async function resolveDocumentTotalPages(
  file: File,
  pageCountInput: string,
  getPdfPageCount: (f: File) => Promise<number | null>,
): Promise<{ ok: true; totalPages: number } | { ok: false; message: string }> {
  const snap: OrderFormSnapshot = {
    customerName: "",
    phone: "",
    note: "",
    copiesInput: "1",
    pageCountInput,
    deliveryMethod: "pickup",
    deliveryDistrict: "",
    deliveryDetail: "",
    printColor: "bw",
    printSides: "double",
    printJobKind: "document",
    docPaperSize: PAPER_SIZES[1],
    docPaperGsm: "80",
    docPageScope: "all",
    docRangeFrom: "1",
    docRangeTo: "",
    bookPaperSize: PAPER_SIZES[1],
    bookBodyPages: "1",
    bookBodyGsm: "80",
    bookBodyColor: "bw",
    bookBodySides: "double",
    bookCoverPages: "2",
    bookCoverGsm: "250",
    bookCoverColor: "color",
    bookBinding: "spring_plastic",
  };
  return resolveOrderTotalPages(file, snap, getPdfPageCount);
}

export function buildOrderSpecFromSnapshot(snap: OrderFormSnapshot): OrderSpecV1 {
  if (snap.printJobKind === "document") {
    const base: OrderSpecV1 = {
      v: 1,
      kind: "document",
      paperSize: snap.docPaperSize.trim(),
      paperGsm: snap.docPaperGsm.trim(),
      pageScope: snap.docPageScope,
    };
    if (snap.docPageScope === "range") {
      return {
        ...base,
        rangeFrom: parseInt(snap.docRangeFrom.trim(), 10),
        rangeTo: parseInt(snap.docRangeTo.trim(), 10),
      };
    }
    return base;
  }
  return {
    v: 1,
    kind: "book",
    paperSize: snap.bookPaperSize.trim(),
    body: {
      pages: parseInt(snap.bookBodyPages.trim(), 10),
      gsm: snap.bookBodyGsm.trim(),
      printColor: snap.bookBodyColor,
      printSides: snap.bookBodySides,
    },
    cover: {
      pages: parseInt(snap.bookCoverPages.trim(), 10),
      gsm: snap.bookCoverGsm.trim(),
      printColor: snap.bookCoverColor,
    },
    binding: snap.bookBinding,
  };
}

/** Ước tính số trang để hiển thị tổng tiền trên form (trước khi gửi server). */
export function estimatePagesForPricing(
  snap: Pick<
    OrderFormSnapshot,
    | "printJobKind"
    | "pageCountInput"
    | "docPageScope"
    | "docRangeFrom"
    | "docRangeTo"
    | "bookBodyPages"
    | "bookCoverPages"
  >,
): number | null {
  if (snap.printJobKind === "book") {
    const b = parseInt(snap.bookBodyPages.trim(), 10);
    const c = parseInt(snap.bookCoverPages.trim(), 10);
    if (Number.isFinite(b) && b >= 1 && Number.isFinite(c) && c >= 1) {
      return b + c;
    }
    return null;
  }
  if (snap.docPageScope === "range") {
    const from = parseInt(snap.docRangeFrom.trim(), 10);
    const to = parseInt(snap.docRangeTo.trim(), 10);
    if (Number.isFinite(from) && Number.isFinite(to) && from >= 1 && to >= from) {
      return to - from + 1;
    }
    return null;
  }
  const p = parseInt(snap.pageCountInput.trim(), 10);
  return Number.isFinite(p) && p > 0 ? p : null;
}

export function printColorSidesForDb(snap: OrderFormSnapshot): {
  printColor: PrintColor;
  printSides: PrintSides;
} {
  if (snap.printJobKind === "book") {
    return {
      printColor: snap.bookBodyColor,
      printSides: snap.bookBodySides,
    };
  }
  return { printColor: snap.printColor, printSides: snap.printSides };
}

export function buildNewOrderId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function buildStorageObjectPath(fileName: string): string {
  return `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
}

/** Dựng payload insert sau khi đã có URL file và số trang. */
export function buildOrderPayload(params: {
  id: string;
  customerName: string;
  phone: string;
  note: string;
  fileName: string;
  fileUrl: string;
  totalPages: number;
  copies: number;
  deliveryMethod: DeliveryMethod;
  deliveryDetail: string;
  deliveryDistrict: string;
  printColor: PrintColor;
  printSides: PrintSides;
  orderSpec: OrderSpecV1;
  pricing: PricingConfigV1;
  deliveryConfig: DeliveryConfigV1;
  /** Mặc định NEXT_PUBLIC_PRICE_PER_PAGE — khi thiếu ô trong bảng base. */
  fallbackPricePerPage?: number;
}): OrderInsert {
  const fallback =
    params.fallbackPricePerPage ?? publicConfig.pricePerPage;
  const printSubtotal = computePrintSubtotalForOrder({
    orderSpec: params.orderSpec,
    totalPages: params.totalPages,
    copies: params.copies,
    printColor: params.printColor,
    printSides: params.printSides,
    pricing: params.pricing,
    fallbackPricePerPage: fallback,
  });
  const grand = grandTotalFromPrintSubtotal(
    printSubtotal,
    params.deliveryMethod,
    {
      freeshipThresholdVnd: params.deliveryConfig.freeshipThresholdVnd,
      shippingFeeDelivery: params.deliveryConfig.shippingFeeDelivery,
    },
  );
  const fullAddress =
    params.deliveryMethod === "delivery"
      ? `${params.deliveryDetail.trim()}, ${params.deliveryDistrict.trim()}, ${params.deliveryConfig.city.trim()}`
      : null;

  return {
    id: params.id,
    customer_name: params.customerName.trim(),
    phone_number: params.phone.trim(),
    file_url: params.fileUrl,
    file_name: params.fileName,
    note: params.note.trim() || null,
    page_count: params.totalPages,
    total_pages: params.totalPages,
    total_price: grand.total,
    copies: params.copies,
    print_color: params.printColor,
    print_sides: params.printSides,
    delivery_method: params.deliveryMethod,
    delivery_address: fullAddress,
    shipping_fee: grand.shippingFee,
    order_spec: params.orderSpec as unknown as Record<string, unknown>,
  };
}
