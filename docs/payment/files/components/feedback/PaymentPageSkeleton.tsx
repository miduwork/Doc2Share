import {
  formPageContentMaxMdClass,
  formPageShellClass,
  formSectionCardClass,
  formSectionCardMbClass,
} from "@/components/order-form/formStyles";
import { SkeletonBar } from "./SkeletonBar";

export function PaymentPageSkeleton() {
  return (
    <main className={formPageShellClass}>
      <div className={formPageContentMaxMdClass}>
        <div className="mb-6 text-center">
          <SkeletonBar variant="strong" className="mx-auto mb-3 h-6 w-32" />
          <SkeletonBar variant="muted" className="mx-auto h-4 w-40" />
        </div>

        <div className={formSectionCardMbClass}>
          <SkeletonBar variant="strong" className="mb-4 h-4 w-24" />
          <div className="space-y-3">
            <div className="flex justify-between">
              <SkeletonBar variant="muted" className="h-3 w-20" />
              <SkeletonBar variant="muted" className="h-3 w-24" />
            </div>
            <div className="flex justify-between">
              <SkeletonBar variant="muted" className="h-3 w-16" />
              <SkeletonBar variant="muted" className="h-3 w-32" />
            </div>
            <div className="flex justify-between">
              <SkeletonBar variant="muted" className="h-3 w-24" />
              <SkeletonBar variant="muted" className="h-3 w-16" />
            </div>
          </div>
        </div>

        <div className={`${formSectionCardClass} flex flex-col items-center`}>
          <SkeletonBar variant="strong" className="mb-4 h-4 w-32" />
          <SkeletonBar variant="muted" className="h-48 w-48 rounded-xl" />
          <SkeletonBar variant="muted" className="mt-3 h-3 w-40" />
          <SkeletonBar variant="muted" className="mt-5 h-10 w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}
