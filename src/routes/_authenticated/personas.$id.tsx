import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HeartPulse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Field, NativeSelect } from "@/components/forms";
import { PageHeader, Loading, ErrorBox, Notice, Empty } from "@/components/states";
import { PlanCreateDialog } from "@/components/PlanCreateDialog";
import { AGE_RANGES, AUTONOMY_AREAS, AUTONOMY_LEVELS, CONSENT_BADGE, LEVELS, MAIN_TYPES, errMsg, fmtDate, label } from "@/lib/constants";

type Person = Database["public"]["Tables"]["persons"]["Row"];

export const Route = createFileRoute("/_authenticated/personas/$id")({
  head: () => ({ meta: [{ title: "Ficha de persona · Programiza" }, { name: "description", content: "Ficha funcional y consentimiento de la persona atendida." }, { property: "og:title", content: "Ficha de persona · Programiza" }, { property: "og:description", content: "Ficha funcional y consentimiento." }] }),
  component: PersonPage,
});

function PersonPage() {
  const { id } = Route.useParams();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logged = useRef<string | null>(null);
  const q = useQuery({
    queryKey: ["person", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("persons").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Ficha no encontrada o sin permiso");
      return data;
    },
  });
  const plans = useQuery({
    queryKey: ["plans", "person", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("id, title, level, start_date, end_date, parent_id").eq("person_id", id).order("start_date");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (q.data && logged.current !== id) {
      logged.current = id;
      supabase.rpc("log_access", { _person_id: id, _action: "abrir" });
    }
  }, [q.data, id]);

  const [f, setF] = useState<Person | null>(null);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  const [busy, setBusy] = useState(false);
  const [newPlan, setNewPlan] = useState(false);

  if (q.isLoading || (!f && !q.error)) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const p = f!;
  const saved = q.data!;
  const granted = saved.consent_status === "otorgado";
  const isAdmin = me.data?.role === "admin";
  const set = <K extends keyof Person>(k: K, v: Person[K]) => setF({ ...p, [k]: v });

  async function save(fields: Partial<Person>, msg = "Cambios guardados") {
    setBusy(true);
    const { error } = await supabase.from("persons").update(fields).eq("id", id);
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    await supabase.rpc("log_access", { _person_id: id, _action: "editar" });
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["person", id] });
    qc.invalidateQueries({ queryKey: ["persons"] });
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Z0-9-]{2,20}$/.test(p.code)) { toast.error("Código no válido (ej. P-014)"); return; }
    const fields: Partial<Person> = {
      code: p.code, age_range: p.age_range, main_type: p.main_type, autonomy: p.autonomy,
      supports: p.supports, communication: p.communication, likes: p.likes, sensitivities: p.sensitivities, routines: p.routines,
    };
    if (granted) fields.diagnosis = p.diagnosis || null;
    save(fields);
  }

  function saveConsent(e: React.FormEvent) {
    e.preventDefault();
    if (p.consent_status === "otorgado" && (!p.consent_grantor || !p.consent_date || !p.consent_purpose?.trim())) {
      toast.error("Para otorgar el consentimiento indica quién lo otorga, la fecha y la finalidad"); return;
    }
    save({ consent_status: p.consent_status, consent_grantor: p.consent_grantor, consent_date: p.consent_date, consent_purpose: p.consent_purpose }, "Consentimiento actualizado");
  }

  async function exportData() {
    const { data, error } = await supabase.rpc("export_person", { _person_id: id });
    if (error) { toast.error(errMsg(error)); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `export-${saved.code}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Exportación descargada");
  }
  async function anonymize() {
    const { error } = await supabase.rpc("anonymize_person", { _person_id: id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Persona anonimizada");
    qc.invalidateQueries();
  }
  async function remove() {
    await supabase.rpc("log_access", { _person_id: id, _action: "eliminar" });
    const { error } = await supabase.from("persons").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Persona eliminada por completo");
    qc.invalidateQueries();
    navigate({ to: "/personas" });
  }

  const autonomy = (p.autonomy ?? {}) as Record<string, string>;

  return (
    <div>
      <Link to="/personas" className="underline">← Personas</Link>
      <PageHeader title={saved.code} subtitle={`${label(MAIN_TYPES, saved.main_type)} · ${saved.age_range} años`}
        actions={<Badge className={`text-base ${CONSENT_BADGE[saved.consent_status]}`}>Consentimiento: {saved.consent_status}</Badge>} />
      {!granted && (
        <div className="mb-6"><Notice title="Consentimiento no otorgado">Mientras el consentimiento no esté «otorgado» no se puede guardar el diagnóstico ni crear programaciones. Regístralo en la pestaña Consentimiento.</Notice></div>
      )}
      {saved.anonymized && <div className="mb-6"><Notice tone="health" title="Ficha anonimizada">Esta persona ha sido anonimizada y sus datos funcionales se han eliminado.</Notice></div>}
      <Tabs defaultValue="perfil">
        <TabsList className="flex-wrap">
          <TabsTrigger value="perfil">Perfil funcional</TabsTrigger>
          <TabsTrigger value="consentimiento">Consentimiento</TabsTrigger>
          <TabsTrigger value="programaciones">Programaciones</TabsTrigger>
          {isAdmin && <TabsTrigger value="derechos">Derechos RGPD</TabsTrigger>}
        </TabsList>

        <TabsContent value="perfil">
          <form onSubmit={saveProfile} className="mt-4 space-y-6 rounded-xl border bg-card p-6">
            <Notice title="No escribas nombres reales">Usa solo el código. No añadas nombre, DNI, dirección, teléfono ni fecha de nacimiento en ningún campo.</Notice>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="code" label="Código"><Input id="code" value={p.code} maxLength={20} onChange={(e) => set("code", e.target.value.toUpperCase())} /></Field>
              <Field id="age" label="Rango de edad"><NativeSelect id="age" value={p.age_range} onChange={(e) => set("age_range", e.target.value)}>{[...AGE_RANGES, ...(AGE_RANGES.includes(p.age_range) ? [] : [p.age_range])].map((a) => <option key={a}>{a}</option>)}</NativeSelect></Field>
              <Field id="type" label="Tipo principal"><NativeSelect id="type" value={p.main_type} onChange={(e) => set("main_type", e.target.value)}>{MAIN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}{!MAIN_TYPES.some((t) => t.value === p.main_type) && <option>{p.main_type}</option>}</NativeSelect></Field>
            </div>
            <div className="rounded-lg border-2 border-health-foreground/40 bg-health/40 p-4">
              <p className="mb-2 flex items-center gap-2 font-bold text-health-foreground"><HeartPulse className="h-5 w-5" aria-hidden />Dato de salud</p>
              <Field id="diag" label="Diagnóstico" hint="Introduce solo lo imprescindible para programar. Requiere consentimiento otorgado.">
                <Textarea id="diag" aria-describedby="diag-hint" rows={3} maxLength={1000} disabled={!granted} value={p.diagnosis ?? ""} onChange={(e) => set("diagnosis", e.target.value)} placeholder={granted ? "" : "Bloqueado hasta que el consentimiento esté otorgado"} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-3 text-lg font-bold">Autonomía por área</legend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {AUTONOMY_AREAS.map((a) => (
                  <Field key={a.key} id={`au-${a.key}`} label={a.label}>
                    <NativeSelect id={`au-${a.key}`} value={autonomy[a.key] ?? ""} onChange={(e) => set("autonomy", { ...autonomy, [a.key]: e.target.value })}>
                      <option value="">Sin valorar</option>{AUTONOMY_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </NativeSelect>
                  </Field>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["supports", "Apoyos que necesita"], ["communication", "Forma de comunicación"], ["likes", "Gustos y preferencias"],
                ["sensitivities", "Sensibilidades (ruido, luz, tacto…)"], ["routines", "Rutinas"],
              ] as const).map(([k, l]) => (
                <Field key={k} id={k} label={l}><Textarea id={k} rows={2} maxLength={1000} value={(p[k] as string | null) ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>
              ))}
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar ficha"}</Button>
          </form>
        </TabsContent>

        <TabsContent value="consentimiento">
          <form onSubmit={saveConsent} className="mt-4 grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2">
            <Field id="cs" label="Estado"><NativeSelect id="cs" value={p.consent_status} onChange={(e) => set("consent_status", e.target.value as Person["consent_status"])}>
              <option value="pendiente">Pendiente</option><option value="otorgado">Otorgado</option><option value="retirado">Retirado</option></NativeSelect></Field>
            <Field id="cg" label="Quién lo otorga"><NativeSelect id="cg" value={p.consent_grantor ?? ""} onChange={(e) => set("consent_grantor", e.target.value || null)}>
              <option value="">Selecciona…</option><option value="persona">La propia persona</option><option value="representante">Representante legal</option></NativeSelect></Field>
            <Field id="cd" label="Fecha"><Input id="cd" type="date" value={p.consent_date ?? ""} onChange={(e) => set("consent_date", e.target.value || null)} /></Field>
            <Field id="cp" label="Finalidad"><Input id="cp" value={p.consent_purpose ?? ""} maxLength={300} onChange={(e) => set("consent_purpose", e.target.value)} placeholder="Planificación de apoyos y actividades" /></Field>
            <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar consentimiento"}</Button></div>
          </form>
        </TabsContent>

        <TabsContent value="programaciones">
          <div className="mt-4 space-y-4">
            <Button onClick={() => setNewPlan(true)} disabled={!granted}>Nueva programación anual</Button>
            {!granted && <p className="text-muted-foreground">Necesitas el consentimiento otorgado para crear programaciones.</p>}
            {plans.isLoading ? <Loading /> : plans.error ? <ErrorBox error={plans.error} /> : plans.data!.length === 0 ? <Empty title="Sin programaciones" /> : (
              <ul className="space-y-2">
                {plans.data!.map((pl) => (
                  <li key={pl.id}><Link to="/programaciones/$id" params={{ id: pl.id }} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 hover:border-primary">
                    <span><Badge variant="secondary" className="mr-2">{label(LEVELS, pl.level)}</Badge>{pl.title}</span>
                    <span className="text-sm text-muted-foreground">{fmtDate(pl.start_date)} – {fmtDate(pl.end_date)}</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </div>
          <PlanCreateDialog open={newPlan} onOpenChange={setNewPlan} level="anual" personId={id} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="derechos">
            <div className="mt-4 space-y-4 rounded-xl border bg-card p-6">
              <p>Ejercicio de derechos de la persona. Todas las acciones quedan registradas.</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={exportData}>Exportar todos sus datos (JSON)</Button>
                <Confirm label="Anonimizar" title="¿Anonimizar esta persona?" desc="Se borran diagnóstico, perfil funcional y consentimiento, y el código se sustituye por uno aleatorio. Las programaciones se conservan sin datos personales." onConfirm={anonymize} />
                <Confirm label="Eliminar por completo" title="¿Eliminar definitivamente?" desc="Se eliminarán la ficha y todas sus programaciones. No se puede deshacer." onConfirm={remove} destructive />
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Confirm({ label: l, title, desc, onConfirm, destructive }: { label: string; title: string; desc: string; onConfirm: () => void; destructive?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant={destructive ? "destructive" : "secondary"}>{l}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{desc}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>{l}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
