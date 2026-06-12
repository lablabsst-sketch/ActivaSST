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
        .select("id, nombre, logo_url, plan_id, planes(nombre, max_trabajadores)")
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

        <EmpresaCard
          empresa={empresa}
          planNombre={planNombre}
          loading={empresaQuery.isLoading}
          canEdit={usuario.rol === "prevencionista" || usuario.rol === "empresa_admin"}
          onSaved={() => empresaQuery.refetch()}
        />


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

interface EmpresaCardProps {
  empresa: { id: string; nombre: string; logo_url: string | null } | null | undefined;
  planNombre: string | undefined;
  loading: boolean;
  canEdit: boolean;
  onSaved: () => void;
}

function EmpresaCard({ empresa, planNombre, loading, canEdit, onSaved }: EmpresaCardProps) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (empresa) {
      setNombre(empresa.nombre);
      setLogoUrl(empresa.logo_url ?? "");
    }
  }, [empresa]);

  const handleSave = async () => {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      await updateEmpresa({ data: { nombre: nombre.trim(), logo_url: logoUrl.trim() } });
      toast.success("Empresa actualizada");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error("No se pudo actualizar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">Empresa</CardTitle>
          {canEdit && !editing && (
            <CardDescription className="text-xs">
              Puedes editar nombre y logo.
            </CardDescription>
          )}
        </div>
        {canEdit && !editing && empresa && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label="Editar empresa"
            className="min-touch shrink-0"
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : !empresa ? (
          <p className="text-muted-foreground">Sin empresa asignada</p>
        ) : editing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="empresa-nombre">Nombre</Label>
              <Input
                id="empresa-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa-logo">URL del logo</Label>
              <Input
                id="empresa-logo"
                type="url"
                placeholder="https://…/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="min-h-11"
              />
              {logoUrl.trim() && (
                <div className="mt-1 flex items-center gap-2 rounded-md border p-2">
                  <img
                    src={logoUrl}
                    alt="Vista previa del logo"
                    className="size-12 rounded object-contain bg-muted"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = "0.3";
                    }}
                  />
                  <span className="text-xs text-muted-foreground truncate">Vista previa</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setNombre(empresa.nombre);
                  setLogoUrl(empresa.logo_url ?? "");
                }}
                disabled={saving}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {empresa.logo_url && (
              <img
                src={empresa.logo_url}
                alt={`Logo de ${empresa.nombre}`}
                className="size-16 rounded object-contain bg-muted"
              />
            )}
            <Row label="Nombre" value={empresa.nombre} />
            <Row label="Plan" value={planNombre ?? "—"} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

