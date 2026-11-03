import type { AiProvider } from "@/services/types";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/20 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProviderLogo({
  provider,
  className,
}: {
  provider?: Pick<AiProvider, "name" | "logoUrl"> | null;
  className?: string;
}) {
  const colorClass = PALETTE[(provider?.name.length ?? 0) % PALETTE.length];
  if (provider?.logoUrl) {
    return (
      <img
        src={provider.logoUrl}
        alt={provider.name}
        className={cn("size-9 rounded-lg border border-border object-contain bg-card", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
        colorClass,
        className,
      )}
    >
      {initials(provider?.name ?? "IA")}
    </div>
  );
}
