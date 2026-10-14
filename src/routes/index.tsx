import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import huerto from "@/assets/huerto.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Programiza · Programaciones personalizadas para centros" },
      { name: "description", content: "Crea programaciones anuales, mensuales, semanales y diarias para personas con discapacidad, con privacidad de serie." },
      { property: "og:title", content: "Programiza" },
      { property: "og:description", content: "Programaciones personalizadas y seguras para centros de atención a personas con discapacidad." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-calm">
      <div className="mx-auto grid max-w-6xl items-center gap-10 p-6 sm:p-12 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="flex items-center gap-2 font-display text-2xl"><Sprout className="h-7 w-7 text-primary" aria-hidden />Programiza</p>
          <h1 className="text-4xl font-semibold sm:text-5xl">Programaciones a la medida de cada persona</h1>
          <p className="text-lg text-muted-foreground">Del objetivo anual a la secuencia diaria, con seudónimos, consentimiento registrado y datos de cada centro siempre separados.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Acceder</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/privacidad">Privacidad y datos</Link></Button>
          </div>
        </div>
        <img src={huerto} alt="Huerto con bancales y una regadera" width={1280} height={896} className="rounded-2xl shadow-soft" />
      </div>
    </div>
  );
}
