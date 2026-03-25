import { publicConfig } from "@/lib/config/public";

export function buildVietQRUrl(totalPrice: number, orderIdShort: string) {
  const amount = Math.max(0, Math.floor(totalPrice || 0));
  const { bankId, accountNo } = publicConfig.vietqr;
  const addInfo = `IN AN ${orderIdShort}`;

  const base = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png`;
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo,
  });

  return {
    url: `${base}?${params.toString()}`,
    addInfo,
  };
}

