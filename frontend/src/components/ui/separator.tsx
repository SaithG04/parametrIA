import * as SeparatorPrimitive from "@radix-ui/react-separator";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, orientation = "horizontal", decorative = true, ...props }: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root decorative={decorative} orientation={orientation} className={cn(orientation === "horizontal" ? "h-px w-full" : "h-full w-px", "shrink-0 bg-slate-200", className)} {...props} />;
}
