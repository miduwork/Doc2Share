import { handleSePayWebhook, normalizeSePayPayload } from "../src/lib/webhooks/sepay";

async function test() {
    console.log("Testing SePay Webhook Logic...");

    const mockPayload = {
        id: 12345,
        content: "IN AN a1b2c3d4",
        transferAmount: 50000,
        transferType: "in"
    };

    const { transferTypeNorm, transferAmount } = normalizeSePayPayload(mockPayload);
    console.log(`Normalized: Type=${transferTypeNorm}, Amount=${transferAmount}`);

    if (transferTypeNorm === 'in' && transferAmount === 50000) {
        console.log("✅ Normalization successful.");
    } else {
        console.error("❌ Normalization failed.");
    }

    console.log("Logic verification complete. To test fully, run 'npx supabase db push' then send a real POST request to /api/webhook/sepay");
}

test().catch(console.error);
