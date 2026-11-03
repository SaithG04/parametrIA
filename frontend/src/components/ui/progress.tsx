import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Progress({ className, value = 0, ...props }: ComponentProps<typeof ProgressPrimitive.Root>) {
  const percentage = Math.max(0, Math.min(100, value ?? 0));
  return <ProgressPrimitive.Root className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-100", className)} value={percentage} {...props}>
    <ProgressPrimitive.Indicator className="brand-progress h-full transition-transform" style={{ transform: `translateX(-${100 - percentage}%)` }} />
  </ProgressPrimitive.Root>;
}
