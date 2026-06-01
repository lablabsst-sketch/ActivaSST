import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, Home, LogIn, ShieldCheck, User } from "lucide-react";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/trabajador", label: "Trabajador", icon: User },
  { to: "/prevencionista", label: "Prevencionista", icon: ShieldCheck },
  { to: "/login", label: "Entrar", icon: LogIn },
] as const;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-4">
          <Activity className="size-6 text-primary" aria-hidden />
          <Link to="/" className="font-semibold tracking-tight">
            Activa <span className="text-primary">SST</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">{children}</main>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"
      >
        <ul className="mx-auto grid w-full max-w-md grid-cols-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground data-[status=active]:text-primary"
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
