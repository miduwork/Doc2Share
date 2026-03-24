import type { CheckoutRepository } from "../ports";
import type { CheckoutPaymentProvider } from "@/lib/payments/providers/types";

export type CheckoutOrchestrationResult = {
    orderId: string;
    externalId: string | null;
    documentTitle: string;
    amount: number;
    paymentLink: string | null;
    transferContent: string;
    status: string;
};

/**
 * Orchestrates the creation of a checkout.
 * Coordinates between the repository for order data and the payment provider for payment details.
 */
export async function runCheckoutOrchestrator(input: {
    repository: CheckoutRepository;
    paymentProvider: CheckoutPaymentProvider;
    documentId: string;
}): Promise<CheckoutOrchestrationResult> {
    const created = await input.repository.createCheckoutOrder(input.documentId);
    const meta = await input.repository.getOrderMeta(created.orderId);

    const { transferContent, paymentLink } = input.paymentProvider.buildCheckoutPayment({
        orderId: created.orderId,
        externalId: meta.externalId,
        amount: created.amount,
    });

    return {
        orderId: created.orderId,
        externalId: meta.externalId,
        documentTitle: created.documentTitle,
        amount: created.amount,
        paymentLink,
        transferContent,
        status: meta.status,
    };
}
