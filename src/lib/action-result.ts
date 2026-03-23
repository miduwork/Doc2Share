/**
 * Shared shape for server action and API responses. Use for consistent client handling and easier integration.
 *
 * @example
 * // In a server action:
 * return ok({ orderId: "...", amount: 100000 });
 * return fail("Không thể tạo đơn hàng.");
 *
 * // Client:
 * const result = await createCheckout(...);
 * if (result.ok) use(result.data); else show(result.error);
 */

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export function ok<T>(data?: T): ActionResult<T> {
  return data !== undefined ? { ok: true, data } : { ok: true };
}

export function fail(message: string): ActionResult<never> {
  return { ok: false, error: message };
}
