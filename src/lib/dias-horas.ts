// Helpers compartidos para programaciones (días/horas).

export const DIAS_LABEL: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

export function diasList(dias: number[]): string {
  return dias
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DIAS_LABEL[d] ?? d)
    .join(" ");
}

/** Acepta "HH:MM" o "HH:MM:SS". Devuelve minutos desde medianoche. */
export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map((s) => parseInt(s, 10));
  return (h || 0) * 60 + (m || 0);
}

export function fmtHora(t: string): string {
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/**
 * Dada una lista de programaciones activas, devuelve el próximo slot
 * (programacion + hora) a partir de "ahora". Mira hoy primero, luego
 * los siguientes 7 días. Filtra por tipos del trabajador si se pasan.
 */
export interface ProgSlot {
  programacion_id: string;
  pausa_oficial_id: string;
  nombre: string;
  hora: string; // HH:MM
  fecha: Date; // fecha+hora del slot
  enMinutos: number; // minutos desde ahora
}

export interface ProgInput {
  id: string;
  pausa_oficial_id: string;
  nombre: string;
  dias_semana: number[];
  horas: string[];
  tipos_trabajo_objetivo: string[];
}

export function proximosSlots(
  progs: ProgInput[],
  tiposTrabajador: string[] | null,
  now: Date = new Date(),
  ventanaDias = 7,
): ProgSlot[] {
  const out: ProgSlot[] = [];
  const aplicaTipo = (p: ProgInput) => {
    if (!p.tipos_trabajo_objetivo?.length) return true; // sin filtro = todos
    if (!tiposTrabajador?.length) return false;
    return p.tipos_trabajo_objetivo.some((t) => tiposTrabajador.includes(t));
  };
  for (let i = 0; i < ventanaDias; i++) {
    const dia = new Date(now);
    dia.setDate(now.getDate() + i);
    const dow = dia.getDay();
    for (const p of progs) {
      if (!aplicaTipo(p)) continue;
      if (!p.dias_semana.includes(dow)) continue;
      for (const h of p.horas) {
        const [hh, mm] = h.split(":").map((s) => parseInt(s, 10));
        const slot = new Date(dia);
        slot.setHours(hh || 0, mm || 0, 0, 0);
        const diff = (slot.getTime() - now.getTime()) / 60000;
        if (diff < 0) continue;
        out.push({
          programacion_id: p.id,
          pausa_oficial_id: p.pausa_oficial_id,
          nombre: p.nombre,
          hora: fmtHora(h),
          fecha: slot,
          enMinutos: Math.round(diff),
        });
      }
    }
    if (out.length) break; // ya hay algo en este día, no buscamos más adelante
  }
  return out.sort((a, b) => a.enMinutos - b.enMinutos);
}

/**
 * Slot cuya hora YA llegó hoy y sigue dentro de la ventana de gracia sin
 * que el trabajador lo haya atendido. Es la base del recordatorio in-app.
 */
export interface SlotPendiente {
  programacion_id: string;
  pausa_oficial_id: string;
  nombre: string;
  hora: string; // HH:MM
  fecha: Date; // fecha+hora programada del slot
  atrasadoMin: number; // minutos transcurridos desde la hora del slot
}

/**
 * Devuelve los slots de HOY que ya iniciaron (hora <= ahora) y siguen dentro
 * de `ventanaMin` sin registro asociado. Un slot se considera atendido si hay
 * un registro de esa programación cuyo `respondido_en` cae dentro de la ventana
 * del slot (cubre tanto "hecha" como "postpuesta").
 */
export function slotsPendientesAhora(
  progs: ProgInput[],
  tiposTrabajador: string[] | null,
  registros: { programacion_id: string; respondido_en: string }[],
  now: Date = new Date(),
  ventanaMin = 60,
): SlotPendiente[] {
  const dow = now.getDay();
  const aplicaTipo = (p: ProgInput) => {
    if (!p.tipos_trabajo_objetivo?.length) return true; // sin filtro = todos
    if (!tiposTrabajador?.length) return false;
    return p.tipos_trabajo_objetivo.some((t) => tiposTrabajador.includes(t));
  };
  const out: SlotPendiente[] = [];
  for (const p of progs) {
    if (!aplicaTipo(p)) continue;
    if (!p.dias_semana.includes(dow)) continue;
    for (const h of p.horas) {
      const [hh, mm] = h.split(":").map((s) => parseInt(s, 10));
      const slot = new Date(now);
      slot.setHours(hh || 0, mm || 0, 0, 0);
      const atrasadoMin = (now.getTime() - slot.getTime()) / 60000;
      if (atrasadoMin < 0 || atrasadoMin > ventanaMin) continue;
      const finVentana = slot.getTime() + ventanaMin * 60000;
      const atendido = registros.some((r) => {
        if (r.programacion_id !== p.id) return false;
        const t = new Date(r.respondido_en).getTime();
        return t >= slot.getTime() && t <= finVentana;
      });
      if (atendido) continue;
      out.push({
        programacion_id: p.id,
        pausa_oficial_id: p.pausa_oficial_id,
        nombre: p.nombre,
        hora: fmtHora(h),
        fecha: slot,
        atrasadoMin: Math.round(atrasadoMin),
      });
    }
  }
  return out.sort((a, b) => b.atrasadoMin - a.atrasadoMin); // el más atrasado primero
}

/**
 * Programación con metadatos para calcular el DENOMINADOR de cumplimiento
 * (cuántas pausas se esperaban) sin materializar filas en la base.
 */
export interface ProgEsperado {
  id: string;
  dias_semana: number[];
  horas: string[];
  tipos_trabajo_objetivo: string[];
  creadoEn: Date; // desde cuándo existe la programación
}

function inicioDia(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Cuenta cuántas pausas se ESPERABAN de un trabajador en [desde, hasta].
 * Es el denominador de adherencia calculado on-demand (no se guardan filas
 * "vencida" para no engordar la base). Solo cuenta slots ya exigibles
 * (hora <= hasta) y respeta la fecha de creación de la programación y del
 * trabajador para no exigir pausas anteriores a su existencia.
 */
export function contarSlotsEsperados(
  progs: ProgEsperado[],
  tiposTrabajador: string[] | null,
  desde: Date,
  hasta: Date,
  trabajadorDesde: Date,
): number {
  const aplicaTipo = (p: ProgEsperado) => {
    if (!p.tipos_trabajo_objetivo?.length) return true; // sin filtro = todos
    if (!tiposTrabajador?.length) return false;
    return p.tipos_trabajo_objetivo.some((t) => tiposTrabajador.includes(t));
  };
  const trabDesdeDia = inicioDia(trabajadorDesde);
  let count = 0;
  const dia = new Date(desde);
  dia.setHours(0, 0, 0, 0);
  const finMs = hasta.getTime();
  while (dia.getTime() <= finMs) {
    const dow = dia.getDay();
    const diaMs = dia.getTime();
    for (const p of progs) {
      if (!aplicaTipo(p)) continue;
      if (!p.dias_semana.includes(dow)) continue;
      if (diaMs < inicioDia(p.creadoEn)) continue;
      if (diaMs < trabDesdeDia) continue;
      for (const h of p.horas) {
        const [hh, mm] = h.split(":").map((s) => parseInt(s, 10));
        const slot = new Date(dia);
        slot.setHours(hh || 0, mm || 0, 0, 0);
        if (slot.getTime() > finMs) continue; // slot futuro: aún no exigible
        count += 1;
      }
    }
    dia.setDate(dia.getDate() + 1);
  }
  return count;
}

/** Cuenta cuántos slots aplican HOY al trabajador. */
export function slotsHoyCount(
  progs: ProgInput[],
  tiposTrabajador: string[] | null,
  now: Date = new Date(),
): number {
  const dow = now.getDay();
  let count = 0;
  for (const p of progs) {
    if (p.tipos_trabajo_objetivo?.length) {
      if (!tiposTrabajador?.length) continue;
      if (!p.tipos_trabajo_objetivo.some((t) => tiposTrabajador.includes(t))) continue;
    }
    if (!p.dias_semana.includes(dow)) continue;
    count += p.horas.length;
  }
  return count;
}
