import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, ExternalLink, ShieldCheck } from "lucide-react";
import { useAcceptLegal, useLegalDocuments, useLegalStatus } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { MarkdownPreview } from "@/components/markdown-preview";
import { BrandLoader } from "@/components/brand-loader";

const COOKIE_NOTICE_KEY = "parametria.cookie-notice.v1";

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(COOKIE_NOTICE_KEY) !== "dismissed");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(COOKIE_NOTICE_KEY, "dismissed");
    } catch {
      // The notice remains dismissible for the current page view.
    }
    setVisible(false);
  }

  if (!visible) return null;
  return <aside className="cookie-notice" aria-label="Aviso sobre cookies">
    <span className="cookie-notice-icon"><Cookie aria-hidden="true" className="size-5" /></span>
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-slate-800">Cookies necesarias</p>
      <p className="mt-1 text-sm leading-5 text-slate-600">Usamos una cookie técnica para mantener tu sesión. No usamos cookies de publicidad ni analítica.</p>
      <Link to="/privacy" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[var(--institution-primary)] underline underline-offset-2">Leer política de privacidad <ExternalLink aria-hidden="true" className="size-3.5" /></Link>
    </div>
    <Button type="button" size="sm" onClick={dismiss}>Entendido</Button>
  </aside>;
}

export function LegalDocumentPage({ document }: { document: "terms" | "privacy" }) {
  const documents = useLegalDocuments();
  const content = documents.data?.[document];

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <Link to="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft aria-hidden="true" className="size-4" />Volver al acceso</Link>
      <section className="surface p-5 sm:p-8">
        <p className="eyebrow">ParametrIA · Perú</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{content?.title ?? (document === "terms" ? "Términos de uso" : "Política de privacidad")}</h1>
        {documents.isLoading ? <div className="py-8"><BrandLoader label="Cargando documento…" /></div>
          : documents.isError || !content ? <p role="alert" className="mt-5 text-sm text-rose-700">No se pudo cargar el documento. Recarga la página para volver a intentarlo.</p>
            : <div className="mt-5"><MarkdownPreview source={content.content} /></div>}
      </section>
    </div>
  </main>;
}

export function LegalAcceptanceGate({ userId, children }: { userId: string; children: ReactNode }) {
  const status = useLegalStatus(userId);
  const documents = useLegalDocuments();
  const accept = useAcceptLegal(userId);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [error, setError] = useState("");

  if (status.isLoading || documents.isLoading) {
    return <div className="grid min-h-[50vh] place-items-center"><BrandLoader label="Verificando condiciones vigentes…" /></div>;
  }
  if (status.isError || documents.isError || !status.data || !documents.data) {
    return <section className="surface mx-auto max-w-2xl p-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">No se pudieron verificar las condiciones</h1>
      <p className="mt-2 text-sm text-slate-600">Inténtalo de nuevo para continuar. No se ha registrado ninguna aceptación.</p>
      <Button className="mt-5" onClick={() => { void status.refetch(); void documents.refetch(); }}>Reintentar</Button>
    </section>;
  }

  const needsAcceptance = !status.data.terms.accepted || !status.data.privacy.accepted;
  if (!needsAcceptance) return children;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!termsChecked || !privacyChecked) {
      setError("Marca ambas casillas después de revisar los documentos.");
      return;
    }
    accept.mutate(undefined, { onError: () => setError("No se pudo guardar la aceptación. Revisa tu conexión e inténtalo otra vez.") });
  }

  return <section className="surface mx-auto max-w-3xl p-5 sm:p-8">
    <span className="brand-soft mb-4 grid size-11 place-items-center rounded-xl"><ShieldCheck aria-hidden="true" className="size-5" /></span>
    <p className="eyebrow">Antes de continuar</p>
    <h1 className="mt-1 text-2xl font-bold text-slate-900">Revisa las condiciones del servicio</h1>
    <p className="mt-2 text-sm leading-6 text-slate-600">Actualizamos la información sobre el uso de ParametrIA, el envío de trabajos a proveedores de IA y la conservación de documentos. Necesitamos tu aceptación para habilitar la cuenta.</p>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <Link to="/terms" target="_blank" rel="noreferrer" className="legal-document-card">
        <span><strong>Términos de uso</strong><small>Versión {documents.data.terms.version}</small></span><ExternalLink aria-hidden="true" className="size-4" />
      </Link>
      <Link to="/privacy" target="_blank" rel="noreferrer" className="legal-document-card">
        <span><strong>Política de privacidad</strong><small>Versión {documents.data.privacy.version}</small></span><ExternalLink aria-hidden="true" className="size-4" />
      </Link>
    </div>

    <form className="mt-5 grid gap-3" onSubmit={submit}>
      <div className="legal-checkbox">
        <input id="accept-terms" type="checkbox" checked={termsChecked} onChange={(event) => setTermsChecked(event.target.checked)} />
        <div><label htmlFor="accept-terms">He leído y acepto los Términos de uso.</label><Link to="/terms" target="_blank" rel="noreferrer">Leer documento</Link></div>
      </div>
      <div className="legal-checkbox">
        <input id="accept-privacy" type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} />
        <div><label htmlFor="accept-privacy">He leído y acepto el tratamiento descrito en la Política de privacidad.</label><Link to="/privacy" target="_blank" rel="noreferrer">Leer documento</Link></div>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">La aceptación se registra en tu cuenta con la versión y la fecha.</p>
        <Button type="submit" disabled={!termsChecked || !privacyChecked || accept.isPending}>{accept.isPending ? "Guardando…" : "Aceptar y continuar"}</Button>
      </div>
    </form>
  </section>;
}
