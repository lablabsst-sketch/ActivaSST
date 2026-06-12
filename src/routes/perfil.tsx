import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import { updateEmpresa } from "@/lib/api/empresa.functions";


export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Mi perfil — Activa SST" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const navigate = useNavigate();
  const { session, usuario, loading } = useUsuario();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  const empresaQuery = useQuery({
    queryKey: ["perfil-empresa", usuario?.empresa_id],
    enabled: !!usuario?.empresa_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nombre, plan_id, planes(nombre, max_trabajadores)")
        .eq("id", usuario!.empresa_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tiposQuery = useQuery({
    queryKey: ["perfil-tipos", usuario?.id],
    enabled: !!usuario?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuario_tipos_trabajo")
        .select("tipo_id, tipos_trabajo(nombre)")
        .eq("usuario_id", usuario!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const consentQuery = useQuery({
    queryKey: ["perfil-consent", usuario?.id],
    enabled: !!usuario?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consentimientos")
        .select("version_aviso, aceptado_at")
        .eq("usuario_id", usuario!.id)
        .order("aceptado_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      toast.error("No se pudo cerrar sesión", { description: message });
      setSigningOut(false);
    }
  };

  if (loading || !usuario) {
    return (
      <AppShell>
        <p className="pt-8 text-center text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  const empresa = empresaQuery.data;
  const planNombre = (empresa?.planes as { nombre?: string } | null)?.nombre;
  const tipos = (tiposQuery.data ?? [])
    .map((r) => (r.tipos_trabajo as { nombre?: string } | null)?.nombre)
    .filter(Boolean) as string[];

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-2">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mi cuenta</p>
          <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos personales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Nombre" value={usuario.nombre || "—"} />
            <Row label="Correo" value={usuario.email} />
            <Row label="Cédula" value={usuario.documento || "—"} />
            <Row label="Rol" value={usuario.rol} />
            <Row label="Estado" value={usuario.estado} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {empresaQuery.isLoading ? (
              <p className="text-muted-foreground">Cargando…</p>
            ) : empresa ? (
              <>
                <Row label="Nombre" value={empresa.nombre} />
                <Row label="Plan" value={planNombre ?? "—"} />
              </>
            ) : (
              <p className="text-muted-foreground">Sin empresa asignada</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipos de trabajo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {tiposQuery.isLoading ? (
              <p className="text-muted-foreground">Cargando…</p>
            ) : tipos.length ? (
              <ul className="list-disc pl-5 space-y-1">
                {tipos.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Sin tipos asignados</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tratamiento de datos</CardTitle>
            <CardDescription className="text-xs">Ley 1581 de 2012 (Habeas Data)</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {consentQuery.isLoading ? (
              <p className="text-muted-foreground">Cargando…</p>
            ) : consentQuery.data ? (
              <div className="space-y-1">
                <Row label="Versión" value={consentQuery.data.version_aviso} />
                <Row
                  label="Aceptado"
                  value={new Date(consentQuery.data.aceptado_at).toLocaleString()}
                />
              </div>
            ) : (
              <p className="text-muted-foreground">
                No hay consentimiento registrado todavía.
              </p>
            )}
          </CardContent>
        </Card>

        <Separator />

        <Button
          variant="destructive"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full"
        >
          {signingOut ? "Cerrando…" : "Cerrar sesión"}
        </Button>
      </section>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}
