import { describe, expect, it } from "vitest";
import { normalizeSePayPayload } from "./sepay";

describe("normalizeSePayPayload — số tiền", () => {
  it('chuỗi "2.000" (định dạng VNĐ) phải là 2000, không phải 2', () => {
    const { transferAmount } = normalizeSePayPayload({
      transferType: "in",
      transferAmount: "2.000" as unknown as number,
    });
    expect(transferAmount).toBe(2000);
  });

  it("số nguyên dạng chuỗi vẫn đúng", () => {
    const { transferAmount } = normalizeSePayPayload({
      transferType: "in",
      transferAmount: "2000" as unknown as number,
    });
    expect(transferAmount).toBe(2000);
  });

  it("số thực number từ JSON", () => {
    const { transferAmount } = normalizeSePayPayload({
      transferType: "in",
      transferAmount: 1500000,
    });
    expect(transferAmount).toBe(1500000);
  });

  it('amount BankHub dạng "1.500.000"', () => {
    const { transferAmount } = normalizeSePayPayload({
      transfer_type: "credit",
      amount: "1.500.000",
    });
    expect(transferAmount).toBe(1500000);
  });

  it("thiếu transferType nhưng có số tiền dương → coi là tiền vào", () => {
    const { transferTypeNorm, transferAmount } = normalizeSePayPayload({
      transferAmount: 2000,
    });
    expect(transferTypeNorm).toBe("in");
    expect(transferAmount).toBe(2000);
  });
});
