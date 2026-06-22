import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import {
  CalendarClock,
  Bell,
  FileText,
  ShieldCheck,
  User,
  Users,
  LogOut,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    to: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    search?: any,
  ) => {
    setOpen(false);
    navigate({ to, search });
  };

  const logout = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-lg overflow-hidden">
        <Command label="Acciones rápidas" className="bg-popover">
          <Command.Input
            placeholder="Escribe una acción…"
            className="w-full border-0 border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aún no hay nada por aquí
            </Command.Empty>
            <Command.Group heading="Acciones" className="text-xs text-muted-foreground px-2 py-1.5">
              <Item icon={<CalendarClock className="size-4" />} onSelect={() => go("/prevencionista/programaciones")}>
                Nueva programación
              </Item>
              <Item icon={<Users className="size-4" />} onSelect={() => go("/prevencionista/trabajadores")}>
                Nuevo trabajador
              </Item>
              <Item icon={<Bell className="size-4" />} onSelect={() => go("/prevencionista/trabajadores", { alerta: "baja_adherencia" as const })}>
                Ver alertas
              </Item>
              <Item icon={<ShieldCheck className="size-4" />} onSelect={() => go("/prevencionista/solicitudes-arco")}>
                Ver solicitudes ARCO
              </Item>
              <Item icon={<FileText className="size-4" />} onSelect={() => go("/prevencionista/reportes")}>
                Generar reporte
              </Item>
              <Item icon={<User className="size-4" />} onSelect={() => go("/perfil")}>
                Mi perfil
              </Item>
              <Item icon={<LogOut className="size-4" />} onSelect={logout}>
                Cerrar sesión
              </Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Item({
  children,
  icon,
  onSelect,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
    >
      {icon}
      {children}
    </Command.Item>
  );
}
