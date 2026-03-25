import {
  paymentSkeletonMutedClass,
  paymentSkeletonStrongClass,
} from "@/components/order-form/formStyles";

type Variant = "strong" | "muted";

type Props = {
  className?: string;
  variant?: Variant;
};

export function SkeletonBar({ className, variant = "muted" }: Props) {
  const base =
    variant === "strong" ? paymentSkeletonStrongClass : paymentSkeletonMutedClass;
  return <div className={[base, className].filter(Boolean).join(" ")} />;
}
