"use server";

import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { isValidUuid } from "@/lib/uuid";

export type CheckoutData = {
  orderId: string;
  externalId: string | null;
  documentTitle: string;
  amount: number;
  paymentLink: string | null;
  transferContent: string;
  status: string;
};

export type CheckoutStatusData = {
  orderId: string;
  status: string;
  paidAt: string | null;
};


import { createCheckoutRepository } from "@/lib/domain/checkout";
import { resolveCheckoutPaymentProvider } from "@/lib/payments/providers";
import { runCheckoutOrchestrator } from "@/lib/domain/checkout/services/checkout-service";

export async function createCheckoutVietQr(
  documentId: string,
): Promise<ActionResult<CheckoutData>> {
  if (!documentId || !isValidUuid(documentId)) return fail("document_id không hợp lệ.");

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return fail("Vui lòng đăng nhập để thanh toán.");

  try {
    const repository = createCheckoutRepository();
    const paymentProvider = resolveCheckoutPaymentProvider();

    const result = await runCheckoutOrchestrator({
      repository,
      paymentProvider,
      documentId,
    });
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Không thể tạo đơn hàng.");
  }
}

export async function getCheckoutOrderStatus(
  orderId: string,
): Promise<ActionResult<CheckoutStatusData>> {
  if (!orderId || !isValidUuid(orderId)) return fail("order_id không hợp lệ.");

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return fail("Vui lòng đăng nhập để kiểm tra đơn hàng.");

  try {
    const repository = createCheckoutRepository();
    const status = await repository.getOrderStatus(orderId);
    if (!status) return fail("Không tìm thấy đơn hàng.");
    return ok(status);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Không tìm thấy đơn hàng.");
  }
}
