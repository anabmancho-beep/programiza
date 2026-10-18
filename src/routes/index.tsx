import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sprout,
  CalendarRange,
  LineChart,
  Image,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import portada from "@/assets/portada-educativa.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Programiza · Programaciones personalizadas para centros" },
      { name: "description", content: "Crea programaciones anuales, mensuales, semanales y diarias para personas con discapacidad, con seguimiento, pictogramas e informes, y con privacidad de serie." },
      { property: "og:title", content: "Programiza" },
      { property: "og:description", content: "Programaciones personalizadas, seguimiento e informes para centros de atención a personas con discapacidad." },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: CalendarRange,
    title: "Programaciones en 4 niveles",
    text: "Del objetivo anual a la secuencia diaria, con plantillas y duplicar semana.",
  },
  {
    icon: LineChart,
    title: "Seguimiento de resultados",
    text: "Registra lograda, con apoyo o no lograda, y consulta la evolución con gráficos.",
  },
  {
    icon: Image,
    title: "Pictogramas",
    text: "Biblioteca básica de 500 pictogramas y las imágenes propias de tu centro.",
  },
  {
    icon: FileText,
    title: "Informes y PDF",
    text: "Informes de evolución por persona y agendas en PDF para el día o la semana.",
  },
  {
    icon: ShieldCheck,
    title: "Privacidad de serie",
    text: "Seudónimos, consentimiento registrado y datos de cada centro siempre separados.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-calm">
      <div className="mx-auto max-w-6xl px-6 pt-6 sm:px-12">
        <p className="flex items-center gap-2 font-display text-2xl">
          <Sprout className="h-7 w-7 text-primary" aria-hidden />
          Programiza
        </p>
      </div>
      <section className="mx-auto grid max-w-6xl items-center gap-10 p-6 sm:p-12 lg:grid-cols-2">
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold sm:text-5xl">Programaciones a la medida de cada persona</h1>
          <p className="text-lg text-muted-foreground">
            La herramienta del equipo educativo: planificar el día con pictogramas, anotar cómo ha ido cada
            actividad y preparar los informes, todo en un solo sitio y sin perder de vista la privacidad.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Del objetivo anual al plan del día, siempre enlazados.</li>
            <li>Resultado de cada actividad con el apoyo que hizo falta.</li>
            <li>Todo lo generado con IA llega como borrador para que lo revise el equipo.</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Acceder</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/privacidad">Privacidad y datos</Link></Button>
          </div>
        </div>
        <img
          src={portada}
          alt="Una educadora y un joven preparan juntos la programación con tarjetas de pictogramas y un panel semanal de actividades"
          width={1280}
          height={896}
          className="rounded-2xl shadow-soft"
        />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16 sm:px-12" aria-label="Qué incluye Programiza">
        <h2 className="mb-6 font-display text-2xl">Todo lo que hace falta en el día a día</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl bg-background p-5 shadow-soft">
              <f.icon className="mb-3 h-6 w-6 text-primary" aria-hidden />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
