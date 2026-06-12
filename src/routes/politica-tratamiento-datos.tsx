import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/politica-tratamiento-datos")({
  head: () => ({
    meta: [
      { title: "Política de Tratamiento de Datos — Activa SST" },
      {
        name: "description",
        content:
          "Política de Tratamiento de Datos Personales de Activa SST conforme a la Ley 1581 de 2012 (Colombia).",
      },
    ],
  }),
  component: PoliticaPage,
});

function PoliticaPage() {
  const q = useQuery({
    queryKey: ["politica-vigente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("politicas_tratamiento")
        .select("version, contenido_md, vigente_desde")
        .eq("vigente", true)
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {q.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : q.error ? (
        <p role="alert" className="text-destructive">
          No se pudo cargar la política. Reintenta.
        </p>
      ) : !q.data ? (
        <p>No hay política publicada.</p>
      ) : (
        <article className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-h1:text-2xl prose-h1:font-bold prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-6 prose-h3:text-base prose-h3:font-semibold prose-p:leading-relaxed prose-li:my-1">
          <ReactMarkdown>{q.data.contenido_md}</ReactMarkdown>
        </article>
      )}
    </main>
  );
}
