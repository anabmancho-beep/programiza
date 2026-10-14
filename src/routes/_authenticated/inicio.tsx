import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/states";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Inicio · Programiza" }, { name: "description", content: "Inicio en Programiza." }, { property: "og:title", content: "Inicio · Programiza" }, { property: "og:description", content: "Inicio en Programiza." }] }),
  component: () => <PageHeader title="Inicio" subtitle="Sección en construcción." />,
});
