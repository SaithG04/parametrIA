import { useState } from "react";
import { KeyRound, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderLogo } from "@/components/provider-logo";
import { useProviders } from "@/hooks/queries";

export function ByokModal({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { providerId: string; apiKey: string }) => void;
  submitting?: boolean;
}) {
  const { data: providerResult } = useProviders(1, 100, "", open);
  const providers = providerResult?.items ?? [];
  const [providerId, setProviderId] = useState<string>("");
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerId || apiKey.trim().length < 12) return;
    onConfirm({ providerId, apiKey: apiKey.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-accent/30 text-accent-foreground">
            <KeyRound className="size-5" />
          </div>
          <DialogTitle className="font-display text-2xl">Límite diario alcanzado</DialogTitle>
          <DialogDescription>
            Consumiste las evaluaciones permitidas por tu instructor por hoy. Puedes continuar de inmediato
            usando tu propia API key (Bring Your Own Key); solo se usará para esta sesión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="byok-provider">Proveedor de IA</Label>
            <Select value={providerId} onValueChange={setProviderId} required>
              <SelectTrigger id="byok-provider" className="w-full">
                <SelectValue placeholder="Selecciona un proveedor" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <ProviderLogo provider={p} className="size-5 rounded" />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="byok-key">API Key temporal</Label>
            <Input
              id="byok-key"
              type="password"
              placeholder="sk-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              minLength={12}
            />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 size-3 shrink-0" />
              Tu clave no se almacena: se usa únicamente para procesar esta evaluación.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !providerId || apiKey.trim().length < 12}>
              {submitting ? "Procesando…" : "Continuar con mi API key"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
