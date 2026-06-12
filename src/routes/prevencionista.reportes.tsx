import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prevencionista/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes — Activa SST" },
      { name: "description", content: "Reportes mensuales de pausas activas para cumplimiento SST." },
    ],
  }),
  component: ReportesPage,
});

type RegistroRow = {
  usuario_id: string;
  estado: string;
  duracion_real_seg: number | null;
  completada_en: string | null;
  usuarios: { nombre: string | null; email: string } | null;
};

function ReportesPage() {
  const { usuario } = useUsuario();
  const [generating, setGenerating] = useState(false);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const reportQuery = useQuery({
    queryKey: ["reportes-mes", usuario?.empresa_id],
    enabled: !!usuario?.empresa_id,
    queryFn: async () => {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nombre")
        .eq("id", usuario!.empresa_id!)
        .maybeSingle();

      const { data: registros, error } = await supabase
        .from("pausa_registros")
        .select("usuario_id, estado, duracion_real_seg, completada_en, usuarios(nombre, email)")
        .gte("completada_en", monthStart.toISOString())
        .returns<RegistroRow[]>();
      if (error) throw error;

      const porTrabajador = new Map<string, { nombre: string; completadas: number; postpuestas: number; omitidas: number; total: number; seg: number }>();
      for (const r of registros ?? []) {
        const k = r.usuario_id;
        const nombre = r.usuarios?.nombre || r.usuarios?.email || "—";
        const cur = porTrabajador.get(k) ?? { nombre, completadas: 0, postpuestas: 0, omitidas: 0, total: 0, seg: 0 };
        cur.total += 1;
        if (r.estado === "completada") cur.completadas += 1;
        else if (r.estado === "postpuesta") cur.postpuestas += 1;
        else if (r.estado === "omitida") cur.omitidas += 1;
        cur.seg += r.duracion_real_seg ?? 0;
        porTrabajador.set(k, cur);
      }

      const total = registros?.length ?? 0;
      const completadas = registros?.filter((r) => r.estado === "completada").length ?? 0;
      const adherencia = total > 0 ? Math.round((completadas / total) * 100) : 0;

      return {
        empresa: empresa?.nombre ?? "Empresa",
        kpis: { total, completadas, adherencia },
        trabajadores: Array.from(porTrabajador.values()).sort((a, b) => b.completadas - a.completadas),
      };
    },
  });

  const generarPDF = async () => {
    if (!reportQuery.data) return;
    setGenerating(true);
    try {
      const { empresa, kpis, trabajadores } = reportQuery.data;
      const doc = new jsPDF();
      const mes = monthStart.toLocaleDateString("es-CO", { month: "long", year: "numeric" });

      doc.setFontSize(20);
      doc.text("Reporte Mensual de Pausas Activas", 14, 22);
      doc.setFontSize(12);
      doc.text(`${empresa}`, 14, 32);
      doc.text(`Periodo: ${mes}`, 14, 40);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Generado por Activa SST · Cumplimiento Resolución 0312 de 2019", 14, 48);
      doc.setTextColor(0);

      doc.setFontSize(14);
      doc.text("Indicadores generales", 14, 62);
      autoTable(doc, {
        startY: 66,
        head: [["Indicador", "Valor"]],
        body: [
          ["Pausas totales registradas", String(kpis.total)],
          ["Pausas completadas", String(kpis.completadas)],
          ["Adherencia global", `${kpis.adherencia}%`],
        ],
      });

      autoTable(doc, {
        head: [["Trabajador", "Completadas", "Postpuestas", "Omitidas", "Min. totales"]],
        body: trabajadores.map((t) => [
          t.nombre,
          t.completadas,
          t.postpuestas,
          t.omitidas,
          Math.round(t.seg / 60),
        ]),
      });

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        "Documento generado automáticamente · Cumplimiento SST Colombia · Lab Lab SAS",
        14,
        pageHeight - 10,
      );

      doc.save(`reporte-pausas-${mes.replace(/\s/g, "-")}.pdf`);
      toast.success("Reporte generado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el reporte");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground">Resumen mensual de adherencia y pausas activas.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden />
              Reporte mensual ({monthStart.toLocaleDateString("es-CO", { month: "long", year: "numeric" })})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : reportQuery.isError ? (
              <p role="alert" className="text-sm text-destructive">
                No se pudieron cargar los datos. Intenta de nuevo.
              </p>
            ) : reportQuery.data ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-semibold">{reportQuery.data.kpis.total}</p>
                  <p className="text-xs text-muted-foreground">Pausas totales</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{reportQuery.data.kpis.completadas}</p>
                  <p className="text-xs text-muted-foreground">Completadas</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{reportQuery.data.kpis.adherencia}%</p>
                  <p className="text-xs text-muted-foreground">Adherencia</p>
                </div>
              </div>
            ) : null}

            <Button
              onClick={generarPDF}
              disabled={generating || !reportQuery.data || reportQuery.data.kpis.total === 0}
              className="w-full min-h-11"
            >
              <FileDown className="size-4" aria-hidden />
              {generating ? "Generando…" : "Descargar PDF"}
            </Button>
            {reportQuery.data?.kpis.total === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Aún no hay pausas registradas este mes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
