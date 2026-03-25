export const serverConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  sepayWebhookKey: process.env.WEBHOOK_SEPAY_API_KEY ?? "",
  sepayMerchantId: process.env.SEPAY_MERCHANT_ID ?? null,
} as const;

