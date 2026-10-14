import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/states";

export const Route = createFileRoute("/_authenticated/programaciones")({
  head: () => ({ meta: [{ title: "Programaciones · Programiza" }, { name: "description", content: "Programaciones en Programiza." }, { property: "og:title", content: "Programaciones · Programiza" }, { property: "og:description", content: "Programaciones en Programiza." }] }),
  component: () => <PageHeader title="Programaciones" subtitle="Sección en construcción." />,
});
