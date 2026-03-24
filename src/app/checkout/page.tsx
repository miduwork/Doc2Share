import { Suspense } from "react";
import PublicLayout from "@/features/layout/components/PublicLayout";
import CheckoutForm from "@/features/checkout/components/CheckoutForm";

function LoadingFallback() {
  return (
    <PublicLayout>
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    </PublicLayout>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PublicLayout>
        <CheckoutForm />
      </PublicLayout>
    </Suspense>
  );
}

