import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms";
import { Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { errMsg } from "@/lib/constants";

type Rec = { id: string; occurred_at: string; antecedent: string; behavior: string; consequence: string; notes: string | null };
type Plan = { early_signs: string | null; what_helps: string | null; what_to_avoid: string | null; updated_at: string } | null;

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const emptyRec = () => ({ occurred_at: nowLocal(), antecedent: "", behavior: "", consequence: "", notes: "" });

export function BehaviorTab({ personId }: { personId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["behavior", personId],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_behavior_module", { _person_id: personId });
      if (error) throw error;
      return data as unknown as { records: Rec[]; plan: Plan };
    },
  });
  const [f, setF] = useState(emptyRec());
  const [editId, setEditId] = useState<string | null>(null);
  const [plan, setPlan] = useState({ early_signs: "", what_helps: "", what_to_avoid: "" });
  const [busy, setBusy] = useState(false);
  const init = useRef(false);
  useEffect(() => {
    if (q.data && !init.current) { init.current = true; const p = q.data.plan; setPlan({ early_signs: p?.early_signs ?? "", what_helps: p?.what_helps ?? "", what_to_avoid: p?.what_to_avoid ?? "" }); }
  }, [q.data]);

  async function save(kind: string, id: string | null, d: Record<string, unknown>, msg: string) {
    setBusy(true);
    const { error } = await supabase.rpc("save_sensitive", { _kind: kind, _person_id: personId, _id: id as string, _d: d as never });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return false; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["behavior", personId] });
    return true;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.antecedent.trim() || !f.behavior.trim() || !f.consequence.trim()) { toast.error("Rellena antecedente, conducta y consecuencia"); return; }
    if (await save("conducta", editId, { ...f, occurred_at: new Date(f.occurred_at).toISOString() }, editId ? "Registro actualizado" : "Registro guardado")) { setF(emptyRec()); setEditId(null); }
  }
  async function del(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    const { error } = await supabase.rpc("delete_sensitive", { _kind: "conducta", _person_id: personId, _id: id });
    if (error) { toast.error(errMsg(error)); return; }
    qc.invalidateQueries({ queryKey: ["behavior", personId] });
  }

  if (q.isLoading) return <Loading />;
  if (q.error) return <div className="mt-4"><ErrorBox error={q.error} /></div>;
  const recs = q.data!.records;

  return (
    <div className="mt-4 space-y-6">
      <Notice title="Acceso restringido"><span className="inline-flex items-center gap-1"><Lock className="h-4 w-4" aria-hidden />Solo profesionales y administración.</span> Cada apertura, alta, edición o borrado queda en el registro de accesos. Describe hechos observables, sin nombres ni juicios.</Notice>

      <form onSubmit={(e) => { e.preventDefault(); save("anticipacion", null, plan, "Plan de anticipación guardado"); }} className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Plan de anticipación</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Field id="pa1" label="Señales tempranas"><Textarea id="pa1" rows={4} maxLength={3000} value={plan.early_signs} onChange={(e) => setPlan({ ...plan, early_signs: e.target.value })} /></Field>
          <Field id="pa2" label="Qué ayuda"><Textarea id="pa2" rows={4} maxLength={3000} value={plan.what_helps} onChange={(e) => setPlan({ ...plan, what_helps: e.target.value })} /></Field>
          <Field id="pa3" label="Qué evitar"><Textarea id="pa3" rows={4} maxLength={3000} value={plan.what_to_avoid} onChange={(e) => setPlan({ ...plan, what_to_avoid: e.target.value })} /></Field>
        </div>
        <div className="flex items-center gap-3"><Button type="submit" disabled={busy}>Guardar plan</Button>{q.data!.plan && <span className="text-sm text-muted-foreground">Actualizado el {new Date(q.data!.plan.updated_at).toLocaleString("es-ES")}</span>}</div>
      </form>

      <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">{editId ? "Editar registro ABC" : "Nuevo registro ABC"}</h3>
        <Field id="ab0" label="Fecha y hora"><Input id="ab0" type="datetime-local" value={f.occurred_at} onChange={(e) => setF({ ...f, occurred_at: e.target.value })} required /></Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field id="ab1" label="A · Antecedente"><Textarea id="ab1" rows={3} maxLength={2000} value={f.antecedent} onChange={(e) => setF({ ...f, antecedent: e.target.value })} /></Field>
          <Field id="ab2" label="B · Conducta"><Textarea id="ab2" rows={3} maxLength={2000} value={f.behavior} onChange={(e) => setF({ ...f, behavior: e.target.value })} /></Field>
          <Field id="ab3" label="C · Consecuencia"><Textarea id="ab3" rows={3} maxLength={2000} value={f.consequence} onChange={(e) => setF({ ...f, consequence: e.target.value })} /></Field>
        </div>
        <Field id="ab4" label="Observaciones" hint="Sin nombres ni datos identificativos."><Textarea id="ab4" rows={2} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar registro"}</Button>{editId && <Button type="button" variant="outline" onClick={() => { setEditId(null); setF(emptyRec()); }}>Cancelar</Button>}</div>
      </form>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Registros</h3>
        {recs.length === 0 ? <Empty title="Sin registros de conducta" /> : (
          <ul className="space-y-2">{recs.map((r) => (
            <li key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{new Date(r.occurred_at).toLocaleString("es-ES")}</p>
                <span>
                  <Button size="sm" variant="ghost" aria-label="Editar registro" onClick={() => { setEditId(r.id); const d = new Date(r.occurred_at); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); setF({ occurred_at: d.toISOString().slice(0, 16), antecedent: r.antecedent, behavior: r.behavior, consequence: r.consequence, notes: r.notes ?? "" }); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Eliminar registro" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </div>
              <dl className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                <div><dt className="font-bold">Antecedente</dt><dd>{r.antecedent}</dd></div>
                <div><dt className="font-bold">Conducta</dt><dd>{r.behavior}</dd></div>
                <div><dt className="font-bold">Consecuencia</dt><dd>{r.consequence}</dd></div>
              </dl>
              {r.notes && <p className="mt-2 text-sm"><span className="font-bold">Observaciones:</span> {r.notes}</p>}
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
