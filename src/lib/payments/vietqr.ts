export function buildVietQrUrl(params: {
  bankBin: string;
  accountNo: string;
  amount: number;
  addInfo: string;
  template?: string;
  accountName?: string;
}) {
  const template = params.template || "compact2";
  const amount = Math.max(0, Math.round(params.amount || 0));
  const base = `https://img.vietqr.io/image/${params.bankBin}-${params.accountNo}-${template}.png`;
  const search = new URLSearchParams({
    amount: String(amount),
    addInfo: params.addInfo,
  });

  if (params.accountName) {
    search.set("accountName", params.accountName);
  }

  return `${base}?${search.toString()}`;
}
