export const publicConfig = {
    pricePerPage: Number(process.env.NEXT_PUBLIC_PRICE_PER_PAGE) || 500,
    vietqr: {
        // /api/qr is a server route, so prefer server env vars.
        // If only VIETQR_* (non-NEXT_PUBLIC) is configured, fall back to those.
        bankId: process.env.NEXT_PUBLIC_VIETQR_BANK_ID || process.env.VIETQR_BANK_BIN || "MB",
        accountNo:
            process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NO ||
            process.env.VIETQR_ACCOUNT_NO ||
            "123456789",
    },
} as const;
