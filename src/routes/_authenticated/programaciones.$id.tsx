import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/forms";
import { PageHeader, Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { PlanCreateDialog } from "@/components/PlanCreateDialog";
import { ActivityDialog, type ActivityInput } from "@/components/ActivityDialog";
import { BankPicker } from "@/components/BankPicker";
import { AREAS, CHILD_LEVEL, DAYS, LEVELS, errMsg, fmtDate, label } from "@/lib/constants";

type Activity = Database["public"]["Tables"]["plan_activities"]["Row"];
const PARENT_LEVEL: Record<string, string | undefined> = { mensual: "anual", semanal: "mensual", diaria: "semanal" };

export const Route = createFileRoute("/_authenticated/programaciones/$id")({
  head: () => ({ meta: [{ title: "Programación · Programiza" }, { name: "description", content: "Detalle de la programación con actividades y niveles enlazados." }, { property: "og:title", content: "Programación · Programiza" }, { property: "og:description", content: "Detalle de la programación." }] }),
  component: PlanPage,
});

function PlanPage() {
  const { id } = Route.useParams();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [childOpen, setChildOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Activity> | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupDate, setDupDate] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [target, setTarget] = useState("");

  const q = useQuery({
    queryKey: ["plan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*, persons(id, code, consent_status), parent:parent_id(id, title, level)").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Programación no encontrada");
      const [children, acts] = await Promise.all([
        supabase.from("plans").select("id, title, level, start_date, end_date").eq("parent_id", id).order("start_date"),
        supabase.from("plan_activities").select("*").eq("plan_id", id).order("day_of_week", { nullsFirst: true }).order("time_slot", { nullsFirst: true }).order("position"),
      ]);
      if (children.error) throw children.error;
      if (acts.error) throw acts.error;
      return { plan: data, children: children.data, acts: acts.data };
    },
  });

  const parentLevel = q.data ? PARENT_LEVEL[q.data.plan.level] : undefined;
  const targets = useQuery({
    queryKey: ["plans", "targets", parentLevel],
    enabled: applyOpen && !!parentLevel,
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("id, title, person_id, persons(code)").eq("level", parentLevel as "anual").eq("is_template", false).order("title");
      if (error) throw error;
      return data;
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { plan, children, acts } = q.data!;
  const child = CHILD_LEVEL[plan.level];
  const parent = plan.parent as unknown as { id: string; title: string; level: string } | null;
  const consentOk = plan.is_template || plan.persons?.consent_status === "otorgado";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["plan", id] }); qc.invalidateQueries({ queryKey: ["plans"] }); };
  const logEdit = () => plan.person_id && supabase.rpc("log_access", { _person_id: plan.person_id, _action: "editar" });

  async function saveActivity(a: ActivityInput) {
    const row = { ...a, day_of_week: plan.level === "semanal" ? a.day_of_week ?? null : null };
    const { error } = editing?.id
      ? await supabase.from("plan_activities").update(row).eq("id", editing.id)
      : await supabase.from("plan_activities").insert({ ...row, plan_id: id, center_id: plan.center_id, position: acts.length });
    if (error) { toast.error(errMsg(error)); throw error; }
    await logEdit();
    toast.success("Actividad guardada");
    refresh();
  }
  async function delActivity(aid: string) {
    const { error } = await supabase.from("plan_activities").delete().eq("id", aid);
    if (error) { toast.error(errMsg(error)); return; }
    await logEdit();
    refresh();
  }
  async function move(a: Activity, dir: -1 | 1) {
    const i = acts.findIndex((x) => x.id === a.id);
    const b = acts[i + dir];
    if (!b) return;
    await Promise.all([
      supabase.from("plan_activities").update({ position: b.position === a.position ? i + dir : b.position }).eq("id", a.id),
      supabase.from("plan_activities").update({ position: b.position === a.position ? i : a.position }).eq("id", b.id),
    ]);
    refresh();
  }
  async function duplicate() {
    if (!dupDate) { toast.error("Elige la fecha de inicio de la nueva semana"); return; }
    const { data, error } = await supabase.rpc("duplicate_week", { _plan_id: id, _new_start: dupDate });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Semana duplicada");
    setDupOpen(false);
    refresh();
    navigate({ to: "/programaciones/$id", params: { id: data } });
  }
  async function copyPlan(opts: { asTemplate: boolean; parentId?: string; personId?: string | null }) {
    const { data, error } = await supabase.from("plans").insert({
      center_id: plan.center_id, level: plan.level, title: opts.asTemplate ? `Plantilla: ${plan.title}` : plan.title.replace(/^Plantilla:\s*/, ""),
      objectives: plan.objectives, is_template: opts.asTemplate, person_id: opts.personId ?? null, parent_id: opts.parentId ?? null,
      start_date: opts.asTemplate ? null : plan.start_date, end_date: opts.asTemplate ? null : plan.end_date, created_by: me.data!.userId,
    }).select("id").single();
    if (error) { toast.error(errMsg(error)); return; }
    if (acts.length) {
      const { error: e2 } = await supabase.from("plan_activities").insert(acts.map(({ id: _i, created_at: _c, plan_id: _p, ...rest }) => ({ ...rest, plan_id: data.id })));
      if (e2) { toast.error(errMsg(e2)); return; }
    }
    toast.success(opts.asTemplate ? "Guardada como plantilla" : "Plantilla aplicada");
    setApplyOpen(false);
    refresh();
    navigate({ to: "/programaciones/$id", params: { id: data.id } });
  }
  async function deletePlan() {
    if (!confirm("¿Eliminar esta programación y sus actividades?")) return;
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    await logEdit();
    toast.success("Programación eliminada");
    qc.invalidateQueries({ queryKey: ["plans"] });
    navigate({ to: plan.person_id ? "/personas/$id" : "/programaciones", params: { id: plan.person_id ?? "" } });
  }

  const ActRow = ({ a, i }: { a: Activity; i: number }) => (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{plan.level === "diaria" && <span className="mr-2 text-primary">{i + 1}.</span>}{a.time_slot && <span className="mr-2 text-muted-foreground">{a.time_slot.slice(0, 5)}</span>}{a.title}</p>
          <p className="text-sm text-muted-foreground">{label(AREAS, a.area)} · {a.duration_min ?? "?"} min · {a.support_level}{a.materials ? ` · ${a.materials}` : ""}</p>
        </div>
        <div className="flex gap-1">
          {plan.level === "diaria" && <>
            <Button size="sm" variant="ghost" aria-label="Subir" onClick={() => move(a, -1)} disabled={i === 0}>↑</Button>
            <Button size="sm" variant="ghost" aria-label="Bajar" onClick={() => move(a, 1)} disabled={i === acts.length - 1}>↓</Button>
          </>}
          <Button size="sm" variant="ghost" aria-label={`Editar ${a.title}`} onClick={() => { setEditing(a); setActOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" aria-label={`Eliminar ${a.title}`} onClick={() => delActivity(a.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {a.steps.length > 0 && <ol className="mt-2 list-decimal pl-6 text-sm">{a.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>}
      {a.adaptations && <p className="mt-2 text-sm"><span className="font-bold">Adaptaciones:</span> {a.adaptations}</p>}
    </li>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3 text-sm">
        {plan.persons && <Link to="/personas/$id" params={{ id: plan.persons.id }} className="underline">← {plan.persons.code}</Link>}
        {parent && <Link to="/programaciones/$id" params={{ id: parent.id }} className="underline">↑ {label(LEVELS, parent.level)}: {parent.title}</Link>}
        {plan.is_template && <Link to="/programaciones" className="underline">← Programaciones</Link>}
      </div>
      <PageHeader title={plan.title} subtitle={`${label(LEVELS, plan.level)}${plan.is_template ? " · Plantilla" : ""} · ${fmtDate(plan.start_date)} – ${fmtDate(plan.end_date)}`}
        actions={<>
          {plan.level === "semanal" && !plan.is_template && <Button variant="secondary" onClick={() => setDupOpen(true)}>Duplicar semana</Button>}
          {plan.is_template ? (parentLevel && <Button onClick={() => setApplyOpen(true)}>Aplicar a una persona</Button>)
            : <Button variant="outline" onClick={() => copyPlan({ asTemplate: true })}>Guardar como plantilla</Button>}
          <Button variant="ghost" onClick={deletePlan}>Eliminar</Button>
        </>} />
      {!consentOk && <div className="mb-4"><Notice title="Consentimiento no otorgado">No se pueden crear nuevas programaciones para esta persona.</Notice></div>}
      {plan.objectives && (
        <section className="mb-6 rounded-xl border bg-card p-5">
          <h2 className="mb-2 text-xl font-semibold">Objetivos</h2>
          <ul className="list-disc pl-6">{plan.objectives.split("\n").filter(Boolean).map((o, i) => <li key={i}>{o}</li>)}</ul>
        </section>
      )}

      {child && !plan.is_template && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Programaciones de nivel {label(LEVELS, child).toLowerCase()}</h2>
            <Button size="sm" onClick={() => setChildOpen(true)} disabled={!consentOk}>Añadir {label(LEVELS, child).toLowerCase()}</Button></div>
          {children.length === 0 ? <p className="text-muted-foreground">Todavía no hay ninguna.</p> : (
            <ul className="space-y-2">{children.map((c) => (
              <li key={c.id}><Link to="/programaciones/$id" params={{ id: c.id }} className="flex justify-between rounded-lg border bg-card p-3 hover:border-primary"><span>{c.title}</span><span className="text-sm text-muted-foreground">{fmtDate(c.start_date)}</span></Link></li>
            ))}</ul>
          )}
          <PlanCreateDialog open={childOpen} onOpenChange={setChildOpen} level={child} personId={plan.person_id} parentId={plan.id} />
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{plan.level === "diaria" ? "Secuencia del día" : plan.level === "semanal" ? "Horario semanal" : "Actividades principales"}</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBankOpen(true)}>Desde el banco</Button>
            <Button size="sm" onClick={() => { setEditing(null); setActOpen(true); }}>Nueva actividad</Button>
          </div>
        </div>
        {acts.length === 0 ? <Empty title="Sin actividades"><p>Añade una nueva o cópiala del banco de actividades.</p></Empty>
          : plan.level === "semanal" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {DAYS.map((d, di) => {
                const list = acts.filter((a) => a.day_of_week === di + 1);
                if (di >= 5 && list.length === 0) return null;
                return (
                  <div key={d} className="rounded-xl border bg-muted/40 p-3">
                    <h3 className="mb-2 font-bold">{d}</h3>
                    <ul className="space-y-2">{list.map((a) => <ActRow key={a.id} a={a} i={acts.indexOf(a)} />)}</ul>
                    {list.length === 0 && <p className="text-sm text-muted-foreground">Libre</p>}
                  </div>
                );
              })}
              {acts.some((a) => !a.day_of_week) && <div className="rounded-xl border p-3 md:col-span-2 xl:col-span-5"><h3 className="mb-2 font-bold">Sin día asignado</h3><ul className="space-y-2">{acts.filter((a) => !a.day_of_week).map((a) => <ActRow key={a.id} a={a} i={acts.indexOf(a)} />)}</ul></div>}
            </div>
          ) : (
            <ul className="space-y-2">{[...acts].sort((a, b) => a.position - b.position).map((a, i) => <ActRow key={a.id} a={a} i={i} />)}</ul>
          )}
      </section>

      <ActivityDialog open={actOpen} onOpenChange={setActOpen} initial={editing as Partial<ActivityInput> | null} onSave={saveActivity} withSchedule={plan.level === "semanal"} title={editing?.id ? "Editar actividad" : "Nueva actividad"} />
      <BankPicker open={bankOpen} onOpenChange={setBankOpen} onPick={(a) => { setEditing({ ...a } as Partial<Activity>); setActOpen(true); }} />

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Duplicar semana</DialogTitle></DialogHeader>
          <Field id="dup" label="Lunes de la nueva semana"><Input id="dup" type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setDupOpen(false)}>Cancelar</Button><Button onClick={duplicate}>Duplicar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aplicar plantilla</DialogTitle></DialogHeader>
          {targets.isLoading ? <Loading /> : targets.error ? <ErrorBox error={targets.error} /> : (
            <Field id="tgt" label={`Programación ${parentLevel} a la que se enlaza`}>
              <NativeSelect id="tgt" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Selecciona…</option>
                {(targets.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.persons?.code} · {t.title}</option>)}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setApplyOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const t = targets.data?.find((x) => x.id === target); if (!t) { toast.error("Elige una programación"); return; } copyPlan({ asTemplate: false, parentId: t.id, personId: t.person_id }); }}>Aplicar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Badge className="hidden" />
    </div>
  );
}
