"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveCheckoutPaymentProvider } from "@/lib/payments/providers";
import type { CheckoutPaymentProvider } from "@/lib/payments/providers/types";
import { createCheckoutRepository, type CheckoutRepository } from "@/lib/domain/checkout";
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

type CheckoutActionDeps = {
  repository: CheckoutRepository;
  paymentProvider: CheckoutPaymentProvider;
};

function resolveCheckoutDeps(overrides?: Partial<CheckoutActionDeps>): CheckoutActionDeps {
  return {
    repository: overrides?.repository ?? createCheckoutRepository(),
    paymentProvider: overrides?.paymentProvider ?? resolveCheckoutPaymentProvider(),
  };
}

export async function createCheckoutVietQr(
  documentId: string,
  deps?: Partial<CheckoutActionDeps>
): Promise<ActionResult<CheckoutData>> {
  if (!documentId || !isValidUuid(documentId)) return fail("document_id không hợp lệ.");

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return fail("Vui lòng đăng nhập để thanh toán.");

  try {
    const { repository, paymentProvider } = resolveCheckoutDeps(deps);
    const created = await repository.createCheckoutOrder(documentId);
    const meta = await repository.getOrderMeta(created.orderId);
    const { transferContent, paymentLink } = paymentProvider.buildCheckoutPayment({
      orderId: created.orderId,
      externalId: meta.externalId,
      amount: created.amount,
    });
    return ok({
      orderId: created.orderId,
      externalId: meta.externalId,
      documentTitle: created.documentTitle,
      amount: created.amount,
      paymentLink,
      transferContent,
      status: meta.status,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Không thể tạo đơn hàng.");
  }
}

export async function getCheckoutOrderStatus(
  orderId: string,
  deps?: Partial<CheckoutActionDeps>
): Promise<ActionResult<CheckoutStatusData>> {
  if (!orderId || !isValidUuid(orderId)) return fail("order_id không hợp lệ.");

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return fail("Vui lòng đăng nhập để kiểm tra đơn hàng.");

  try {
    const { repository } = resolveCheckoutDeps(deps);
    const status = await repository.getOrderStatus(orderId);
    if (!status) return fail("Không tìm thấy đơn hàng.");
    return ok({ orderId: status.orderId, status: status.status, paidAt: status.paidAt });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Không tìm thấy đơn hàng.");
  }
}
