import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, BookOpenCheck, Eye, EyeOff, FileCheck2, ShieldCheck } from "lucide-react";
import { useLogin } from "@/hooks/queries";
import { loginSession } from "@/hooks/use-session";
import { BrandLoader } from "@/components/brand-loader";
import { getUserFacingError } from "@/lib/api";

const MINIMUM_LOADING_MS = 1000;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    const startedAt = Date.now();
    try {
      const auth = await login.mutateAsync({ email: email.trim(), password });
      await new Promise((resolve) =>
        window.setTimeout(resolve, Math.max(0, MINIMUM_LOADING_MS - (Date.now() - startedAt))),
      );
      loginSession(auth);
      navigate(`/app/${auth.user.role.toLowerCase()}`, { replace: true });
    } catch (error) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, Math.max(0, MINIMUM_LOADING_MS - (Date.now() - startedAt))),
      );
      setErrorMessage(getUserFacingError(error, "No se pudo iniciar sesión."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <aside className="login-story" aria-label="Información de ParametrIA">
          <div className="login-story-glow login-story-glow-one" />
          <div className="login-story-glow login-story-glow-two" />
          <Link to="/login" className="login-brand">
            <img src="/images/parametria-mark.svg" alt="" className="login-brand-mark" />
            <span>Parametr<span className="login-brand-accent">IA</span></span>
          </Link>
          <div className="login-story-content">
            <span className="login-kicker"><BookOpenCheck className="size-4" /> Plataforma académica</span>
            <h1>Gestiona tus evaluaciones.<br /><span>Consulta los resultados.</span></h1>
            <p className="login-story-copy">Organiza las aulas, define criterios de evaluación y revisa los reportes de tus estudiantes desde un mismo espacio.</p>
            <div className="login-feature-list">
              <div><span className="login-feature-icon"><BookOpenCheck /></span><span><strong>Configuración por aula</strong><small>Define instrucciones y rúbricas para cada curso.</small></span></div>
              <div><span className="login-feature-icon"><FileCheck2 /></span><span><strong>Seguimiento de entregas</strong><small>Consulta el estado de los documentos enviados.</small></span></div>
              <div><span className="login-feature-icon"><ShieldCheck /></span><span><strong>Acceso institucional</strong><small>Herramientas para docentes y estudiantes.</small></span></div>
            </div>
          </div>
        </aside>

        <div className="login-form-panel">
          <div className="login-form-wrap">
            <div className="login-mobile-brand">
              <img src="/images/parametria-mark.svg" alt="" className="size-12 rounded-2xl" />
              <span>Parametr<span>IA</span></span>
            </div>
            <div className="login-form-heading">
              <p className="login-form-eyebrow">Acceso institucional</p>
              <h2>Inicia sesión</h2>
              <p>Ingresa con las credenciales de tu cuenta institucional.</p>
            </div>
            <form id="login-form" name="login" method="post" autoComplete="on" className="login-form" onSubmit={submit}>
              <label className="field login-field">
                Correo electrónico
                <input
                  name="username"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@universidad.edu"
                />
              </label>
              <div className="field login-field">
                <div className="login-password-label">
                  <label htmlFor="login-password">Contraseña</label>
                  <Link to="/forgot-password">¿La olvidaste?</Link>
                </div>
                <span className="password-field">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Ingresa tu contraseña"
                  />
                  <button
                    type="button"
                    className="password-visibility"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                </span>
              </div>
              {errorMessage && <p role="alert" className="login-error"><AlertCircle aria-hidden="true" className="size-4 shrink-0" /><span>{errorMessage}</span></p>}
              <button className="action login-submit w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? <BrandLoader compact label="Validando credenciales…" /> : <>Entrar a mi cuenta <ArrowRight className="size-4" /></>}
              </button>
            </form>
            <div className="login-form-foot"><ShieldCheck className="size-4" /> Inicio de sesión seguro</div>
          </div>
          <footer className="login-copyright">
            <span>© {new Date().getFullYear()} ParametrIA · Evaluación académica</span>
            <span className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
              <Link to="/terms">Términos de uso</Link>
              <Link to="/privacy">Privacidad</Link>
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}
