import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/states";

export const Route = createFileRoute("/_authenticated/centro")({
  head: () => ({ meta: [{ title: "Centro y equipo · Programiza" }, { name: "description", content: "Centro y equipo en Programiza." }, { property: "og:title", content: "Centro y equipo · Programiza" }, { property: "og:description", content: "Centro y equipo en Programiza." }] }),
  component: () => <PageHeader title="Centro y equipo" subtitle="Sección en construcción." />,
});
