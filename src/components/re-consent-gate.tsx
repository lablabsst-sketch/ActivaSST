import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUsuario } from "@/hooks/use-session";
import {
  aceptarPoliticaVigente,
  getMiUltimoConsentimiento,
  getPoliticaVigente,
} from "@/lib/api/policy.functions";

export function ReConsentGate() {
  const { usuario } = useUsuario();
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();
  const aceptarFn = useServerFn(aceptarPoliticaVigente);
  const policyFn = useServerFn(getPoliticaVigente);
  const consentFn = useServerFn(getMiUltimoConsentimiento);

  const policyQ = useQuery({
    queryKey: ["politica-vigente"],
    queryFn: () => policyFn(),
    staleTime: 5 * 60_000,
  });
  const consentQ = useQuery({
    queryKey: ["mi-consentimiento", usuario?.id],
    enabled: !!usuario?.id,
    queryFn: () => consentFn(),
  });

  if (!usuario || !policyQ.data) return null;
  if (consentQ.isLoading) return null;

  const ultima = consentQ.data?.version_aviso ?? null;
  const vigente = policyQ.data.version;
  const necesita = ultima !== vigente;
  if (!necesita) return null;

  const handleAceptar = async () => {
    setSubmitting(true);
    try {
      await aceptarFn({ data: { version: vigente } });
      await qc.invalidateQueries({ queryKey: ["mi-consentimiento", usuario.id] });
      toast.success("Gracias por aceptar la política actualizada.");
    } catch (err) {
      toast.error("No se pudo registrar tu aceptación", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Política de tratamiento actualizada</DialogTitle>
          <DialogDescription>
            Hemos publicado la versión <b>{vigente}</b> de nuestra Política
            de Tratamiento de Datos Personales. Léela y acéptala para
            continuar usando Activa SST.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm">
          <Link
            to="/politica-tratamiento-datos"
            target="_blank"
            className="text-primary underline underline-offset-4"
          >
            Abrir política completa →
          </Link>
        </div>
        <DialogFooter>
          <Button onClick={handleAceptar} disabled={submitting} className="w-full">
            {submitting ? "Registrando…" : "He leído y acepto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
