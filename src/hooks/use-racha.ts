import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRacha(userId: string | undefined) {
  return useQuery({
    queryKey: ["racha", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 90);
      const { data, error } = await supabase
        .from("pausa_registros")
        .select("respondido_en")
        .eq("trabajador_id", userId!)
        .eq("estado", "hecha")
        .gte("respondido_en", desde.toISOString());
      if (error) throw error;
      const fechas = new Set<string>(
        (data ?? []).map((r) =>
          new Date(r.respondido_en).toISOString().slice(0, 10),
        ),
      );
      let streak = 0;
      const cursor = new Date();
      // Si hoy aún no hay pausa, empezamos a contar desde ayer
      if (!fechas.has(cursor.toISOString().slice(0, 10))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (fechas.has(cursor.toISOString().slice(0, 10))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    },
  });
}
