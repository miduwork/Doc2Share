import "server-only";

export type CreateCheckoutOrderResult = {
  orderId: string;
  amount: number;
  documentTitle: string;
};

export type CheckoutOrderMeta = {
  externalId: string | null;
  status: string;
};

export type CheckoutOrderStatus = {
  orderId: string;
  status: string;
  paidAt: string | null;
};

export interface CheckoutRepository {
  createCheckoutOrder(_documentId: string): Promise<CreateCheckoutOrderResult>;
  getOrderMeta(_orderId: string): Promise<CheckoutOrderMeta>;
  getOrderStatus(_orderId: string): Promise<CheckoutOrderStatus | null>;
}
