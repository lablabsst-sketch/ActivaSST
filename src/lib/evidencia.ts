import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Trabajador = Database["public"]["Tables"]["usuarios"]["Row"];

// Etiquetas legibles para las finalidades del consentimiento (Ley 1581/2012).
// Las claves coinciden con las almacenadas en consentimientos.finalidades_aceptadas
// (ver onboarding.tsx). Cualquier clave no mapeada se muestra tal cual.
const FINALIDAD_LABEL: Record<string, string> = {
  gestion_pausas_activas: "Gestión de pausas activas",
  cumplimiento_sg_sst: "Cumplimiento del SG-SST",
  reportes_adherencia: "Reportes de adherencia",
  comunicaciones_operativas: "Comunicaciones operativas",
  auditoria_legal: "Auditoría legal",
  sst: "Seguridad y salud en el trabajo",
  pausas_activas: "Pausas activas",
  notificaciones: "Notificaciones",
};

const ESTADO_LABEL: Record<string, string> = {
  hecha: "Completada",
  postpuesta: "Postpuesta",
  rechazada: "Rechazada",
  vencida: "Vencida",
  pendiente: "Pendiente",
};

type ConsentRow = {
  id: string;
  version_aviso: string;
  aceptado_at: string;
  revocado_at: string | null;
  revocado_motivo: string | null;
  user_agent: string | null;
  ip_origen: string | null;
  finalidades_aceptadas: string[] | null;
};

type RegistroRow = {
  id: string;
  estado: string;
  duracion_real_seg: number | null;
  respondido_en: string;
  response_uuid: string | null;
  user_agent: string | null;
  pausas_oficiales: { titulo: string } | null;
};

/**
 * Genera y descarga el paquete de evidencia legal de un trabajador:
 *  - Identidad del titular (nombre, cédula, email, empresa, rol, fecha de alta).
 *  - Trazabilidad del consentimiento Habeas Data (versión aceptada, fecha,
 *    finalidades, user_agent) — Ley 1581/2012.
 *  - Historial completo de pausas activas (registro append-only, con response_uuid
 *    y user_agent por respuesta) como rastro auditable de que fue la cuenta del
 *    titular quien las ejecutó.
 *
 * Requiere que el llamante sea staff (prevencionista/empresa_admin) de la misma
 * empresa: las lecturas están sujetas a RLS (consent_select_staff, reg_select_staff).
 */
export async function descargarEvidenciaTrabajador(trabajador: Trabajador): Promise<void> {
  // Empresa (para el encabezado). RLS ya restringe a la empresa del staff.
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nombre")
    .eq("id", trabajador.empresa_id)
    .maybeSingle();

  const { data: consentimientos, error: consErr } = await supabase
    .from("consentimientos")
    .select(
      "id, version_aviso, aceptado_at, revocado_at, revocado_motivo, user_agent, ip_origen, finalidades_aceptadas",
    )
    .eq("usuario_id", trabajador.id)
    .order("aceptado_at", { ascending: false })
    .returns<ConsentRow[]>();
  if (consErr) throw consErr;

  const { data: registros, error: regErr } = await supabase
    .from("pausa_registros")
    .select(
      "id, estado, duracion_real_seg, respondido_en, response_uuid, user_agent, pausas_oficiales(titulo)",
    )
    .eq("trabajador_id", trabajador.id)
    .order("respondido_en", { ascending: true })
    .returns<RegistroRow[]>();
  if (regErr) throw regErr;

  const generadoEn = new Date();
  const doc = new jsPDF();
  const nombre = trabajador.nombre || trabajador.email || "Trabajador";

  // ---- Encabezado ----
  doc.setFontSize(18);
  doc.text("Evidencia individual de cumplimiento", 14, 20);
  doc.setFontSize(11);
  doc.text(`${nombre}`, 14, 29);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `${empresa?.nombre ?? "Empresa"} · Generado el ${generadoEn.toLocaleString("es-CO")}`,
    14,
    36,
  );
  doc.setTextColor(0);

  // ---- 1. Identidad del titular ----
  doc.setFontSize(13);
  doc.text("1. Identidad del titular", 14, 48);
  autoTable(doc, {
    startY: 52,
    theme: "grid",
    styles: { fontSize: 9 },
    head: [["Campo", "Valor"]],
    body: [
      ["Nombre", nombre],
      ["Cédula", trabajador.documento || "—"],
      ["Correo", trabajador.email],
      ["Rol", trabajador.rol],
      ["Estado", trabajador.estado],
      ["ID de cuenta", trabajador.id],
      ["Fecha de alta", new Date(trabajador.created_at).toLocaleString("es-CO")],
    ],
  });

  // ---- 2. Consentimiento Habeas Data ----
  const afterIdent = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(13);
  doc.text("2. Consentimiento Habeas Data (Ley 1581/2012)", 14, afterIdent + 12);
  if (consentimientos && consentimientos.length > 0) {
    autoTable(doc, {
      startY: afterIdent + 16,
      styles: { fontSize: 8, cellWidth: "wrap" },
      head: [["Versión", "Aceptado", "Estado", "Finalidades", "Dispositivo (user-agent)"]],
      body: consentimientos.map((c) => [
        c.version_aviso,
        new Date(c.aceptado_at).toLocaleString("es-CO"),
        c.revocado_at
          ? `Revocado ${new Date(c.revocado_at).toLocaleDateString("es-CO")}${c.revocado_motivo ? ` (${c.revocado_motivo})` : ""}`
          : "Vigente",
        (c.finalidades_aceptadas ?? []).map((f) => FINALIDAD_LABEL[f] ?? f).join(", ") || "—",
        c.user_agent || "—",
      ]),
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      "Sin registro de consentimiento. El trabajador aún no ha completado el onboarding.",
      14,
      afterIdent + 22,
    );
    doc.setTextColor(0);
  }

  // ---- 3. Historial de pausas (rastro auditable) ----
  doc.addPage();
  doc.setFontSize(13);
  doc.text("3. Historial de pausas activas (registro append-only)", 14, 20);
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    "Cada fila es una respuesta única e inmutable del titular. El response_uuid y el user-agent",
    14,
    26,
  );
  doc.text(
    "permiten verificar que la ejecución provino de la cuenta autenticada del trabajador.",
    14,
    30,
  );
  doc.setTextColor(0);

  const completadas = (registros ?? []).filter((r) => r.estado === "hecha").length;
  doc.setFontSize(9);
  doc.text(
    `Total de respuestas: ${registros?.length ?? 0}  ·  Completadas: ${completadas}`,
    14,
    38,
  );

  if (registros && registros.length > 0) {
    autoTable(doc, {
      startY: 42,
      styles: { fontSize: 7 },
      head: [["Fecha y hora", "Pausa", "Respuesta", "Dur. (s)", "response_uuid", "Dispositivo"]],
      body: registros.map((r) => [
        new Date(r.respondido_en).toLocaleString("es-CO"),
        r.pausas_oficiales?.titulo || "—",
        ESTADO_LABEL[r.estado] ?? r.estado,
        r.estado === "hecha" && r.duracion_real_seg != null ? String(r.duracion_real_seg) : "—",
        r.response_uuid ? r.response_uuid.slice(0, 8) : "—",
        r.user_agent ? r.user_agent.slice(0, 40) : "—",
      ]),
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("Sin pausas registradas todavía.", 14, 46);
    doc.setTextColor(0);
  }

  // ---- Pie legal en todas las páginas ----
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.height;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      "Evidencia SG-SST · Registro append-only e inmutable · Conservar 20 años (Decreto 1072/2015 art. 2.2.4.6.13) · Lab Lab SAS",
      14,
      pageHeight - 8,
    );
    doc.text(`Página ${i}/${pageCount}`, doc.internal.pageSize.width - 30, pageHeight - 8);
    doc.setTextColor(0);
  }

  const slug = (trabajador.documento || nombre).replace(/[\s/]+/g, "-");
  doc.save(`evidencia-${slug}.pdf`);
}
