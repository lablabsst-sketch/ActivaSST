import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];

/**
 * Devuelve la sesión activa de Supabase y se mantiene sincronizada con onAuthStateChange.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

/**
 * Carga el perfil `public.usuarios` del usuario autenticado.
 * Si la sesión está pero la fila no existe (cuenta creada antes del pre-registro),
 * devuelve `usuario: null` y `notFound: true`.
 */
export function useUsuario() {
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: ["usuario", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Usuario | null> => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    session,
    usuario: query.data ?? null,
    loading: sessionLoading || query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
