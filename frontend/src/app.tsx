import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BookOpenCheck, Code2, ExternalLink, FileCheck2, FileSearch, KeyRound, LayoutDashboard, LogOut, PanelsTopLeft, Settings2, Shield, Upload, Users } from "lucide-react";
import { authApi } from "@/services/endpoints";
import { BrandLoader } from "@/components/brand-loader";
import { StudentEvaluationNotifications } from "@/components/student-evaluation-notifications";
import { AppUpdateNotification } from "@/components/app-update-notification";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { useSession, loginSession, logoutSession } from "@/hooks/use-session";
import { ClassroomAiConfigPage } from "@/routes/classroom-ai-config";
import { InstructorDashboard } from "@/routes/instructor-dashboard";
import { InstructorOverviewPage } from "@/routes/instructor-overview";
import { StudentDashboard } from "@/routes/student-dashboard";
import { StudentEvaluationPage } from "@/routes/student-evaluation";
import { SuperadminDashboard } from "@/routes/superadmin-dashboard";
import { LoginPage } from "@/routes/login";
import { ForgotPasswordPage, ResetPasswordPage } from "@/routes/password-recovery";
import { StudentReportsPage } from "@/routes/student-reports";
import { InstructorReportsPage } from "@/routes/instructor-reports";
import { EvaluationReportDetailPage } from "@/routes/evaluation-report-detail";
import { CookieNotice, LegalAcceptanceGate, LegalDocumentPage } from "@/routes/legal-pages";
import type { Role } from "@/services/types";

function SessionBootstrap({ children }: { children: ReactNode }) {
  const session = useSession();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!session.hydrated) return;
    if (session.user) {
      setRestored(true);
      return;
    }
    let active = true;
    const loadingStartedAt = Date.now();
    void (async () => {
      try {
        const auth = await authApi.refresh();
        if (active) loginSession(auth);
      } catch {
        if (active) logoutSession();
      } finally {
        const remainingTime = Math.max(0, 1000 - (Date.now() - loadingStartedAt));
        if (remainingTime) await new Promise((resolve) => window.setTimeout(resolve, remainingTime));
        if (active) setRestored(true);
      }
    })();
    return () => { active = false; };
  }, [session.hydrated, session.user]);

  if (!session.hydrated || !restored) return <div className="grid min-h-screen place-items-center"><BrandLoader label="Restaurando tu sesión…" /></div>;
  return children;
}

function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useSession();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={`/app/${user.role.toLowerCase()}`} replace />;
  return <Outlet />;
}

function AppLayout() {
  const { user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm } = useConfirmation();
  const activeRole = user?.role.toLowerCase() ?? "";
  const [loggingOut, setLoggingOut] = useState(false);
  const institutionStyle = {
    "--institution-primary": user?.universityPrimaryColor ?? "#15566d",
    "--institution-accent": user?.universityAccentColor ?? "#08768b",
  } as CSSProperties;

  useEffect(() => {
    const root = document.documentElement;
    const previousPrimary = root.style.getPropertyValue("--institution-primary");
    const previousAccent = root.style.getPropertyValue("--institution-accent");
    root.style.setProperty("--institution-primary", user?.universityPrimaryColor ?? "#15566d");
    root.style.setProperty("--institution-accent", user?.universityAccentColor ?? "#08768b");
    return () => {
      if (previousPrimary) root.style.setProperty("--institution-primary", previousPrimary);
      else root.style.removeProperty("--institution-primary");
      if (previousAccent) root.style.setProperty("--institution-accent", previousAccent);
      else root.style.removeProperty("--institution-accent");
    };
  }, [user?.universityPrimaryColor, user?.universityAccentColor]);

  async function logout() {
    const accepted = await confirm({
      title: "¿Deseas cerrar sesión?",
      description: "Se cerrará tu sesión de ParametrIA en este dispositivo.",
      confirmLabel: "Cerrar sesión",
    });
    if (!accepted) return;
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // The local session must still end if the server is unreachable.
    } finally {
      logoutSession();
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  }

  return <div className="app-theme flex min-h-screen flex-col" style={institutionStyle}>
    <header className="app-header">
      <Link to={`/app/${activeRole}`} className="flex min-w-0 items-center gap-3">
        <img src="/images/parametria-mark.svg" alt="" className="size-10 rounded-xl" />
        <span><span className="block font-display text-lg font-bold">ParametrIA</span><span className="block text-xs text-slate-500">Evaluación académica</span></span>
      </Link>
      <div className="app-header-side">
        {user?.universityName && <div className="app-institution">
          {user.universityLogoUrl && <img src={user.universityLogoUrl} alt="" className="size-8 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1" />}
          <span className="min-w-0"><span className="block text-[.62rem] font-bold uppercase tracking-[.12em] text-slate-400">Institución</span><span className="block max-w-40 truncate text-xs font-semibold text-slate-700">{user.universityName}</span></span>
        </div>}
        {user?.role === "STUDENT" && <StudentEvaluationNotifications />}
        <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Navegación principal">
          {user?.role === "SUPERADMIN" && <Link className={`nav-link ${location.pathname.includes("superadmin") ? "active" : ""}`} to="/app/superadmin"><Shield className="size-4" />Administración</Link>}
          {user?.role === "INSTRUCTOR" && <>
            <Link className={`nav-link ${location.pathname === "/app/instructor" ? "active" : ""}`} to="/app/instructor"><LayoutDashboard className="size-4" />Resumen</Link>
            <Link className={`nav-link ${location.pathname.endsWith("/courses") ? "active" : ""}`} to="/app/instructor/courses"><BookOpenCheck className="size-4" />Cursos</Link>
            <Link className={`nav-link ${location.pathname.endsWith("/classrooms") ? "active" : ""}`} to="/app/instructor/classrooms"><PanelsTopLeft className="size-4" />Aulas</Link>
            <Link className={`nav-link ${location.pathname.endsWith("/students") ? "active" : ""}`} to="/app/instructor/students"><Users className="size-4" />Estudiantes</Link>
            <Link className={`nav-link ${location.pathname.includes("/reports") ? "active" : ""}`} to="/app/instructor/reports"><FileSearch className="size-4" />Reportes</Link>
            <Link className={`nav-link ${location.pathname.endsWith("/credentials") ? "active" : ""}`} to="/app/instructor/credentials"><KeyRound className="size-4" />Credenciales</Link>
          </>}
          {user?.role === "STUDENT" && <>
            <Link className={`nav-link ${location.pathname === "/app/student" ? "active" : ""}`} to="/app/student"><LayoutDashboard className="size-4" />Resumen</Link>
            <Link className={`nav-link ${location.pathname === "/app/student/evaluation" ? "active" : ""}`} to="/app/student/evaluation"><Upload className="size-4" />Subir documento</Link>
            <Link className={`nav-link ${location.pathname.startsWith("/app/student/reports") ? "active" : ""}`} to="/app/student/reports"><FileCheck2 className="size-4" />Mis reportes</Link>
          </>}
          {location.pathname.includes("ai-config") && <span className="nav-link"><Settings2 className="size-4" />Configuración del aula</span>}
          <Button variant="secondary" size="sm" onClick={() => void logout()} disabled={loggingOut}><LogOut className="size-4" />{loggingOut ? "Cerrando…" : "Salir"}</Button>
        </nav>
      </div>
    </header>
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-7 sm:px-6 lg:px-8">
      <LegalAcceptanceGate userId={user?.id ?? ""}><Outlet /></LegalAcceptanceGate>
    </main>
    <footer className="app-footer">
      <span className="app-footer-mark" aria-hidden="true"><Code2 className="size-4" /></span>
      <span className="app-footer-credit">
        <span>Desarrollado por</span>
        <a href="https://saithg04.work/" target="_blank" rel="noreferrer">
          <span>saithg04</span><ExternalLink aria-hidden="true" className="size-3" />
        </a>
      </span>
    </footer>
  </div>;
}

function RouterView() {
  return <BrowserRouter>
    <>
      <SessionBootstrap>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/terms" element={<LegalDocumentPage document="terms" />} />
        <Route path="/privacy" element={<LegalDocumentPage document="privacy" />} />
        <Route element={<RequireRole roles={["SUPERADMIN", "INSTRUCTOR", "STUDENT"]} />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/login" replace />} />
            <Route element={<RequireRole roles={["SUPERADMIN"]} />}><Route path="superadmin" element={<SuperadminDashboard />} /></Route>
            <Route element={<RequireRole roles={["INSTRUCTOR"]} />}>
              <Route path="instructor" element={<InstructorOverviewPage />} />
              <Route path="instructor/courses" element={<InstructorDashboard />} />
              <Route path="instructor/classrooms" element={<InstructorDashboard />} />
              <Route path="instructor/students" element={<InstructorDashboard />} />
              <Route path="instructor/credentials" element={<InstructorDashboard />} />
              <Route path="instructor/reports" element={<InstructorReportsPage />} />
              <Route path="instructor/reports/:evaluationId" element={<EvaluationReportDetailPage />} />
              <Route path="instructor/classrooms/:classroomId/ai-config" element={<ClassroomAiConfigPage />} />
            </Route>
            <Route element={<RequireRole roles={["STUDENT"]} />}>
              <Route path="student" element={<StudentDashboard />} />
              <Route path="student/evaluation" element={<StudentEvaluationPage />} />
              <Route path="student/reports" element={<StudentReportsPage />} />
              <Route path="student/reports/:evaluationId" element={<EvaluationReportDetailPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </SessionBootstrap>
      <AppUpdateNotification />
      <CookieNotice />
    </>
  </BrowserRouter>;
}

export function App() {
  return <RouterView />;
}
