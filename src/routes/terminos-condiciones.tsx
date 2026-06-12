import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terminos-condiciones")({
  head: () => ({
    meta: [
      { title: "Términos y Condiciones — Activa SST" },
      {
        name: "description",
        content:
          "Términos y Condiciones de uso de la plataforma Activa SST para pausas activas y cumplimiento SST en Colombia.",
      },
    ],
  }),
  component: TerminosPage,
});

function TerminosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed text-foreground space-y-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
      <h1>Términos y Condiciones</h1>
      <p className="text-xs text-muted-foreground">Versión 1.0 · Vigente desde junio de 2026</p>

      <h2>1. Aceptación</h2>
      <p>
        El uso de la plataforma <strong>Activa SST</strong> (operada por Lab Lab SAS) implica la
        aceptación plena de estos Términos y Condiciones, así como de la{" "}
        <Link to="/politica-tratamiento-datos" className="underline">
          Política de Tratamiento de Datos Personales
        </Link>
        .
      </p>

      <h2>2. Objeto del servicio</h2>
      <p>
        Activa SST es una plataforma SaaS que permite a las empresas programar, ejecutar y registrar
        pausas activas para sus trabajadores, en cumplimiento de la Resolución 0312 de 2019 y demás
        normatividad colombiana en Seguridad y Salud en el Trabajo (SST).
      </p>

      <h2>3. Cuentas y roles</h2>
      <ul>
        <li><strong>Trabajador:</strong> ejecuta pausas y consulta su historial.</li>
        <li><strong>Prevencionista / Administrador:</strong> gestiona trabajadores, programaciones y reportes.</li>
      </ul>
      <p>
        El usuario es responsable de la veracidad de la información suministrada y de la
        confidencialidad de su acceso (magic link).
      </p>

      <h2>4. Uso aceptable</h2>
      <p>El usuario se compromete a no:</p>
      <ul>
        <li>Suplantar identidades o registrar datos falsos.</li>
        <li>Intentar vulnerar la seguridad de la plataforma.</li>
        <li>Usar la plataforma para fines distintos a los autorizados por su empresa.</li>
      </ul>

      <h2>5. Propiedad intelectual</h2>
      <p>
        Todo el software, marcas, contenidos audiovisuales de pausas, diseños e interfaces son
        propiedad de Lab Lab SAS o de terceros licenciantes. Se concede al usuario una licencia
        limitada, no exclusiva, no transferible y revocable para uso interno de su empresa.
      </p>

      <h2>6. Limitación de responsabilidad</h2>
      <p>
        Activa SST es una herramienta de apoyo. La supervisión médica, ergonómica y de SST es
        responsabilidad exclusiva del empleador y de su personal calificado. Lab Lab SAS no
        responde por lesiones derivadas de la ejecución incorrecta de pausas activas.
      </p>
      <p>
        En la máxima extensión permitida por la ley, la responsabilidad agregada de Lab Lab SAS
        frente al cliente no excederá el valor pagado por el servicio en los últimos 12 meses.
      </p>

      <h2>7. Disponibilidad</h2>
      <p>
        El servicio se presta &quot;tal cual&quot; y &quot;según disponibilidad&quot;. Se realizan
        esfuerzos razonables por mantener un uptime &gt;99%, pero no se garantiza operación
        ininterrumpida.
      </p>

      <h2>8. Suspensión y terminación</h2>
      <p>
        Lab Lab SAS puede suspender o terminar el acceso ante incumplimiento de estos Términos,
        falta de pago o uso indebido. La conservación de datos posterior se rige por la Política
        de Tratamiento de Datos y la normatividad SST aplicable (mínimo 20 años para registros
        ocupacionales).
      </p>

      <h2>9. Modificaciones</h2>
      <p>
        Lab Lab SAS podrá modificar estos Términos. Los cambios sustanciales se notificarán por
        correo electrónico o dentro de la plataforma con al menos 15 días de anticipación.
      </p>

      <h2>10. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia
        se someterá a los jueces y tribunales de la ciudad de Bogotá D.C., renunciando a cualquier
        otro fuero.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Lab Lab SAS · tratamiento@activasst.co
      </p>
    </main>
  );
}
