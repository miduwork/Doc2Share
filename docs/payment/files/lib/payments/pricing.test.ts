import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/config/public", () => ({
  publicConfig: {
    supabaseUrl: "",
    supabaseAnonKey: "",
    pricePerPage: 500,
    vietqr: { bankId: "MB", accountNo: "1" },
  },
}));

vi.mock("@/lib/config/business", () => ({
  FREESHIP_THRESHOLD_VND: 200_000,
  PICKUP_ADDRESS_DISPLAY: "",
  getFreeshipHintText: () => "",
}));

import { calculateTotal, calculateGrandTotal } from "./pricing";

describe("calculateTotal", () => {
  it("returns pages * copies * pricePerPage", () => {
    expect(calculateTotal(10, 2)).toBe(10_000);
  });

  it("returns 0 for invalid pages", () => {
    expect(calculateTotal(0, 1)).toBe(0);
    expect(calculateTotal(-1, 1)).toBe(0);
  });

  it("defaults copies to 1 when invalid", () => {
    expect(calculateTotal(4, 0)).toBe(2000);
  });
});

describe("calculateGrandTotal", () => {
  it("adds shipping for delivery when below freeship threshold", () => {
    const r = calculateGrandTotal(10, 1, "delivery");
    expect(r.printSubtotal).toBe(5000);
    expect(r.shippingFee).toBe(20_000);
    expect(r.total).toBe(25_000);
  });

  it("zeros shipping for pickup", () => {
    const r = calculateGrandTotal(10, 1, "pickup");
    expect(r.shippingFee).toBe(0);
    expect(r.total).toBe(5000);
  });

  it("applies freeship when print subtotal reaches threshold", () => {
    const r = calculateGrandTotal(400, 1, "delivery");
    expect(r.printSubtotal).toBe(200_000);
    expect(r.shippingFee).toBe(0);
    expect(r.total).toBe(200_000);
  });
});
