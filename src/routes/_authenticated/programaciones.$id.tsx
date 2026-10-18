import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Sparkles, Check, ClipboardCheck, FileDown, BookOpen, Images } from "lucide-react";
import { EasyReadDialog } from "@/components/EasyReadDialog";
import { usePictograms, usePictoUrls } from "@/lib/pictos";
import { useServerFn } from "@tanstack/react-start";
import { suggestPlan } from "@/lib/ai.functions";
import { dailyAgendaPdf, weeklyAgendaPdf } from "@/lib/pdf";
import { ObjectivesSection, AiBadge, DraftBadge, ApprovedInfo } from "@/components/ObjectivesSection";
import { ResultDialog } from "@/components/ResultDialog";
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
import { LibraryPictoView } from "@/components/LibraryPicto";
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
  const [aiOpen, setAiOpen] = useState(false);
  const [aiArea, setAiArea] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<{ clinical: string | null; rhythm: string } | null>(null);
  const [resultFor, setResultFor] = useState<Activity | null>(null);
  const suggest = useServerFn(suggestPlan);
  const [easyOpen, setEasyOpen] = useState(false);
  const [visual, setVisual] = useState(false);
  const pictos = usePictograms();
  const pictoPath = (pid: string | null) => pictos.data?.find((p) => p.id === pid)?.storage_path ?? null;

  const q = useQuery({
    queryKey: ["plan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*, persons(id, code, consent_status), parent:parent_id(id, title, level)").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Programación no encontrada");
      const [children, acts, objs, pobjs] = await Promise.all([
        supabase.from("plans").select("id, title, level, start_date, end_date").eq("parent_id", id).order("start_date"),
        supabase.from("plan_activities").select("*").eq("plan_id", id).order("day_of_week", { nullsFirst: true }).order("time_slot", { nullsFirst: true }).order("position"),
        supabase.from("plan_objectives").select("*").eq("plan_id", id).order("created_at"),
        data.parent_id ? supabase.from("plan_objectives").select("id, description").eq("plan_id", data.parent_id).eq("status", "aprobado") : Promise.resolve({ data: [], error: null }),
      ]);
      if (objs.error) throw objs.error;
      if (children.error) throw children.error;
      if (acts.error) throw acts.error;
      return { plan: data, children: children.data, acts: acts.data, objectives: objs.data, parentObjectives: (pobjs.data ?? []) as { id: string; description: string }[] };
    },
  });

  const pictoUrls = usePictoUrls((q.data?.acts ?? []).map((a) => pictoPath(a.pictogram_id)));
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
  const { plan, children, acts, objectives, parentObjectives } = q.data!;
  const approvedObjectives = objectives.filter((o) => o.status === "aprobado");
  const approvedActs = acts.filter((a) => a.status === "aprobado");
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
  async function runAi() {
    setAiBusy(true);
    try {
      const r = await suggest({ data: { planId: id, area: (aiArea || null) as "naturaleza" | null } });
      if (!r.ok) { toast.error(r.error); return; }
      setAiNote({ clinical: r.clinicalNote, rhythm: r.rhythm });
      toast.success(`Borradores creados: ${r.objectives} objetivos y ${r.activities} actividades. Revísalos y apruébalos.`);
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setAiBusy(false);
    }
  }
  async function approveActivity(aid: string) {
    const { error } = await supabase.rpc("approve_item", { _kind: "actividad", _id: aid });
    if (error) { toast.error(errMsg(error)); return; }
    await logEdit();
    toast.success("Actividad aprobada");
    refresh();
  }
  async function pdf() {
    const code = plan.persons?.code ?? "Plantilla";
    if (approvedActs.length === 0) { toast.error("No hay actividades aprobadas para exportar"); return; }
    if (plan.level === "diaria") dailyAgendaPdf(code, plan.title, fmtDate(plan.start_date), [...approvedActs].sort((a, b) => a.position - b.position).map((a) => ({ ...a, area: label(AREAS, a.area) })));
    else weeklyAgendaPdf(code, plan.title, `${fmtDate(plan.start_date)} – ${fmtDate(plan.end_date)}`, approvedActs.map((a) => ({ ...a, area: label(AREAS, a.area) })));
    if (plan.person_id) await supabase.rpc("log_access", { _person_id: plan.person_id, _action: "exportar_pdf" });
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
    <li className={`rounded-lg border p-4 ${a.status === "borrador" ? "border-dashed border-warning-foreground/50 bg-warning/30" : "bg-card"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{plan.level === "diaria" && <span className="mr-2 text-primary">{i + 1}.</span>}{a.time_slot && <span className="mr-2 text-muted-foreground">{a.time_slot.slice(0, 5)}</span>}{a.title}</p>
          {(a.ai_generated || a.status === "borrador") && <div className="my-1 flex flex-wrap gap-2">{a.ai_generated && <AiBadge />}{a.status === "borrador" && <DraftBadge />}</div>}
          <p className="text-sm text-muted-foreground">{label(AREAS, a.area)} · {a.duration_min ?? "?"} min · {a.support_level}{a.materials ? ` · ${a.materials}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {plan.level === "diaria" && <>
            <Button size="sm" variant="ghost" aria-label="Subir" onClick={() => move(a, -1)} disabled={i === 0}>↑</Button>
            <Button size="sm" variant="ghost" aria-label="Bajar" onClick={() => move(a, 1)} disabled={i === acts.length - 1}>↓</Button>
          </>}
          {a.status === "borrador" && <Button size="sm" onClick={() => approveActivity(a.id)}><Check className="mr-1 h-4 w-4" />Aprobar</Button>}
          {a.status === "aprobado" && plan.person_id && <Button size="sm" variant="outline" onClick={() => setResultFor(a)}><ClipboardCheck className="mr-1 h-4 w-4" />Resultado</Button>}
          <Button size="sm" variant="ghost" aria-label={`Editar ${a.title}`} onClick={() => { setEditing(a); setActOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" aria-label={`Eliminar ${a.title}`} onClick={() => delActivity(a.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {a.steps.length > 0 && <ol className="mt-2 list-decimal pl-6 text-sm">{a.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>}
      {a.adaptations && <p className="mt-2 text-sm"><span className="font-bold">Adaptaciones:</span> {a.adaptations}</p>}
      {a.objective_id && <p className="mt-1 text-sm text-muted-foreground">Objetivo: {objectives.find((o) => o.id === a.objective_id)?.description}</p>}
      {a.status === "aprobado" && a.ai_generated && <ApprovedInfo at={a.approved_at} />}
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
          {plan.person_id && <Button onClick={() => { setAiNote(null); setAiOpen(true); }}><Sparkles className="mr-2 h-4 w-4" />Sugerir con IA</Button>}
          {(plan.level === "semanal" || plan.level === "diaria") && <Button variant="outline" onClick={pdf}><FileDown className="mr-2 h-4 w-4" />Descargar PDF</Button>}
          {(plan.level === "semanal" || plan.level === "diaria") && <Button variant="outline" onClick={() => setEasyOpen(true)}><BookOpen className="mr-2 h-4 w-4" />Pasar a lectura fácil</Button>}
          {plan.level === "diaria" && <Button variant="outline" aria-pressed={visual} onClick={() => setVisual(!visual)}><Images className="mr-2 h-4 w-4" />{visual ? "Vista de lista" : "Ver con pictogramas"}</Button>}
          {plan.level === "semanal" && !plan.is_template && <Button variant="secondary" onClick={() => setDupOpen(true)}>Duplicar semana</Button>}
          {plan.is_template ? (parentLevel && <Button onClick={() => setApplyOpen(true)}>Aplicar a una persona</Button>)
            : <Button variant="outline" onClick={() => copyPlan({ asTemplate: true })}>Guardar como plantilla</Button>}
          <Button variant="ghost" onClick={deletePlan}>Eliminar</Button>
        </>} />
      {!consentOk && <div className="mb-4"><Notice title="Consentimiento no otorgado">No se pueden crear nuevas programaciones para esta persona.</Notice></div>}
      <ObjectivesSection planId={plan.id} centerId={plan.center_id} objectives={objectives} parentObjectives={parentObjectives} freeText={plan.objectives} onChange={refresh} onLog={() => { logEdit(); }} />

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
          : plan.level === "diaria" && visual ? (
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Agenda visual del día">
              {[...approvedActs].sort((a, b) => a.position - b.position).map((a, i) => {
                const u = pictoUrls.data?.[pictoPath(a.pictogram_id) ?? ""];
                return (
                  <li key={a.id} className="flex flex-col items-center rounded-2xl border-2 bg-card p-5 text-center">
                    <span className="text-lg font-bold text-primary">{i + 1}{a.time_slot ? ` · ${a.time_slot.slice(0, 5)}` : ""}</span>
                    {u ? <img src={u} alt="" className="my-3 h-40 w-40 object-contain" /> : a.library_picto ? <LibraryPictoView id={a.library_picto} size="lg" className="my-3" /> : <div className="my-3 flex h-40 w-40 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">Sin pictograma</div>}
                    <p className="text-2xl font-bold">{a.title}</p>
                  </li>
                );
              })}
              {approvedActs.length === 0 && <p className="text-muted-foreground">No hay actividades aprobadas.</p>}
            </ol>
          ) : plan.level === "semanal" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

      <ActivityDialog open={actOpen} onOpenChange={setActOpen} initial={editing as Partial<ActivityInput> | null} onSave={saveActivity} withSchedule={plan.level === "semanal"} objectives={approvedObjectives} title={editing?.id ? "Editar actividad" : "Nueva actividad"} />
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
      <EasyReadDialog open={easyOpen} onOpenChange={setEasyOpen} planId={plan.id} />
      <ResultDialog activity={resultFor} onClose={() => setResultFor(null)} />
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sugerir con IA</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Notice title="Qué se envía a la IA">Solo el tipo de discapacidad o trastorno, el rango de edad, los niveles de autonomía y el nivel de esta programación. Nunca el código, el centro, el diagnóstico ni los textos libres.</Notice>
            <Field id="ai-area" label="Área preferente (opcional)"><NativeSelect id="ai-area" value={aiArea} onChange={(e) => setAiArea(e.target.value)}><option value="">Cualquiera</option>{AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</NativeSelect></Field>
            <p className="text-sm text-muted-foreground">Las propuestas se guardan como borrador con la marca «Generado con IA». Debes revisarlas y aprobarlas. La IA no diagnostica ni recomienda tratamientos.</p>
            {aiNote && (
              <div className="space-y-2" role="status">
                {aiNote.clinical && <Notice tone="health" title="Requiere criterio profesional">{aiNote.clinical}</Notice>}
                <p><span className="font-bold">Ritmo propuesto:</span> {aiNote.rhythm}</p>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAiOpen(false)}>Cerrar</Button><Button onClick={runAi} disabled={aiBusy}>{aiBusy ? "Generando… (puede tardar un minuto)" : "Generar borrador"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
