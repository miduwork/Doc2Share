/** Tương thích: đơn hàng — nguồn canonical tại `lib/orders/types`. */
export type { OrderInsert, Order } from "./orders/types";
export { ORDER_PRIORITY, ORDER_STATUS } from "./orders/types";

/** Bản ghi log giao dịch từ webhook (bảng transactions) */
export type TransactionInsert = {
  sepay_id: number | null;
  gateway: string | null;
  transaction_date: string | null;
  account_number: string | null;
  content: string | null;
  description: string | null;
  transfer_type: string | null;
  transfer_amount: number | null;
  reference_code: string | null;
  order_id: string | null;
  order_id_prefix: string | null;
  amount_matched: boolean;
  order_updated: boolean;
  raw_payload: Record<string, unknown>;
};
