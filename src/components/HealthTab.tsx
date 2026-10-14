import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, HeartPulse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms";
import { Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { errMsg, fmtDate } from "@/lib/constants";

type Med = { id: string; name: string; prescribed_regimen: string; prescriber: string | null; start_date: string | null; end_date: string | null; notes: string | null };
type Apt = { id: string; scheduled_at: string; specialty: string; place: string | null; notes: string | null; done: boolean };

export function MedicalDisclaimer() {
  return <Notice tone="health" title="Solo informativo"><span className="inline-flex items-start gap-2"><HeartPulse className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />Esta información se copia tal como la indica el profesional sanitario o la receta. Programiza no calcula dosis, no da recomendaciones sobre medicación y no sustituye la pauta médica. Ante cualquier duda, consulta al profesional que la prescribe.</span></Notice>;
}

const emptyMed = { name: "", prescribed_regimen: "", prescriber: "", start_date: "", end_date: "", notes: "" };
const emptyApt = { scheduled_at: "", specialty: "", place: "", notes: "", done: false };
const toLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export function HealthTab({ personId }: { personId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["health", personId],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_health", { _person_id: personId });
      if (error) throw error;
      return data as unknown as { medications: Med[]; appointments: Apt[] };
    },
  });
  const [m, setM] = useState(emptyMed); const [mId, setMId] = useState<string | null>(null);
  const [a, setA] = useState(emptyApt); const [aId, setAId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(kind: "medicacion" | "cita", id: string | null, d: Record<string, unknown>) {
    setBusy(true);
    const { error } = await supabase.rpc("save_sensitive", { _kind: kind, _person_id: personId, _id: id as string, _d: d as never });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return false; }
    toast.success("Guardado");
    qc.invalidateQueries({ queryKey: ["health", personId] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    return true;
  }
  async function del(kind: "medicacion" | "cita", id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    const { error } = await supabase.rpc("delete_sensitive", { _kind: kind, _person_id: personId, _id: id });
    if (error) { toast.error(errMsg(error)); return; }
    qc.invalidateQueries({ queryKey: ["health", personId] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
  }

  if (q.isLoading) return <Loading />;
  if (q.error) return <div className="mt-4"><ErrorBox error={q.error} /></div>;
  const { medications, appointments } = q.data!;

  return (
    <div className="mt-4 space-y-6">
      <MedicalDisclaimer />
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Medicación prescrita</h3>
        <form onSubmit={async (e) => { e.preventDefault(); if (!m.name.trim() || !m.prescribed_regimen.trim()) { toast.error("Indica el medicamento y la pauta"); return; } if (await save("medicacion", mId, m)) { setM(emptyMed); setMId(null); } }} className="grid gap-3 sm:grid-cols-2">
          <Field id="m1" label="Medicamento"><Input id="m1" value={m.name} maxLength={200} onChange={(e) => setM({ ...m, name: e.target.value })} /></Field>
          <Field id="m2" label="Pauta, copiada de la receta"><Input id="m2" value={m.prescribed_regimen} maxLength={500} onChange={(e) => setM({ ...m, prescribed_regimen: e.target.value })} /></Field>
          <Field id="m3" label="Prescrita por (servicio o especialidad)"><Input id="m3" value={m.prescriber} maxLength={200} onChange={(e) => setM({ ...m, prescriber: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="m4" label="Desde"><Input id="m4" type="date" value={m.start_date} onChange={(e) => setM({ ...m, start_date: e.target.value })} /></Field>
            <Field id="m5" label="Hasta"><Input id="m5" type="date" value={m.end_date} onChange={(e) => setM({ ...m, end_date: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2"><Field id="m6" label="Notas"><Textarea id="m6" rows={2} maxLength={1000} value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} /></Field></div>
          <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{mId ? "Guardar cambios" : "Añadir medicación"}</Button>{mId && <Button type="button" variant="outline" onClick={() => { setMId(null); setM(emptyMed); }}>Cancelar</Button>}</div>
        </form>
        {medications.length === 0 ? <Empty title="Sin medicación registrada" /> : (
          <ul className="space-y-2">{medications.map((x) => (
            <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
              <div><p className="font-bold">{x.name}</p><p>Pauta indicada: {x.prescribed_regimen}</p>
                <p className="text-sm text-muted-foreground">{x.prescriber ?? "—"} · {fmtDate(x.start_date)} – {fmtDate(x.end_date)}</p>{x.notes && <p className="text-sm">{x.notes}</p>}</div>
              <span>
                <Button size="sm" variant="ghost" aria-label={`Editar ${x.name}`} onClick={() => { setMId(x.id); setM({ name: x.name, prescribed_regimen: x.prescribed_regimen, prescriber: x.prescriber ?? "", start_date: x.start_date ?? "", end_date: x.end_date ?? "", notes: x.notes ?? "" }); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" aria-label={`Eliminar ${x.name}`} onClick={() => del("medicacion", x.id)}><Trash2 className="h-4 w-4" /></Button>
              </span>
            </li>
          ))}</ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Citas médicas</h3>
        <form onSubmit={async (e) => { e.preventDefault(); if (!a.scheduled_at || !a.specialty.trim()) { toast.error("Indica fecha y especialidad"); return; } if (await save("cita", aId, { ...a, scheduled_at: new Date(a.scheduled_at).toISOString() })) { setA(emptyApt); setAId(null); } }} className="grid gap-3 sm:grid-cols-2">
          <Field id="c1" label="Fecha y hora"><Input id="c1" type="datetime-local" value={a.scheduled_at} onChange={(e) => setA({ ...a, scheduled_at: e.target.value })} /></Field>
          <Field id="c2" label="Especialidad"><Input id="c2" value={a.specialty} maxLength={200} onChange={(e) => setA({ ...a, specialty: e.target.value })} /></Field>
          <Field id="c3" label="Lugar"><Input id="c3" value={a.place} maxLength={200} onChange={(e) => setA({ ...a, place: e.target.value })} /></Field>
          <Field id="c4" label="Notas"><Input id="c4" value={a.notes} maxLength={1000} onChange={(e) => setA({ ...a, notes: e.target.value })} /></Field>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={a.done} onChange={(e) => setA({ ...a, done: e.target.checked })} />Cita realizada</label>
          <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{aId ? "Guardar cambios" : "Añadir cita"}</Button>{aId && <Button type="button" variant="outline" onClick={() => { setAId(null); setA(emptyApt); }}>Cancelar</Button>}</div>
        </form>
        {appointments.length === 0 ? <Empty title="Sin citas" /> : (
          <ul className="space-y-2">{appointments.map((x) => (
            <li key={x.id} className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 ${x.done ? "opacity-70" : ""}`}>
              <div><p className="font-bold">{new Date(x.scheduled_at).toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" })}{x.done && " · Realizada"}</p><p>{x.specialty}{x.place ? ` · ${x.place}` : ""}</p>{x.notes && <p className="text-sm">{x.notes}</p>}</div>
              <span>
                <Button size="sm" variant="ghost" aria-label="Editar cita" onClick={() => { setAId(x.id); setA({ scheduled_at: toLocal(x.scheduled_at), specialty: x.specialty, place: x.place ?? "", notes: x.notes ?? "", done: x.done }); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" aria-label="Eliminar cita" onClick={() => del("cita", x.id)}><Trash2 className="h-4 w-4" /></Button>
              </span>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
