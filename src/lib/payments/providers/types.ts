export type CheckoutPaymentContext = {
  orderId: string;
  externalId: string | null;
  amount: number;
};

export type CheckoutPaymentResult = {
  transferContent: string;
  paymentLink: string | null;
};

export interface CheckoutPaymentProvider {
  id: string;
  buildCheckoutPayment(_context: CheckoutPaymentContext): CheckoutPaymentResult;
}
