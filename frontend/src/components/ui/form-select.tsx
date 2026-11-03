import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FormSelect({
  value,
  placeholder,
  options,
  onValueChange,
  required,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return <Select value={value || undefined} onValueChange={onValueChange} required={required}>
    <SelectTrigger className={cn(className)} aria-label={ariaLabel}><SelectValue placeholder={placeholder ?? "Selecciona una opción"} /></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}
