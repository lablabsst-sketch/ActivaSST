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
