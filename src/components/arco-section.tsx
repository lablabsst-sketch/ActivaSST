import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileEdit, Trash2, Ban, ShieldX } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  crearSolicitudArco,
  exportarMisDatos,
  listarMisSolicitudesArco,
} from "@/lib/api/arco.functions";

type Tipo = "rectificacion" | "cancelacion" | "oposicion" | "revocacion";

const TIPO_LABEL: Record<string, string> = {
  acceso: "Acceso",
  rectificacion: "Rectificación",
  cancelacion: "Eliminar cuenta",
  oposicion: "Oposición",
  revocacion: "Revocar consentimiento",
};

export function ArcoSection() {
  const qc = useQueryClient();
  const exportFn = useServerFn(exportarMisDatos);
  const listFn = useServerFn(listarMisSolicitudesArco);
  const crearFn = useServerFn(crearSolicitudArco);

  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const list = useQuery({
    queryKey: ["arco-mis"],
    queryFn: () => listFn(),
  });

  const exportM = useMutation({
    mutationFn: () => exportFn(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-activa-sst-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Datos descargados");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const crearM = useMutation({
    mutationFn: (v: { tipo: Tipo; descripcion: string }) =>
      crearFn({ data: v }),
    onSuccess: () => {
      toast.success("Solicitud enviada. El responsable tiene 10 días hábiles para responder.");
      qc.invalidateQueries({ queryKey: ["arco-mis"] });
      setTipo(null);
      setDescripcion("");
      setConfirmCancel(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const openTipo = (t: Tipo) => {
    setTipo(t);
    setDescripcion("");
    setConfirmCancel(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mis derechos (Habeas Data)</CardTitle>
        <CardDescription className="text-xs">
          Ley 1581/2012. Tienes derecho a acceder, rectificar, cancelar, oponerte
          y revocar el tratamiento de tus datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="justify-start min-h-11"
            disabled={exportM.isPending}
            onClick={() => exportM.mutate()}
          >
            <Download className="size-4" />
            {exportM.isPending ? "Generando…" : "Descargar mis datos"}
          </Button>
          <Button
            variant="outline"
            className="justify-start min-h-11"
            onClick={() => openTipo("rectificacion")}
          >
            <FileEdit className="size-4" />
            Solicitar rectificación
          </Button>
          <Button
            variant="outline"
            className="justify-start min-h-11"
            onClick={() => openTipo("revocacion")}
          >
            <Ban className="size-4" />
            Revocar consentimiento
          </Button>
          <Button
            variant="outline"
            className="justify-start min-h-11 text-destructive"
            onClick={() => openTipo("cancelacion")}
          >
            <Trash2 className="size-4" />
            Eliminar mi cuenta
          </Button>
        </div>

        <div className="pt-2">
          <p className="text-xs font-medium mb-1">Histórico de solicitudes</p>
          {list.isLoading ? (
            <p className="text-xs text-muted-foreground">Un momento…</p>
          ) : (list.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aún no has hecho solicitudes.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {list.data!.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {TIPO_LABEL[s.tipo] ?? s.tipo}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={s.estado === "pendiente" ? "default" : "secondary"}>
                    {s.estado}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <Dialog open={tipo !== null} onOpenChange={(o) => !o && setTipo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tipo === "cancelacion" && <ShieldX className="size-5 text-destructive" />}
              {tipo ? TIPO_LABEL[tipo] : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {tipo === "cancelacion"
                ? "La eliminación NO es automática: la ley puede obligar a conservar registros SST por hasta 20 años. Tu prevencionista revisará la solicitud."
                : "Cuéntanos brevemente lo que necesitas. Tu responsable de tratamiento tiene 10 días hábiles para responder."}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Describe tu solicitud…"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            maxLength={1000}
          />

          {tipo === "cancelacion" && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={confirmCancel}
                onChange={(e) => setConfirmCancel(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Entiendo que mi cuenta no se borra automáticamente y que mis datos
                pueden conservarse como soporte legal del SG-SST.
              </span>
            </label>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTipo(null)}
              disabled={crearM.isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                tipo && crearM.mutate({ tipo, descripcion: descripcion.trim() })
              }
              disabled={
                crearM.isPending ||
                descripcion.trim().length < 5 ||
                (tipo === "cancelacion" && !confirmCancel)
              }
              className="flex-1"
            >
              {crearM.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
