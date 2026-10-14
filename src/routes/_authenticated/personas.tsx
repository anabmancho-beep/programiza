import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/states";

export const Route = createFileRoute("/_authenticated/personas")({
  head: () => ({ meta: [{ title: "Personas · Programiza" }, { name: "description", content: "Personas en Programiza." }, { property: "og:title", content: "Personas · Programiza" }, { property: "og:description", content: "Personas en Programiza." }] }),
  component: () => <PageHeader title="Personas" subtitle="Sección en construcción." />,
});
