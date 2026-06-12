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
        <article className="max-w-none text-foreground text-sm leading-relaxed space-y-3">
          <ReactMarkdown
            components={{
              h1: (p) => <h1 className="text-2xl font-bold mt-2 mb-2" {...p} />,
              h2: (p) => <h2 className="text-lg font-semibold mt-6 mb-2" {...p} />,
              h3: (p) => <h3 className="text-base font-semibold mt-4 mb-1" {...p} />,
              p: (p) => <p className="leading-relaxed" {...p} />,
              ul: (p) => <ul className="list-disc pl-5 space-y-1" {...p} />,
              ol: (p) => <ol className="list-decimal pl-5 space-y-1" {...p} />,
              strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
              a: (p) => <a className="text-primary underline underline-offset-2" {...p} />,
              hr: () => <hr className="my-4 border-border" />,
            }}
          >
            {q.data.contenido_md}
          </ReactMarkdown>
        </article>
      )}
    </main>
  );
}
