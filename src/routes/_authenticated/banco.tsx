import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/forms";
import { PageHeader, Loading, ErrorBox, Empty } from "@/components/states";
import { ActivityDialog, type ActivityInput } from "@/components/ActivityDialog";
import { bankQuery } from "@/components/BankPicker";
import { AREAS, LEVELS, errMsg, label } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/banco")({
  head: () => ({ meta: [{ title: "Banco de actividades · Programiza" }, { name: "description", content: "Biblioteca de actividades por área, incluidas actividades de naturaleza." }, { property: "og:title", content: "Banco de actividades · Programiza" }, { property: "og:description", content: "Biblioteca de actividades por área." }] }),
  component: Banco,
});

function Banco() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery(bankQuery);
  const [area, setArea] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [copySrc, setCopySrc] = useState<ActivityInput | null>(null);
  const [planId, setPlanId] = useState("");
  const [adaptOpen, setAdaptOpen] = useState(false);
  const plans = useQuery({
    queryKey: ["plans", "copy-targets"],
    enabled: !!copySrc,
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("id, title, level, center_id, persons(code)").order("title");
      if (error) throw error;
      return data;
    },
  });
  const target = plans.data?.find((p) => p.id === planId);

  async function addToBank(a: ActivityInput) {
    const { error } = await supabase.from("activity_bank").insert({ ...a, center_id: me.data!.center!.id });
    if (error) { toast.error(errMsg(error)); throw error; }
    toast.success("Añadida al banco del centro");
    qc.invalidateQueries({ queryKey: ["bank"] });
  }
  async function copyTo(a: ActivityInput) {
    if (!target) return;
    const { error } = await supabase.from("plan_activities").insert({ ...a, day_of_week: target.level === "semanal" ? a.day_of_week ?? null : null, plan_id: target.id, center_id: target.center_id, position: 999 });
    if (error) { toast.error(errMsg(error)); throw error; }
    toast.success("Actividad copiada a la programación");
    setCopySrc(null);
    navigate({ to: "/programaciones/$id", params: { id: target.id } });
  }

  return (
    <div>
      <PageHeader title="Banco de actividades" subtitle="Actividades genéricas y ficticias. Cópialas a una programación y adáptalas."
        actions={<Button onClick={() => setNewOpen(true)}>Nueva actividad del centro</Button>} />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por área">
        <Button size="sm" variant={area === "" ? "default" : "outline"} onClick={() => setArea("")}>Todas</Button>
        {AREAS.map((a) => <Button key={a.value} size="sm" variant={area === a.value ? "default" : "outline"} aria-pressed={area === a.value} onClick={() => setArea(a.value)}>{a.label}</Button>)}
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (() => {
        const list = q.data!.filter((a) => !area || a.area === area);
        if (!list.length) return <Empty title="No hay actividades en esta área" />;
        return (
          <ul className="grid gap-4 md:grid-cols-2">
            {list.map((a) => (
              <li key={a.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-soft">
                <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-semibold">{a.title}</h2>{a.center_id ? <Badge variant="secondary">Del centro</Badge> : <Badge variant="outline">Genérica</Badge>}</div>
                <p className="text-sm text-muted-foreground">{label(AREAS, a.area)} · {a.duration_min ?? "?"} min · {a.support_level}</p>
                {a.materials && <p className="mt-1 text-sm">Materiales: {a.materials}</p>}
                <ol className="mt-2 flex-1 list-decimal pl-6 text-sm">{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                {a.adaptations && <p className="mt-2 text-sm"><span className="font-bold">Adaptaciones:</span> {a.adaptations}</p>}
                <Button className="mt-4 self-start" variant="secondary" onClick={() => { setPlanId(""); setCopySrc({ title: a.title, area: a.area, duration_min: a.duration_min, support_level: a.support_level, materials: a.materials, steps: a.steps, adaptations: a.adaptations }); }}>Copiar a una programación</Button>
              </li>
            ))}
          </ul>
        );
      })()}

      <ActivityDialog open={newOpen} onOpenChange={setNewOpen} onSave={addToBank} title="Nueva actividad del banco" />
      <Dialog open={!!copySrc && !adaptOpen} onOpenChange={(o) => !o && setCopySrc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Copiar «{copySrc?.title}»</DialogTitle></DialogHeader>
          {plans.isLoading ? <Loading /> : plans.error ? <ErrorBox error={plans.error} /> : plans.data!.length === 0 ? <p>No hay programaciones todavía.</p> : (
            <Field id="tp" label="Programación de destino">
              <NativeSelect id="tp" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Selecciona…</option>
                {plans.data!.map((p) => <option key={p.id} value={p.id}>{p.persons?.code ?? "Plantilla"} · {label(LEVELS, p.level)} · {p.title}</option>)}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setCopySrc(null)}>Cancelar</Button>
            <Button disabled={!planId} onClick={() => setAdaptOpen(true)}>Adaptar y copiar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ActivityDialog open={adaptOpen} onOpenChange={(o) => { setAdaptOpen(o); }} initial={copySrc} onSave={copyTo} withSchedule={target?.level === "semanal"} title="Adaptar actividad" />
    </div>
  );
}
