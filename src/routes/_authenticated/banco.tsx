import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/states";

export const Route = createFileRoute("/_authenticated/banco")({
  head: () => ({ meta: [{ title: "Banco de actividades · Programiza" }, { name: "description", content: "Banco de actividades en Programiza." }, { property: "og:title", content: "Banco de actividades · Programiza" }, { property: "og:description", content: "Banco de actividades en Programiza." }] }),
  component: () => <PageHeader title="Banco de actividades" subtitle="Sección en construcción." />,
});
