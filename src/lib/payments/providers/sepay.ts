import { buildVietQrUrl } from "@/lib/payments/vietqr";
import type { CheckoutPaymentContext, CheckoutPaymentProvider } from "@/lib/payments/providers/types";

export const sepayCheckoutProvider: CheckoutPaymentProvider = {
  id: "sepay",
  buildCheckoutPayment(context: CheckoutPaymentContext) {
    const transferContent = context.externalId ?? `D2S-${context.orderId.slice(0, 8).toUpperCase()}`;

    const bankBin = process.env.VIETQR_BANK_BIN || "";
    const accountNo = process.env.VIETQR_ACCOUNT_NO || "";
    const accountName = process.env.VIETQR_ACCOUNT_NAME || "";
    const template = process.env.VIETQR_TEMPLATE || "compact2";

    let paymentLink: string | null = null;
    if (bankBin && accountNo && accountName) {
      paymentLink = buildVietQrUrl({
        bankBin,
        accountNo,
        amount: context.amount,
        addInfo: transferContent,
        template,
        accountName,
      });
    }

    return {
      transferContent,
      paymentLink,
    };
  },
};
