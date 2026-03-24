import type {
    CheckoutOrderMeta,
    CheckoutOrderStatus,
    CheckoutRepository,
    CreateCheckoutOrderResult,
} from "../../ports";

export type MockCheckoutState = {
    createdOrder?: CreateCheckoutOrderResult;
    orderMeta?: CheckoutOrderMeta;
    orderStatus?: CheckoutOrderStatus | null;
    calls: {
        create: string[];
        getMeta: string[];
        getStatus: string[];
    };
};

export function createMockCheckoutRepository(input?: {
    overrides?: Partial<CheckoutRepository>;
    seed?: Partial<MockCheckoutState>;
}) {
    const state: MockCheckoutState = {
        createdOrder: input?.seed?.createdOrder ?? {
            orderId: "order-mock-1",
            amount: 50000,
            documentTitle: "Mock Document",
        },
        orderMeta: input?.seed?.orderMeta ?? {
            externalId: "ext-mock-1",
            status: "pending",
        },
        orderStatus: input?.seed?.orderStatus ?? null,
        calls: input?.seed?.calls ?? {
            create: [],
            getMeta: [],
            getStatus: [],
        },
    };

    const repository: CheckoutRepository = {
        async createCheckoutOrder(documentId) {
            state.calls.create.push(documentId);
            if (!state.createdOrder) throw new Error("Mock: No order seeded");
            return state.createdOrder;
        },
        async getOrderMeta(orderId) {
            state.calls.getMeta.push(orderId);
            if (!state.orderMeta) throw new Error("Mock: No meta seeded");
            return state.orderMeta;
        },
        async getOrderStatus(orderId) {
            state.calls.getStatus.push(orderId);
            return state.orderStatus ?? null;
        },
        ...(input?.overrides ?? {}),
    };

    return { repository, state };
}
