import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ConfirmationOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

const ConfirmationContext = createContext<{ confirm: (options: ConfirmationOptions) => Promise<boolean> } | null>(null);

interface ConfirmationRequest {
  options: ConfirmationOptions;
  resolve: (accepted: boolean) => void;
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [activeRequest, setActiveRequest] = useState<ConfirmationRequest | null>(null);
  const activeRequestRef = useRef<ConfirmationRequest | null>(null);
  const queuedRequests = useRef<ConfirmationRequest[]>([]);

  function confirm(options: ConfirmationOptions) {
    return new Promise<boolean>((resolve) => {
      const request = { options, resolve };
      if (activeRequestRef.current) {
        queuedRequests.current.push(request);
        return;
      }
      activeRequestRef.current = request;
      setActiveRequest(request);
    });
  }

  function finish(accepted: boolean) {
    activeRequestRef.current?.resolve(accepted);
    const nextRequest = queuedRequests.current.shift() ?? null;
    activeRequestRef.current = nextRequest;
    setActiveRequest(nextRequest);
  }

  const options = activeRequest?.options;
  const destructive = options?.destructive ?? false;
  return <ConfirmationContext.Provider value={{ confirm }}>
    {children}
    <Dialog open={Boolean(activeRequest)} onOpenChange={(open) => { if (!open) finish(false); }}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl bg-white p-5 sm:p-6">
        <DialogHeader>
          <span className={`mb-1 grid size-11 place-items-center rounded-xl ${destructive ? "bg-rose-50 text-rose-700" : "brand-soft"}`}>
            {destructive ? <AlertTriangle aria-hidden="true" className="size-5" /> : <CircleHelp aria-hidden="true" className="size-5" />}
          </span>
          <DialogTitle>{options?.title}</DialogTitle>
          <DialogDescription>{options?.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => finish(false)}>Cancelar</Button>
          <Button
            type="button"
            className={destructive ? "bg-rose-700 text-white hover:bg-rose-800" : ""}
            onClick={() => finish(true)}
          >
            {options?.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </ConfirmationContext.Provider>;
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error("useConfirmation debe usarse dentro de ConfirmationProvider.");
  return context;
}
