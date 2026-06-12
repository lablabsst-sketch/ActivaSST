import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, CalendarClock, Home, LogIn, ShieldCheck, Stethoscope, Sparkles, User, Users } from "lucide-react";
import { ServiceWorkerBadge } from "./sw-badge";
import { PwaInstallButton } from "./pwa-install-button";
import { useUsuario } from "@/hooks/use-session";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
}

type NavItem = {
  to:
    | "/"
    | "/prevencionista"
    | "/prevencionista/trabajadores"
    | "/prevencionista/programaciones"
    | "/prevencionista/pausas"
    | "/trabajador"
    | "/login"
    | "/diagnostico"
    | "/perfil";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const prevencionistaNav: NavItem[] = [
  { to: "/prevencionista", label: "Inicio", icon: Home, exact: true },
  { to: "/prevencionista/trabajadores", label: "Trabaj.", icon: Users },
  { to: "/prevencionista/programaciones", label: "Programas", icon: CalendarClock },
  { to: "/prevencionista/pausas", label: "Pausas", icon: Sparkles },
];

const trabajadorNav: NavItem[] = [
  { to: "/trabajador", label: "Inicio", icon: Home, exact: true },
];

const guestNav: NavItem[] = [
  { to: "/", label: "Inicio", icon: Home, exact: true },
  { to: "/login", label: "Entrar", icon: LogIn },
];

const devNav: NavItem[] = [
  { to: "/trabajador", label: "Trabajador", icon: User },
  { to: "/prevencionista", label: "Prevencionista", icon: ShieldCheck, exact: true },
  { to: "/diagnostico", label: "Diag", icon: Stethoscope },
];

export function AppShell({ children }: AppShellProps) {
  const { usuario, loading } = useUsuario();

  let items: NavItem[];
  if (loading) {
    items = [];
  } else if (usuario?.rol === "prevencionista" || usuario?.rol === "empresa_admin") {
    items = prevencionistaNav;
  } else if (usuario?.rol === "trabajador") {
    items = trabajadorNav;
  } else {
    items = guestNav;
  }

  const showProfile = !loading && !!usuario;
  const isDev = import.meta.env.DEV;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-4">
            <Activity className="size-6 text-primary" aria-hidden />
            <Link to="/" className="font-semibold tracking-tight">
              Activa <span className="text-primary">SST</span>
            </Link>
            <div className="ml-auto">
              <ServiceWorkerBadge />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">{children}</main>
        <nav
          aria-label="Navegación principal"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"
        >
          {loading ? (
            <ul className="mx-auto grid w-full max-w-md grid-cols-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex flex-col items-center gap-1 py-2">
                  <Skeleton className="size-5 rounded" />
                  <Skeleton className="h-3 w-10" />
                </li>
              ))}
            </ul>
          ) : (
          <ul
            className={cn(
              "mx-auto grid w-full max-w-md",
              `grid-cols-${items.length + (showProfile ? 1 : 0) + (isDev ? devNav.length : 0)}`,
            )}
            style={{
              gridTemplateColumns: `repeat(${items.length + (showProfile ? 1 : 0) + (isDev ? devNav.length : 0)}, minmax(0, 1fr))`,
            }}
          >
            {items.map(({ to, label, icon: Icon, exact }) => (
              <li key={to}>
                <Link
                  to={to}
                  activeOptions={{ exact: exact ?? false }}
                  className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground data-[status=active]:text-primary"
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
            {showProfile && (
              <li>
                <Link
                  to="/perfil"
                  activeOptions={{ exact: false }}
                  className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground data-[status=active]:text-primary"
                >
                  <User className="size-5" aria-hidden />
                  Perfil
                </Link>
              </li>
            )}
            {isDev &&
              devNav.map(({ to, label, icon: Icon, exact }) => (
                <li key={`dev-${to}`}>
                  <Link
                    to={to}
                    activeOptions={{ exact: exact ?? false }}
                    className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground/70 data-[status=active]:text-primary"
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
          </ul>
          )}
        </nav>
      </div>
    </TooltipProvider>
  );
}
