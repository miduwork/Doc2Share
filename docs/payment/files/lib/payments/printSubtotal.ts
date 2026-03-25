import { defaultBindingFeeVnd } from "@/lib/config/appConfigSchema";
import type { PricingConfigV1 } from "@/lib/config/appConfigSchema";
import type { OrderSpecV1 } from "@/lib/orders/printJobSpec";
import type { PrintColor, PrintSides } from "@/lib/orders/printOptions";

import { resolvePricePerPage } from "./resolvePricePerPage";

/** Bìa sách không có printSides trong order_spec — P0 dùng 2 mặt khi lookup giá. */
const COVER_PRINT_SIDES: PrintSides = "double";

export type BookOrderSpec = Extract<OrderSpecV1, { kind: "book" }>;

function roundVnd(n: number): number {
  return Math.round(n);
}

/** Ruột + bìa + đóng gáy (sách). Dùng chung cho tổng subtotal và UI breakdown. */
export function computeBookPrintBreakdown(params: {
  orderSpec: BookOrderSpec;
  copies: number;
  pricing: PricingConfigV1;
  fallbackPricePerPage: number;
}): {
  bodySubtotal: number;
  coverSubtotal: number;
  bindingSubtotal: number;
} {
  const { orderSpec, copies, pricing, fallbackPricePerPage } = params;
  const paperSize = orderSpec.paperSize;
  const bodyPpp = resolvePricePerPage({
    paperSize,
    gsm: orderSpec.body.gsm,
    color: orderSpec.body.printColor,
    sides: orderSpec.body.printSides,
    pricing,
    fallbackPricePerPage,
  });
  const coverPpp = resolvePricePerPage({
    paperSize,
    gsm: orderSpec.cover.gsm,
    color: orderSpec.cover.printColor,
    sides: COVER_PRINT_SIDES,
    pricing,
    fallbackPricePerPage,
  });
  const fees = pricing.bindingFeeVnd ?? defaultBindingFeeVnd();
  const raw = fees[orderSpec.binding];
  const perCopy =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0
      ? roundVnd(raw)
      : 0;
  const bindingSubtotal = perCopy * copies;
  return {
    bodySubtotal: bodyPpp * orderSpec.body.pages * copies,
    coverSubtotal: coverPpp * orderSpec.cover.pages * copies,
    bindingSubtotal,
  };
}

export function computePrintSubtotalForOrder(params: {
  orderSpec: OrderSpecV1;
  totalPages: number;
  copies: number;
  /** Dùng cho đơn tài liệu; đơn sách lấy từ order_spec.body/cover. */
  printColor: PrintColor;
  printSides: PrintSides;
  pricing: PricingConfigV1;
  fallbackPricePerPage: number;
}): number {
  const {
    orderSpec,
    totalPages,
    copies,
    printColor,
    printSides,
    pricing,
    fallbackPricePerPage,
  } = params;

  if (orderSpec.kind === "document") {
    const ppp = resolvePricePerPage({
      paperSize: orderSpec.paperSize,
      gsm: orderSpec.paperGsm,
      color: printColor,
      sides: printSides,
      pricing,
      fallbackPricePerPage,
    });
    return ppp * totalPages * copies;
  }

  const { bodySubtotal, coverSubtotal, bindingSubtotal } =
    computeBookPrintBreakdown({
      orderSpec,
      copies,
      pricing,
      fallbackPricePerPage,
    });
  return bodySubtotal + coverSubtotal + bindingSubtotal;
}
