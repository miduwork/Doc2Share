import {
  isBindingType,
  isPageScope,
  isPrintJobKind,
  type OrderFormSnapshot,
} from "@/lib/orders/createOrder";
import type { BindingType, PrintJobKind } from "@/lib/orders/printJobSpec";
import { PAPER_SIZES } from "@/lib/orders/printJobSpec";
import type { DeliveryMethod } from "@/lib/orders/delivery";
import type { PrintColor, PrintSides } from "@/lib/orders/printOptions";

const DELIVERY: DeliveryMethod[] = ["pickup", "delivery"];
const PRINT_COLORS: PrintColor[] = ["bw", "color"];
const PRINT_SIDES: PrintSides[] = ["double", "single"];

function isDeliveryMethod(v: string): v is DeliveryMethod {
  return (DELIVERY as readonly string[]).includes(v);
}

function isPrintColor(v: string): v is PrintColor {
  return (PRINT_COLORS as readonly string[]).includes(v);
}

function isPrintSides(v: string): v is PrintSides {
  return (PRINT_SIDES as readonly string[]).includes(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export type ParsedFormSnapshot =
  | { ok: true; snap: OrderFormSnapshot }
  | { ok: false; message: string };

const DEFAULT_DOC_PAPER = PAPER_SIZES[1];
const DEFAULT_BOOK_PAPER = PAPER_SIZES[1];

function buildSnapshot(fields: {
  customerName: string;
  phone: string;
  note: string;
  copiesInput: string;
  pageCountInput: string;
  deliveryMethod: string;
  deliveryDistrict: string;
  deliveryDetail: string;
  printColor: string;
  printSides: string;
  printJobKind: string;
  docPaperSize: string;
  docPaperGsm: string;
  docPageScope: string;
  docRangeFrom: string;
  docRangeTo: string;
  bookPaperSize: string;
  bookBodyPages: string;
  bookBodyGsm: string;
  bookBodyColor: string;
  bookBodySides: string;
  bookCoverPages: string;
  bookCoverGsm: string;
  bookCoverColor: string;
  bookBinding: string;
}): ParsedFormSnapshot {
  if (!isDeliveryMethod(fields.deliveryMethod)) {
    return { ok: false, message: "Phương thức nhận hàng không hợp lệ." };
  }
  if (!isPrintColor(fields.printColor)) {
    return { ok: false, message: "Tùy chọn màu in không hợp lệ." };
  }
  if (!isPrintSides(fields.printSides)) {
    return { ok: false, message: "Tùy chọn mặt in không hợp lệ." };
  }
  if (!isPrintJobKind(fields.printJobKind)) {
    return { ok: false, message: "Loại in không hợp lệ." };
  }
  if (!isPageScope(fields.docPageScope)) {
    return { ok: false, message: "Phạm vi trang không hợp lệ." };
  }
  if (!isBindingType(fields.bookBinding)) {
    return { ok: false, message: "Đóng gáy không hợp lệ." };
  }
  if (fields.printJobKind === "book") {
    if (!isPrintColor(fields.bookBodyColor)) {
      return { ok: false, message: "Ruột: màu in không hợp lệ." };
    }
    if (!isPrintSides(fields.bookBodySides)) {
      return { ok: false, message: "Ruột: mặt in không hợp lệ." };
    }
    if (!isPrintColor(fields.bookCoverColor)) {
      return { ok: false, message: "Bìa: màu in không hợp lệ." };
    }
  }

  const printJobKind = fields.printJobKind as PrintJobKind;
  const bookBinding = fields.bookBinding as BindingType;

  return {
    ok: true,
    snap: {
      customerName: fields.customerName,
      phone: fields.phone,
      note: fields.note,
      copiesInput: fields.copiesInput,
      pageCountInput: fields.pageCountInput,
      deliveryMethod: fields.deliveryMethod,
      deliveryDistrict: fields.deliveryDistrict,
      deliveryDetail: fields.deliveryDetail,
      printColor: fields.printColor as PrintColor,
      printSides: fields.printSides as PrintSides,
      printJobKind,
      docPaperSize: fields.docPaperSize.trim() || DEFAULT_DOC_PAPER,
      docPaperGsm: fields.docPaperGsm.trim() || "80",
      docPageScope: fields.docPageScope as "all" | "range",
      docRangeFrom: fields.docRangeFrom.trim() || "1",
      docRangeTo: fields.docRangeTo.trim(),
      bookPaperSize: fields.bookPaperSize.trim() || DEFAULT_BOOK_PAPER,
      bookBodyPages: fields.bookBodyPages.trim(),
      bookBodyGsm: fields.bookBodyGsm.trim() || "80",
      bookBodyColor: fields.bookBodyColor as PrintColor,
      bookBodySides: fields.bookBodySides as PrintSides,
      bookCoverPages: fields.bookCoverPages.trim(),
      bookCoverGsm: fields.bookCoverGsm.trim() || "250",
      bookCoverColor: fields.bookCoverColor as PrintColor,
      bookBinding,
    },
  };
}

export function parseOrderSnapshotFromFormData(
  formData: FormData,
): ParsedFormSnapshot {
  return buildSnapshot({
    customerName: str(formData.get("customerName")),
    phone: str(formData.get("phone")),
    note: str(formData.get("note")),
    copiesInput: str(formData.get("copiesInput")),
    pageCountInput: str(formData.get("pageCountInput")),
    deliveryMethod: str(formData.get("deliveryMethod")),
    deliveryDistrict: str(formData.get("deliveryDistrict")),
    deliveryDetail: str(formData.get("deliveryDetail")),
    printColor: str(formData.get("printColor")),
    printSides: str(formData.get("printSides")),
    printJobKind: str(formData.get("printJobKind")) || "document",
    docPaperSize: str(formData.get("docPaperSize")),
    docPaperGsm: str(formData.get("docPaperGsm")),
    docPageScope: str(formData.get("docPageScope")) || "all",
    docRangeFrom: str(formData.get("docRangeFrom")),
    docRangeTo: str(formData.get("docRangeTo")),
    bookPaperSize: str(formData.get("bookPaperSize")),
    bookBodyPages: str(formData.get("bookBodyPages")),
    bookBodyGsm: str(formData.get("bookBodyGsm")),
    bookBodyColor: str(formData.get("bookBodyColor")) || "bw",
    bookBodySides: str(formData.get("bookBodySides")) || "double",
    bookCoverPages: str(formData.get("bookCoverPages")),
    bookCoverGsm: str(formData.get("bookCoverGsm")),
    bookCoverColor: str(formData.get("bookCoverColor")) || "color",
    bookBinding: str(formData.get("bookBinding")) || "spring_plastic",
  });
}

export function parseOrderSnapshotFromJson(
  body: Record<string, unknown>,
): ParsedFormSnapshot {
  return buildSnapshot({
    customerName: str(body.customerName),
    phone: str(body.phone),
    note: str(body.note),
    copiesInput: str(body.copiesInput),
    pageCountInput: str(body.pageCountInput),
    deliveryMethod: str(body.deliveryMethod),
    deliveryDistrict: str(body.deliveryDistrict),
    deliveryDetail: str(body.deliveryDetail),
    printColor: str(body.printColor),
    printSides: str(body.printSides),
    printJobKind: str(body.printJobKind) || "document",
    docPaperSize: str(body.docPaperSize),
    docPaperGsm: str(body.docPaperGsm),
    docPageScope: str(body.docPageScope) || "all",
    docRangeFrom: str(body.docRangeFrom),
    docRangeTo: str(body.docRangeTo),
    bookPaperSize: str(body.bookPaperSize),
    bookBodyPages: str(body.bookBodyPages),
    bookBodyGsm: str(body.bookBodyGsm),
    bookBodyColor: str(body.bookBodyColor) || "bw",
    bookBodySides: str(body.bookBodySides) || "double",
    bookCoverPages: str(body.bookCoverPages),
    bookCoverGsm: str(body.bookCoverGsm),
    bookCoverColor: str(body.bookCoverColor) || "color",
    bookBinding: str(body.bookBinding) || "spring_plastic",
  });
}
