import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, ErrorBox, Notice } from "@/components/states";
import { errMsg } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Inicio · Programiza" }, { name: "description", content: "Resumen del centro en Programiza." }, { property: "og:title", content: "Inicio · Programiza" }, { property: "og:description", content: "Resumen del centro en Programiza." }] }),
  component: Inicio,
});

function Inicio() {
  const me = useMe();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const [p, pend, pl] = await Promise.all([
        supabase.from("persons").select("id", { count: "exact", head: true }),
        supabase.from("persons").select("id", { count: "exact", head: true }).neq("consent_status", "otorgado"),
        supabase.from("plans").select("id", { count: "exact", head: true }).eq("is_template", false),
      ]);
      const err = p.error ?? pend.error ?? pl.error;
      if (err) throw err;
      return { persons: p.count ?? 0, pending: pend.count ?? 0, plans: pl.count ?? 0 };
    },
  });

  async function demo() {
    setBusy(true);
    const { error } = await supabase.rpc("load_demo_data");
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Datos de ejemplo cargados");
    qc.invalidateQueries();
  }

  return (
    <div>
      <PageHeader title={`Hola${me.data?.displayName ? ", " + me.data.displayName : ""}`} subtitle={me.data?.center?.name}
        actions={me.data?.role === "admin" && <Button variant="outline" onClick={demo} disabled={busy}>{busy ? "Cargando…" : "Cargar datos de ejemplo"}</Button>} />
      <Notice title="Prototipo con datos ficticios">No introduzcas nombres reales ni datos identificativos. Usa seudónimos o códigos como «P-014».</Notice>
      <div className="mt-6">
        {stats.isLoading ? <Loading /> : stats.error ? <ErrorBox error={stats.error} /> : (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: stats.data!.persons, l: "Personas atendidas", to: "/personas" as const },
              { n: stats.data!.pending, l: "Sin consentimiento otorgado", to: "/personas" as const },
              { n: stats.data!.plans, l: "Programaciones", to: "/programaciones" as const },
            ].map((s) => (
              <Link key={s.l} to={s.to} className="rounded-xl border bg-card p-6 shadow-soft hover:border-primary">
                <p className="font-display text-4xl">{s.n}</p><p className="text-muted-foreground">{s.l}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
