import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "default", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "outline" }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", variant === "outline" ? "border border-slate-200 text-slate-600" : "brand-soft", className)} {...props} />;
}
