export const publicConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  pricePerPage: Number(process.env.NEXT_PUBLIC_PRICE_PER_PAGE) || 500,
  vietqr: {
    bankId: process.env.NEXT_PUBLIC_VIETQR_BANK_ID || "MB",
    accountNo: process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NO || "123456789",
  },
} as const;

