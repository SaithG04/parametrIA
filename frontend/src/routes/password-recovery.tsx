import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BrandLoader } from "@/components/brand-loader";
import { useRequestPasswordReset, useResetPassword } from "@/hooks/queries";
import { getUserFacingError } from "@/lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const request = useRequestPasswordReset();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.mutate(email.trim(), { onSuccess: () => setSubmitted(true) });
  }

  return (
    <RecoveryFrame title="Recupera tu acceso" description="Te enviaremos un enlace de un solo uso si el correo está registrado.">
      {submitted ? (
        <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          Si existe una cuenta con ese correo, recibirás instrucciones para configurar una nueva contraseña. Revisa también la carpeta de spam.
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <label className="field">
            Correo electrónico
            <input
              type="email"
              name="username"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@universidad.edu"
            />
          </label>
          <button className="action w-full" disabled={request.isPending}>
            {request.isPending ? <BrandLoader compact label="Enviando enlace…" /> : "Enviar enlace"}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="font-semibold text-cyan-800 hover:underline">Volver a iniciar sesión</Link>
      </p>
    </RecoveryFrame>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reset = useResetPassword();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [completed, setCompleted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    if (password !== confirmation) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }
    reset.mutate({ token, password }, {
      onSuccess: () => setCompleted(true),
      onError: (error) => setErrorMessage(getUserFacingError(error, "El enlace no es válido o expiró.")),
    });
  }

  return (
    <RecoveryFrame title="Configura tu contraseña" description="Elige una contraseña segura de al menos 12 caracteres.">
      {completed ? (
        <div className="space-y-4 text-center">
          <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            Contraseña actualizada. Ya puedes iniciar sesión.
          </p>
          <button className="action w-full" onClick={() => navigate("/login", { replace: true })}>Ir a iniciar sesión</button>
        </div>
      ) : !token ? (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          Este enlace no contiene un token válido. Solicita uno nuevo desde la pantalla de acceso.
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <label className="field">
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            Confirma la contraseña
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {errorMessage && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}
          <button className="action w-full" disabled={reset.isPending}>
            {reset.isPending ? <BrandLoader compact label="Actualizando…" /> : "Guardar contraseña"}
          </button>
        </form>
      )}
    </RecoveryFrame>
  );
}

function RecoveryFrame({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="surface page-enter w-full max-w-md p-6 sm:p-10">
        <div className="mb-7 text-center">
          <img src="/images/parametria-mark.svg" alt="" className="mx-auto mb-4 size-16 rounded-2xl" />
          <p className="eyebrow">Seguridad de la cuenta</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
