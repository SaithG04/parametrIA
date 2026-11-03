import { useEffect, useState, type FormEvent } from "react";
import { useSaveUniversity, useSaveUser, useUploadUniversityLogo } from "@/hooks/queries";
import type { Role, University, UserRecord } from "@/services/types";
import { getUserFacingError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoSourcePicker } from "@/components/logo-source-picker";

export function UniversityDialog({
  university,
  open,
  onOpenChange,
}: {
  university?: University;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveUniversity(university?.id);
  const uploadLogo = useUploadUniversityLogo();
  const [name, setName] = useState(university?.name ?? "");
  const [domain, setDomain] = useState(university?.domain ?? "");
  const [logoUrl, setLogoUrl] = useState(university?.logoUrl?.startsWith("/") ? "" : university?.logoUrl ?? "");
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState(university?.logoUrl?.startsWith("/") ? university.logoUrl : "");
  const [logoSource, setLogoSource] = useState<"url" | "upload">(university?.logoUrl?.startsWith("/") ? "upload" : "url");
  const [primaryColor, setPrimaryColor] = useState(university?.primaryColor ?? "#20466a");
  const [accentColor, setAccentColor] = useState(university?.accentColor ?? "#f9a21d");
  const [uploadError, setUploadError] = useState("");
  const [logoUrlError, setLogoUrlError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(university?.name ?? "");
    setDomain(university?.domain ?? "");
    const storedLogo = university?.logoUrl ?? "";
    const isUploadedLogo = storedLogo.startsWith("/");
    setLogoUrl(isUploadedLogo ? "" : storedLogo);
    setUploadedLogoUrl(isUploadedLogo ? storedLogo : "");
    setLogoSource(isUploadedLogo ? "upload" : "url");
    setPrimaryColor(university?.primaryColor ?? "#20466a");
    setAccentColor(university?.accentColor ?? "#f9a21d");
    setUploadError("");
    setLogoUrlError("");
  }, [open, university]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    try {
      const result = await uploadLogo.mutateAsync(file);
      setUploadedLogoUrl(result.logoUrl);
      setLogoSource("upload");
    } catch (error) {
      setUploadError(getUserFacingError(error, "No se pudo subir el logo institucional."));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedLogoUrl = logoUrl.trim();
    let isHttpUrl = false;
    if (logoSource === "url" && trimmedLogoUrl) {
      try {
        const parsedUrl = new URL(trimmedLogoUrl);
        isHttpUrl = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
      } catch {
        isHttpUrl = false;
      }
    }
    if (logoSource === "url" && trimmedLogoUrl && !isHttpUrl) {
      setLogoUrlError("Ingresa una URL http(s) válida para la imagen de Internet.");
      return;
    }
    if (logoSource === "upload" && !uploadedLogoUrl) {
      setUploadError("Sube una imagen antes de seleccionarla.");
      return;
    }
    setLogoUrlError("");
    save.mutate({
      name: name.trim(),
      domain: domain.trim(),
      logoUrl: logoSource === "upload" ? uploadedLogoUrl : trimmedLogoUrl,
      primaryColor,
      accentColor,
    }, { onSuccess: () => onOpenChange(false) });
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>{university ? "Editar universidad" : "Agregar universidad"}</DialogTitle><DialogDescription>Registra el nombre institucional y, opcionalmente, su dominio de correo.</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={submit}>
        <Label className="grid gap-1.5">Nombre<Input required value={name} onChange={(event) => setName(event.target.value)} /></Label>
        <Label className="grid gap-1.5">Dominio de correo<Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="universidad.edu" /></Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <LogoSourcePicker
              idPrefix="university-logo"
              url={logoUrl}
              uploadedUrl={uploadedLogoUrl}
              source={logoSource}
              onUrlChange={(value) => { setLogoUrl(value); setLogoUrlError(""); }}
              onSourceChange={setLogoSource}
              onUpload={(file) => void upload(file)}
              isUploading={uploadLogo.isPending}
              uploadError={uploadError}
              urlError={logoUrlError}
            />
          </div>
          <Label className="grid gap-1.5">Color principal<Input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} /></Label>
          <Label className="grid gap-1.5">Color de acento<Input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></Label>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={save.isPending || uploadLogo.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}

export function UserDialog({
  user,
  universities,
  open,
  onOpenChange,
}: {
  user?: UserRecord;
  universities: University[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveUser(user?.id);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "STUDENT");
  const [universityId, setUniversityId] = useState(user?.universityId ?? "");

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setRole(user?.role ?? "STUDENT");
    setUniversityId(user?.universityId ?? "");
  }, [open, user]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({
      name: name.trim(),
      email: email.trim(),
      role,
      universityId: role === "SUPERADMIN" ? null : universityId || null,
    }, { onSuccess: () => onOpenChange(false) });
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>{user ? "Editar usuario" : "Agregar usuario"}</DialogTitle><DialogDescription>Completa los datos de acceso y asigna su institución.</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={submit}>
        <Label className="grid gap-1.5">Nombre completo<Input required value={name} onChange={(event) => setName(event.target.value)} /></Label>
        <Label className="grid gap-1.5">Correo electrónico<Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Label>
        <div className="grid gap-1.5"><Label>Rol</Label><Select value={role} onValueChange={(value) => {
          if (value === "SUPERADMIN" || value === "INSTRUCTOR" || value === "STUDENT") {
            setRole(value);
            if (value === "SUPERADMIN") setUniversityId("");
          }
        }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SUPERADMIN">Superadministrador</SelectItem><SelectItem value="INSTRUCTOR">Docente</SelectItem><SelectItem value="STUDENT">Estudiante</SelectItem></SelectContent></Select></div>
        {role !== "SUPERADMIN" && <div className="grid gap-1.5"><Label>Universidad</Label><Select value={universityId || "__none__"} onValueChange={(value) => setUniversityId(value === "__none__" ? "" : value)}><SelectTrigger><SelectValue placeholder="Selecciona universidad" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin asignar</SelectItem>{universities.map((institution) => <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>)}</SelectContent></Select></div>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
