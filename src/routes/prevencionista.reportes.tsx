import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUsuario } from "@/hooks/use-session";
import { contarSlotsEsperados, type ProgEsperado } from "@/lib/dias-horas";
import { FileDown, FileText, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prevencionista/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes — Activa SST" },
      {
        name: "description",
        content: "Reportes de pausas activas por periodo para cumplimiento SST.",
      },
    ],
  }),
  component: ReportesPage,
});

type RegistroRow = {
  id: string;
  trabajador_id: string;
  estado: string;
  duracion_real_seg: number | null;
  respondido_en: string;
  usuarios: { nombre: string | null; email: string; documento: string | null } | null;
  pausas_oficiales: { titulo: string } | null;
};

// El enum real de la DB es ('pendiente','hecha','rechazada','vencida','postpuesta').
// El trabajador solo produce 'hecha' y 'postpuesta' (RLS reg_insert_self permite
// además 'rechazada'). "hecha" = pausa completada.
const ESTADO_LABEL: Record<string, string> = {
  hecha: "Completada",
  postpuesta: "Postpuesta",
  rechazada: "Rechazada",
  vencida: "Vencida",
  pendiente: "Pendiente",
};

type PeriodoId = "semana" | "mes" | "semestre" | "anio";

const PERIODOS: { id: PeriodoId; label: string }[] = [
  { id: "semana", label: "Semanal" },
  { id: "mes", label: "Mensual" },
  { id: "semestre", label: "6 meses" },
  { id: "anio", label: "Anual" },
];

// Calcula el rango [desde, hasta] del periodo seleccionado. `hasta` siempre es
// "ahora": nunca exigimos slots futuros. Los inicios se alinean al calendario
// (lunes / día 1 / enero) para que los reportes sean reproducibles.
function rangoPeriodo(
  periodo: PeriodoId,
  ahora = new Date(),
): { desde: Date; hasta: Date; label: string } {
  const desde = new Date(ahora);
  desde.setHours(0, 0, 0, 0);
  let label: string;
  switch (periodo) {
    case "semana": {
      // Lunes de la semana en curso.
      const dow = (desde.getDay() + 6) % 7; // 0 = lunes
      desde.setDate(desde.getDate() - dow);
      label = `Semana del ${desde.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}`;
      break;
    }
    case "mes": {
      desde.setDate(1);
      label = desde.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
      break;
    }
    case "semestre": {
      // Primer día del mes, 5 meses atrás (6 meses incluyendo el actual).
      desde.setDate(1);
      desde.setMonth(desde.getMonth() - 5);
      label = `${desde.toLocaleDateString("es-CO", { month: "short", year: "numeric" })} – ${ahora.toLocaleDateString(
        "es-CO",
        { month: "short", year: "numeric" },
      )}`;
      break;
    }
    case "anio": {
      desde.setMonth(0, 1);
      label = `Año ${desde.getFullYear()}`;
      break;
    }
  }
  return { desde, hasta: ahora, label };
}

const EVIDENCE_KEY = "activa_last_evidence_download";
const REMINDER_DIAS = 31; // recuerda descargar al menos una vez al mes

function ReportesPage() {
  const { usuario } = useUsuario();
  const [generating, setGenerating] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoId>("mes");

  const { desde, hasta, label: periodoLabel } = rangoPeriodo(periodo);

  // Recordatorio de descarga de evidencia (retención legal 20 años).
  const [ultimaDescarga, setUltimaDescarga] = useState<string | null>(null);
  useEffect(() => {
    try {
      setUltimaDescarga(localStorage.getItem(EVIDENCE_KEY));
    } catch {
      // noop (SSR / storage bloqueado)
    }
  }, []);
  const diasSinDescargar = ultimaDescarga
    ? Math.floor((Date.now() - new Date(ultimaDescarga).getTime()) / 86_400_000)
    : null;
  const mostrarRecordatorio = diasSinDescargar === null || diasSinDescargar >= REMINDER_DIAS;

  const reportQuery = useQuery({
    queryKey: ["reportes-periodo", usuario?.empresa_id, periodo],
    enabled: !!usuario?.empresa_id,
    queryFn: async () => {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nombre")
        .eq("id", usuario!.empresa_id!)
        .maybeSingle();

      // RLS (reg_select_staff) ya restringe a la empresa del prevencionista.
      const { data: registros, error } = await supabase
        .from("pausa_registros")
        .select(
          "id, trabajador_id, estado, duracion_real_seg, respondido_en, usuarios(nombre, email, documento), pausas_oficiales(titulo)",
        )
        .gte("respondido_en", desde.toISOString())
        .lte("respondido_en", hasta.toISOString())
        .order("respondido_en", { ascending: true })
        .returns<RegistroRow[]>();
      if (error) throw error;

      // Programaciones activas de la empresa (base del denominador).
      const { data: progsRaw, error: progErr } = await supabase
        .from("programaciones")
        .select("id, dias_semana, horas, tipos_trabajo_objetivo, created_at")
        .eq("empresa_id", usuario!.empresa_id!)
        .eq("activa", true);
      if (progErr) throw progErr;
      const progs: ProgEsperado[] = (progsRaw ?? []).map((p) => ({
        id: p.id,
        dias_semana: p.dias_semana,
        horas: p.horas,
        tipos_trabajo_objetivo: p.tipos_trabajo_objetivo,
        creadoEn: new Date(p.created_at),
      }));

      // Trabajadores vigentes de la empresa + sus tipos de trabajo.
      const { data: trabRaw, error: trabErr } = await supabase
        .from("usuarios")
        .select("id, nombre, email, created_at")
        .eq("empresa_id", usuario!.empresa_id!)
        .eq("rol", "trabajador")
        .in("estado", ["activo", "pendiente"]);
      if (trabErr) throw trabErr;
      const trabajadoresBase = trabRaw ?? [];

      const { data: tiposRaw } = await supabase
        .from("usuario_tipos_trabajo")
        .select("usuario_id, tipo_id");
      const tiposPorTrab = new Map<string, string[]>();
      for (const t of tiposRaw ?? []) {
        const arr = tiposPorTrab.get(t.usuario_id) ?? [];
        arr.push(t.tipo_id);
        tiposPorTrab.set(t.usuario_id, arr);
      }

      // Denominador on-demand: pausas esperadas por trabajador en el periodo.
      const asignadasPorTrab = new Map<string, number>();
      let asignadas = 0;
      for (const tr of trabajadoresBase) {
        const esperadas = contarSlotsEsperados(
          progs,
          tiposPorTrab.get(tr.id) ?? [],
          desde,
          hasta,
          new Date(tr.created_at),
        );
        asignadasPorTrab.set(tr.id, esperadas);
        asignadas += esperadas;
      }

      const nombrePorTrab = new Map<string, string>(
        trabajadoresBase.map((tr) => [tr.id, tr.nombre || tr.email || "—"]),
      );

      const porTrabajador = new Map<
        string,
        {
          nombre: string;
          asignadas: number;
          completadas: number;
          postpuestas: number;
          rechazadas: number;
          total: number;
          seg: number;
        }
      >();
      // Sembrar con todos los trabajadores vigentes (aunque no tengan registros)
      // para que aparezcan sus incumplimientos.
      for (const tr of trabajadoresBase) {
        porTrabajador.set(tr.id, {
          nombre: nombrePorTrab.get(tr.id) ?? "—",
          asignadas: asignadasPorTrab.get(tr.id) ?? 0,
          completadas: 0,
          postpuestas: 0,
          rechazadas: 0,
          total: 0,
          seg: 0,
        });
      }
      for (const r of registros ?? []) {
        const k = r.trabajador_id;
        const nombre = nombrePorTrab.get(k) || r.usuarios?.nombre || r.usuarios?.email || "—";
        const cur = porTrabajador.get(k) ?? {
          nombre,
          asignadas: asignadasPorTrab.get(k) ?? 0,
          completadas: 0,
          postpuestas: 0,
          rechazadas: 0,
          total: 0,
          seg: 0,
        };
        cur.total += 1;
        if (r.estado === "hecha") cur.completadas += 1;
        else if (r.estado === "postpuesta") cur.postpuestas += 1;
        else if (r.estado === "rechazada") cur.rechazadas += 1;
        cur.seg += r.duracion_real_seg ?? 0;
        porTrabajador.set(k, cur);
      }

      const total = registros?.length ?? 0;
      const completadas = registros?.filter((r) => r.estado === "hecha").length ?? 0;
      // Adherencia real = completadas / esperadas. Si no hay programaciones
      // aún, cae a completadas/total para no dividir por cero.
      const adherencia =
        asignadas > 0
          ? Math.round((completadas / asignadas) * 100)
          : total > 0
            ? Math.round((completadas / total) * 100)
            : 0;
      const incumplidas = Math.max(0, asignadas - total);

      return {
        empresa: empresa?.nombre ?? "Empresa",
        kpis: { total, asignadas, completadas, incumplidas, adherencia },
        trabajadores: Array.from(porTrabajador.values()).sort(
          (a, b) => b.completadas - a.completadas,
        ),
        eventos: registros ?? [],
      };
    },
  });

  const marcarDescarga = () => {
    const iso = new Date().toISOString();
    try {
      localStorage.setItem(EVIDENCE_KEY, iso);
    } catch {
      // noop
    }
    setUltimaDescarga(iso);
  };

  const generarPDF = async () => {
    if (!reportQuery.data) return;
    setGenerating(true);
    try {
      const { empresa, kpis, trabajadores, eventos } = reportQuery.data;
      const doc = new jsPDF();
      const titulo = `Reporte ${PERIODOS.find((p) => p.id === periodo)?.label ?? ""} de Pausas Activas`;

      doc.setFontSize(20);
      doc.text(titulo, 14, 22);
      doc.setFontSize(12);
      doc.text(`${empresa}`, 14, 32);
      doc.text(`Periodo: ${periodoLabel}`, 14, 40);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(
        `${desde.toLocaleDateString("es-CO")} – ${hasta.toLocaleDateString("es-CO")} · Generado por Activa SST · Cumplimiento Resolución 0312 de 2019`,
        14,
        48,
      );
      doc.setTextColor(0);

      doc.setFontSize(14);
      doc.text("Indicadores generales", 14, 62);
      autoTable(doc, {
        startY: 66,
        head: [["Indicador", "Valor"]],
        body: [
          ["Pausas asignadas (esperadas)", String(kpis.asignadas)],
          ["Pausas completadas", String(kpis.completadas)],
          ["Pausas incumplidas", String(kpis.incumplidas)],
          ["Respuestas registradas", String(kpis.total)],
          ["Adherencia global", `${kpis.adherencia}%`],
        ],
      });

      autoTable(doc, {
        head: [
          ["Trabajador", "Asignadas", "Completadas", "Postpuestas", "Rechazadas", "Adher.", "Min."],
        ],
        body: trabajadores.map((t) => [
          t.nombre,
          t.asignadas,
          t.completadas,
          t.postpuestas,
          t.rechazadas,
          `${t.asignadas > 0 ? Math.round((t.completadas / t.asignadas) * 100) : 0}%`,
          Math.round(t.seg / 60),
        ]),
      });

      // Detalle por evento — evidencia auditable append-only. Cada fila es un
      // registro individual de pausa_registros con su fecha/hora, trabajador,
      // cédula, pausa, respuesta y un id verificable contra la base de datos.
      if (eventos.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text("Detalle de registros (evidencia auditable)", 14, 20);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(
          "Registro append-only. Cada fila corresponde a una respuesta única del trabajador.",
          14,
          26,
        );
        doc.setTextColor(0);
        autoTable(doc, {
          startY: 30,
          styles: { fontSize: 7 },
          head: [
            [
              "Fecha y hora",
              "Trabajador",
              "Cédula",
              "Pausa",
              "Respuesta",
              "Dur. (s)",
              "ID registro",
            ],
          ],
          body: eventos.map((e) => [
            new Date(e.respondido_en).toLocaleString("es-CO"),
            e.usuarios?.nombre || e.usuarios?.email || "—",
            e.usuarios?.documento || "—",
            e.pausas_oficiales?.titulo || "—",
            ESTADO_LABEL[e.estado] ?? e.estado,
            e.estado === "hecha" && e.duracion_real_seg != null ? String(e.duracion_real_seg) : "—",
            e.id.slice(0, 8),
          ]),
        });
      }

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        "Documento generado automáticamente · Cumplimiento SST Colombia · Conservar 20 años (Decreto 1072/2015 art. 2.2.4.6.13) · Lab Lab SAS",
        14,
        pageHeight - 10,
      );

      doc.save(`reporte-pausas-${periodo}-${periodoLabel.replace(/[\s/]+/g, "-")}.pdf`);
      marcarDescarga();
      toast.success("Reporte generado", {
        description: "Guarda este PDF como evidencia legal (retención 20 años).",
      });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el reporte");
    } finally {
      setGenerating(false);
    }
  };

  const sinDatos =
    reportQuery.data && reportQuery.data.kpis.total === 0 && reportQuery.data.kpis.asignadas === 0;

  return (
    <AppShell>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            Adherencia y evidencia de pausas activas por periodo.
          </p>
        </header>

        {mostrarRecordatorio && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="space-y-0.5 text-sm">
              <p className="font-medium">Descarga y respalda tu evidencia</p>
              <p className="text-xs">
                {diasSinDescargar === null
                  ? "Aún no has descargado ningún reporte."
                  : `Última descarga hace ${diasSinDescargar} días.`}{" "}
                La evidencia del SG-SST debe conservarse <strong>20 años</strong> (Decreto
                1072/2015). Descarga el PDF cada mes y guárdalo en tu archivo documental.
              </p>
            </div>
          </div>
        )}

        {/* Selector de periodo */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Periodo del reporte">
          {PERIODOS.map((p) => (
            <Button
              key={p.id}
              role="tab"
              aria-selected={periodo === p.id}
              variant={periodo === p.id ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden />
              <span className="capitalize">{periodoLabel}</span>
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
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div>
                  <p className="text-2xl font-semibold">{reportQuery.data.kpis.asignadas}</p>
                  <p className="text-xs text-muted-foreground">Asignadas</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{reportQuery.data.kpis.completadas}</p>
                  <p className="text-xs text-muted-foreground">Completadas</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{reportQuery.data.kpis.incumplidas}</p>
                  <p className="text-xs text-muted-foreground">Incumplidas</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{reportQuery.data.kpis.adherencia}%</p>
                  <p className="text-xs text-muted-foreground">Adherencia</p>
                </div>
              </div>
            ) : null}

            <Button
              onClick={generarPDF}
              disabled={generating || !reportQuery.data || sinDatos}
              className="w-full min-h-11"
            >
              <FileDown className="size-4" aria-hidden />
              {generating ? "Generando…" : "Descargar PDF"}
            </Button>
            {sinDatos && (
              <p className="text-xs text-muted-foreground text-center">
                Aún no hay pausas programadas ni registradas en este periodo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Cierre de ciclo: quién completó y quién no. */}
        {reportQuery.data && !sinDatos && reportQuery.data.trabajadores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cumplimiento por trabajador</CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Trabajador</th>
                      <th className="px-2 py-2 text-right font-medium">Asig.</th>
                      <th className="px-2 py-2 text-right font-medium">Compl.</th>
                      <th className="px-3 py-2 text-right font-medium">Adher.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportQuery.data.trabajadores.map((t) => {
                      const pct =
                        t.asignadas > 0 ? Math.round((t.completadas / t.asignadas) * 100) : 0;
                      const incumple = t.asignadas > 0 && t.completadas < t.asignadas;
                      return (
                        <tr key={t.nombre} className="border-b last:border-0">
                          <td className="px-3 py-2">{t.nombre}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{t.asignadas}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{t.completadas}</td>
                          <td
                            className={`px-3 py-2 text-right font-medium tabular-nums ${
                              t.asignadas === 0
                                ? "text-muted-foreground"
                                : incumple
                                  ? "text-destructive"
                                  : "text-primary"
                            }`}
                          >
                            {t.asignadas === 0 ? "—" : `${pct}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
