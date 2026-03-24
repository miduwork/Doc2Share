import { test } from "node:test";
import { strict as assert } from "node:assert";
import { runCheckoutOrchestrator } from "./checkout-service.ts";
import { createMockCheckoutRepository } from "../adapters/mock/checkout.repository.ts";
import type { CheckoutPaymentProvider } from "@/lib/payments/providers/types";

test("runCheckoutOrchestrator coordinates repository and payment provider", async () => {
    const mockRepo = createMockCheckoutRepository({
        seed: {
            createdOrder: { orderId: "ord-123", amount: 15000, documentTitle: "Test Doc" },
            orderMeta: { externalId: "ext-456", status: "pending" },
        },
    });

    const mockProvider: CheckoutPaymentProvider = {
        id: "mock-pay",
        buildCheckoutPayment: (ctx) => {
            assert.equal(ctx.orderId, "ord-123");
            assert.equal(ctx.amount, 15000);
            assert.equal(ctx.externalId, "ext-456");
            return {
                transferContent: `PAY ${ctx.orderId}`,
                paymentLink: `https://pay.test/${ctx.orderId}`,
            };
        },
    };

    const result = await runCheckoutOrchestrator({
        repository: mockRepo.repository,
        paymentProvider: mockProvider,
        documentId: "doc-789",
    });

    assert.deepEqual(result, {
        orderId: "ord-123",
        externalId: "ext-456",
        documentTitle: "Test Doc",
        amount: 15000,
        paymentLink: "https://pay.test/ord-123",
        transferContent: "PAY ord-123",
        status: "pending",
    });

    assert.deepEqual(mockRepo.state.calls.create, ["doc-789"]);
    assert.deepEqual(mockRepo.state.calls.getMeta, ["ord-123"]);
});
