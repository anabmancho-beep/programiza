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
        <h2 className="text-xl font-semibold">Normativa aplicable</h2>
        <p>Reglamento (UE) 2016/679 General de Protección de Datos (RGPD), Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD) y Ley 34/2002 de servicios de la sociedad de la información (LSSI-CE).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Responsable del tratamiento</h2>
        <p>El centro que utiliza Programiza es el responsable del tratamiento. Cada centro debe indicar a las personas atendidas y a sus familias su denominación, NIF, dirección y un correo de contacto.</p>
        <p>Delegado o delegada de protección de datos (DPD): obligatorio para centros que traten a gran escala datos de salud o de personas vulnerables (art. 37 RGPD y art. 34 LOPDGDD). El centro debe facilitar su contacto.</p>
        <p>Programiza actúa como encargado del tratamiento (art. 28 RGPD) y solo trata los datos siguiendo las instrucciones del centro, con quien debe firmarse un contrato de encargo del tratamiento.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Qué datos tratamos</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Seudónimo o código de la persona atendida y su rango de edad. No se recogen nombre, DNI, dirección, teléfono ni fecha de nacimiento.</li>
          <li>Datos de salud estrictamente necesarios para programar (tipo de discapacidad, diagnóstico breve, perfil funcional).</li>
          <li>Registro de consentimiento: quién lo otorga, fecha, finalidad y estado.</li>
          <li>Datos de las cuentas del equipo (correo y nombre) y registro de accesos a las fichas.</li>
          <li>Registro de conductas (antecedente, conducta, consecuencia) y plan de anticipación: solo los ven y editan profesionales y la administración.</li>
          <li>Medicación prescrita y citas médicas, solo informativas y copiadas de la pauta del profesional sanitario: solo profesionales y administración. La aplicación no calcula dosis ni da recomendaciones sobre medicación.</li>
          <li>Pictogramas: La biblioteca básica usa emojis estándar Unicode incluidos en la aplicación; su aspecto depende del dispositivo. Las imágenes que suba el centro necesitan licencia. Las imágenes subidas no deben mostrar a personas reconocibles. La biblioteca básica no se envía a ningún servicio externo.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Base jurídica y finalidad</h2>
        <p>Consentimiento explícito de la persona o de su representante legal (art. 9.2.a RGPD) para la planificación de apoyos y actividades en el centro. Sin consentimiento otorgado no se guardan diagnósticos ni se crean programaciones. El consentimiento puede retirarse en cualquier momento, sin que afecte a lo tratado antes (art. 7.3 RGPD). Las personas menores de 14 años o con la capacidad de decisión apoyada lo otorgan a través de sus representantes legales o con las medidas de apoyo que correspondan (art. 7 LOPDGDD).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Seguridad</h2>
        <p>Los datos de cada centro están aislados y solo los ve su equipo. Los roles los asigna exclusivamente la administración del centro. Cada apertura o edición de una ficha queda registrada. No se envían datos identificativos a servicios externos.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Acceso de familias</h2>
        <p>El centro puede invitar a un familiar o tutor legal con un enlace personal, válido 14 días, que solo funciona con el correo invitado. Solo se activa con el consentimiento otorgado; si se retira, el acceso se corta al momento. La familia solo ve, en modo lectura, la agenda semanal y los informes aprobados que el equipo comparta. Nunca ve adaptaciones, observaciones, conductas, salud ni a otras personas. Cada consulta queda registrada.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Uso de inteligencia artificial</h2>
        <p>Las sugerencias de programación y la redacción de informes usan Lovable AI. La selección de datos se hace en el servidor, nunca en el navegador.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Se envía:</strong> tipo de discapacidad o trastorno, rango de edad, niveles de autonomía por área y nivel de la programación; para informes, solo recuentos de resultados por área, por mes y por objetivo, donde cada objetivo aparece con una etiqueta genérica («Objetivo 1», «Objetivo 2»…) y su área.</li>
          <li><strong>No se envía nunca:</strong> seudónimo o código, nombre del centro, diagnóstico, descripciones de los objetivos, textos libres (apoyos, comunicación, gustos, sensibilidades, rutinas, observaciones), nombres de usuarios ni fechas de nacimiento. El texto de cada objetivo se añade al informe en el servidor, después de recibir la respuesta de la IA.</li>
          <li>Solo se generan sugerencias e informes de personas con consentimiento otorgado.</li>
          <li>Todo lo generado queda como borrador «Generado con IA» hasta que una persona del equipo lo revisa y aprueba; se guarda quién y cuándo. Si se edita el texto de un informe aprobado, vuelve a borrador y se borra la aprobación.</li>
          <li><strong>Lectura fácil:</strong> para agendas se envían solo títulos, días, horas y pasos de actividades aprobadas. Para textos, el servidor quita antes códigos, correos, teléfonos, DNI y fechas. Nunca se envían conductas ni datos de salud.</li>
          <li>La IA no diagnostica ni recomienda tratamientos; solo propone actividades educativas.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Destinatarios y transferencias internacionales</h2>
        <p>No se ceden datos a terceros salvo obligación legal. Proveedores que actúan como subencargados: alojamiento y base de datos en la nube, y el servicio de inteligencia artificial, que solo recibe datos no identificativos. Si algún proveedor estuviera fuera del Espacio Económico Europeo, la transferencia se ampara en decisiones de adecuación o cláusulas contractuales tipo de la Comisión Europea (arts. 44-46 RGPD).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Decisiones automatizadas</h2>
        <p>No se toman decisiones basadas únicamente en tratamientos automatizados ni se elaboran perfiles con efectos jurídicos (art. 22 RGPD). Toda propuesta de la IA la revisa y aprueba una persona del equipo.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Almacenamiento en el dispositivo y cookies</h2>
        <p>Programiza solo usa almacenamiento técnico imprescindible: la sesión iniciada, la copia del día para el modo sin conexión y los resultados pendientes de enviar. No usa cookies publicitarias ni de análisis, por lo que no requiere consentimiento de cookies (art. 22.2 LSSI-CE). Esta copia local se borra al cerrar sesión; no uses dispositivos compartidos sin cerrarla.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Medidas de seguridad y evaluación de impacto</h2>
        <p>Cifrado en tránsito y en reposo, control de acceso por roles, aislamiento entre centros, seudonimización y registro de accesos (art. 32 RGPD). Al tratar datos de salud de personas vulnerables, el centro debe realizar una evaluación de impacto (art. 35 RGPD) antes de usar la aplicación con datos reales.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Brechas de seguridad</h2>
        <p>Si se produce una brecha de seguridad, se comunicará al centro sin dilación para que pueda notificarla a la Agencia Española de Protección de Datos en un máximo de 72 horas y, si hay alto riesgo, a las personas afectadas (arts. 33 y 34 RGPD).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Derechos</h2>
        <p>Acceso, rectificación, supresión, limitación, portabilidad y oposición. La administración del centro puede exportar todos los datos de una persona, anonimizarla o eliminarla por completo. Los derechos se ejercen ante el centro, por escrito y acreditando la identidad, y se responden en el plazo de un mes (art. 12 RGPD). También puede presentarse una reclamación ante la Agencia Española de Protección de Datos (aepd.es).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Conservación</h2>
        <p>Los datos se conservan mientras dure la atención en el centro y, después, durante los plazos legales que determine el centro. Al terminar, los datos se suprimen o anonimizan.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Aviso legal</h2>
        <p>Titular del sitio (art. 10 LSSI-CE): el centro debe indicar su denominación social, NIF, domicilio, correo de contacto y datos registrales.</p>
      </section>
    </div>
  );
}
