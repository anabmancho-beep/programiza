import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/forms";
import { AREAS, errMsg, fmtDate, label } from "@/lib/constants";

export type Objective = Database["public"]["Tables"]["plan_objectives"]["Row"];

export function AiBadge() {
  return <Badge className="gap-1 bg-accent text-accent-foreground"><Sparkles className="h-3 w-3" aria-hidden />Generado con IA</Badge>;
}
export function DraftBadge() {
  return <Badge variant="outline" className="border-warning-foreground text-warning-foreground">Borrador</Badge>;
}
export function ApprovedInfo({ at }: { at: string | null }) {
  return at ? <span className="text-xs text-muted-foreground">Aprobado el {new Date(at).toLocaleString("es-ES")}</span> : null;
}

export function ObjectivesSection({ planId, centerId, objectives, parentObjectives, freeText, onChange, onLog }: {
  planId: string; centerId: string; objectives: Objective[]; parentObjectives: { id: string; description: string }[]; freeText: string | null; onChange: () => void; onLog: () => void;
}) {
  const [edit, setEdit] = useState<Partial<Objective> | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    if (!edit.description || edit.description.trim().length < 3) { toast.error("Describe el objetivo de forma concreta"); return; }
    if (!edit.indicator?.trim() || !edit.criterion?.trim() || !edit.deadline) { toast.error("Un objetivo medible necesita indicador, criterio de logro y fecha límite"); return; }
    setBusy(true);
    const row = { area: edit.area ?? "autonomia_personal", description: edit.description.trim(), indicator: edit.indicator.trim(), criterion: edit.criterion.trim(), deadline: edit.deadline, parent_objective_id: edit.parent_objective_id ?? null };
    const { error } = edit.id
      ? await supabase.from("plan_objectives").update(row).eq("id", edit.id)
      : await supabase.from("plan_objectives").insert({ ...row, plan_id: planId, center_id: centerId });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    onLog();
    setEdit(null);
    onChange();
  }
  async function approve(id: string) {
    const { error } = await supabase.rpc("approve_item", { _kind: "objetivo", _id: id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Objetivo aprobado");
    onLog(); onChange();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("plan_objectives").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    onLog(); onChange();
  }
  async function convert() {
    const lines = (freeText ?? "").split("\n").map((l) => l.trim()).filter((l) => l.length >= 3);
    if (!lines.length) return;
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    const { error } = await supabase.from("plan_objectives").insert(lines.map((l) => ({
      plan_id: planId, center_id: centerId, area: "autonomia_personal", description: l.slice(0, 500), indicator: "Por definir", criterion: "Por definir", deadline: d.toISOString().slice(0, 10),
    })));
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Objetivos creados: revisa indicador, criterio y plazo");
    onLog(); onChange();
  }

  return (
    <section className="mb-6 rounded-xl border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Objetivos medibles</h2>
        <div className="flex gap-2">
          {freeText && objectives.length === 0 && <Button size="sm" variant="outline" onClick={convert}>Convertir en objetivos medibles</Button>}
          <Button size="sm" onClick={() => setEdit({ area: "autonomia_personal" })}>Nuevo objetivo</Button>
        </div>
      </div>
      {freeText && (
        <details className="mb-3 text-sm"><summary className="cursor-pointer text-muted-foreground">Objetivos en texto libre</summary>
          <ul className="mt-2 list-disc pl-6">{freeText.split("\n").filter(Boolean).map((o, i) => <li key={i}>{o}</li>)}</ul></details>
      )}
      {objectives.length === 0 ? <p className="text-muted-foreground">Sin objetivos medibles todavía.</p> : (
        <ul className="space-y-2">
          {objectives.map((o) => (
            <li key={o.id} className={`rounded-lg border p-3 ${o.status === "borrador" ? "border-dashed border-warning-foreground/50 bg-warning/30" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{o.description}</span>
                    {o.ai_generated && <AiBadge />}{o.status === "borrador" && <DraftBadge />}
                  </div>
                  <p className="text-sm text-muted-foreground">{label(AREAS, o.area)} · Indicador: {o.indicator ?? "—"} · Criterio: {o.criterion ?? "—"} · Plazo: {fmtDate(o.deadline)}</p>
                  {o.status === "aprobado" && <ApprovedInfo at={o.approved_at} />}
                </div>
                <div className="flex gap-1">
                  {o.status === "borrador" && <Button size="sm" onClick={() => approve(o.id)}><Check className="mr-1 h-4 w-4" />Aprobar</Button>}
                  <Button size="sm" variant="ghost" aria-label="Editar objetivo" onClick={() => setEdit(o)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label={o.status === "borrador" ? "Descartar objetivo" : "Eliminar objetivo"} onClick={() => remove(o.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar objetivo" : "Nuevo objetivo"}</DialogTitle></DialogHeader>
          <form id="obj-form" onSubmit={save} className="space-y-3">
            <Field id="o-desc" label="Objetivo concreto" hint="Ej.: «Se lava las manos siguiendo la secuencia visual»"><Textarea id="o-desc" rows={2} maxLength={500} value={edit?.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field id="o-area" label="Área"><NativeSelect id="o-area" value={edit?.area ?? ""} onChange={(e) => setEdit({ ...edit, area: e.target.value })}>{AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</NativeSelect></Field>
            <Field id="o-ind" label="Indicador (cómo se mide)"><Input id="o-ind" maxLength={300} value={edit?.indicator ?? ""} onChange={(e) => setEdit({ ...edit, indicator: e.target.value })} /></Field>
            <Field id="o-cri" label="Criterio de logro (alcanzable)" hint="Ej.: «8 de cada 10 sesiones con supervisión»"><Input id="o-cri" maxLength={300} value={edit?.criterion ?? ""} onChange={(e) => setEdit({ ...edit, criterion: e.target.value })} /></Field>
            <Field id="o-dl" label="Fecha límite"><Input id="o-dl" type="date" value={edit?.deadline ?? ""} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} /></Field>
            {parentObjectives.length > 0 && (
              <Field id="o-par" label="Objetivo superior"><NativeSelect id="o-par" value={edit?.parent_objective_id ?? ""} onChange={(e) => setEdit({ ...edit, parent_objective_id: e.target.value || null })}><option value="">Ninguno</option>{parentObjectives.map((p) => <option key={p.id} value={p.id}>{p.description}</option>)}</NativeSelect></Field>
            )}
          </form>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button type="submit" form="obj-form" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
