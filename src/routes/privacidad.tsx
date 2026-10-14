import { createFileRoute, Link } from "@tanstack/react-router";
import { Notice } from "@/components/states";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Privacidad y datos · Programiza" },
      { name: "description", content: "Cómo trata Programiza los datos de las personas atendidas y del equipo del centro." },
      { property: "og:title", content: "Privacidad y datos · Programiza" },
      { property: "og:description", content: "Tratamiento de datos de salud, minimización y derechos RGPD en Programiza." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
      <Link to="/" className="underline">← Volver</Link>
      <h1 className="text-3xl font-semibold">Privacidad y datos</h1>
      <Notice title="Texto de ejemplo">
        Este texto es un modelo orientativo. Debe revisarlo y adaptarlo el delegado o delegada de protección de datos (DPD) del centro antes de usar la aplicación con datos reales. Este prototipo solo debe contener datos ficticios.
      </Notice>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Responsable del tratamiento</h2>
        <p>El centro que utiliza Programiza es el responsable del tratamiento. Programiza actúa como herramienta de apoyo para planificar actividades.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Qué datos tratamos</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Seudónimo o código de la persona atendida y su rango de edad. No se recogen nombre, DNI, dirección, teléfono ni fecha de nacimiento.</li>
          <li>Datos de salud estrictamente necesarios para programar (tipo de discapacidad, diagnóstico breve, perfil funcional).</li>
          <li>Registro de consentimiento: quién lo otorga, fecha, finalidad y estado.</li>
          <li>Datos de las cuentas del equipo (correo y nombre) y registro de accesos a las fichas.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Base jurídica y finalidad</h2>
        <p>Consentimiento explícito de la persona o de su representante legal (art. 9.2.a RGPD) para la planificación de apoyos y actividades en el centro. Sin consentimiento otorgado no se guardan diagnósticos ni se crean programaciones.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Seguridad</h2>
        <p>Los datos de cada centro están aislados y solo los ve su equipo. Los roles los asigna exclusivamente la administración del centro. Cada apertura o edición de una ficha queda registrada. No se envían datos identificativos a servicios externos.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Derechos</h2>
        <p>Acceso, rectificación, supresión, limitación, portabilidad y oposición. La administración del centro puede exportar todos los datos de una persona, anonimizarla o eliminarla por completo. También puede presentarse una reclamación ante la Agencia Española de Protección de Datos (aepd.es).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Conservación</h2>
        <p>Los datos se conservan mientras dure la atención en el centro y, después, durante los plazos legales que determine el centro.</p>
      </section>
    </div>
  );
}
