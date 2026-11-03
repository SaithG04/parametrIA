import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import "./app-update-notification.css";

export function hasNewAppAssets(currentDocument: Document, latestHtml: string, baseUrl: string) {
  const latestDocument = new DOMParser().parseFromString(latestHtml, "text/html");
  const assetReferences = (documentToRead: Document) => Array.from(
    documentToRead.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
      'script[type="module"][src], link[rel="stylesheet"][href]',
    ),
    (element) => {
      const reference = element instanceof HTMLScriptElement
        ? element.getAttribute("src")
        : element.getAttribute("href");
      return reference ? new URL(reference, baseUrl).href : "";
    },
  ).filter(Boolean).sort();

  const currentAssets = assetReferences(currentDocument);
  const latestAssets = assetReferences(latestDocument);
  return currentAssets.length > 0 &&
    latestAssets.length > 0 &&
    currentAssets.join("\n") !== latestAssets.join("\n");
}

export function AppUpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    let active = true;
    let checking = false;
    let detected = false;
    const checkForUpdate = async () => {
      if (!active || detected || checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const indexUrl = new URL(`${import.meta.env.BASE_URL}index.html`, window.location.origin);
        indexUrl.searchParams.set("_version_check", Date.now().toString());
        const response = await fetch(indexUrl, {
          cache: "no-store",
          headers: { Accept: "text/html" },
        });
        if (!response.ok) throw new Error(`Version check returned HTTP ${response.status}.`);
        const latestHtml = await response.text();
        if (active && hasNewAppAssets(document, latestHtml, indexUrl.href)) {
          detected = true;
          setUpdateAvailable(true);
        }
      } catch (error) {
        if (active) console.warn("No se pudo comprobar si hay una nueva versión de ParametrIA.", error);
      } finally {
        checking = false;
      }
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };

    checkWhenVisible();
    const intervalId = window.setInterval(checkWhenVisible, 60_000);
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  if (!updateAvailable) return null;
  return <aside className="app-update-notice" role="status" aria-live="polite">
    <span>Hay una nueva versión de ParametrIA. Recarga la página para aplicar los cambios.</span>
    <button type="button" onClick={() => window.location.reload()}>
      <RefreshCw aria-hidden="true" className="size-4" />Recargar
    </button>
  </aside>;
}
