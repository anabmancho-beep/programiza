import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { draftReport } from "@/lib/ai.functions";
import { reportPdf } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms";
import { Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { AiBadge, DraftBadge } from "@/components/ObjectivesSection";
import { errMsg, fmtDate } from "@/lib/constants";

export function ReportsTab({ personId, code }: { personId: string; code: string }) {
  const qc = useQueryClient();
  const gen = useServerFn(draftReport);
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["reports", personId],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("person_id", personId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const team = useQuery({ queryKey: ["team-names"], queryFn: async () => (await supabase.from("profiles").select("id, display_name")).data ?? [] });
  const who = (id: string | null) => team.data?.find((t) => t.id === id)?.display_name ?? "—";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to || to < from) { toast.error("Revisa el periodo"); return; }
    setBusy(true);
    try {
      const r = await gen({ data: { personId, from, to } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Borrador de informe creado");
      qc.invalidateQueries({ queryKey: ["reports", personId] });
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  }
  async function saveText(id: string) {
    const { error } = await supabase.from("reports").update({ content: editing[id] ?? "" }).eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    await supabase.rpc("log_access", { _person_id: personId, _action: "editar" });
    setEditing((s) => { const n = { ...s }; delete n[id]; return n; });
    qc.invalidateQueries({ queryKey: ["reports", personId] });
  }
  async function approve(id: string) {
    const { error } = await supabase.rpc("approve_item", { _kind: "informe", _id: id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Informe aprobado");
    qc.invalidateQueries({ queryKey: ["reports", personId] });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    qc.invalidateQueries({ queryKey: ["reports", personId] });
  }

  return (
    <div className="mt-4 space-y-4">
      <form onSubmit={create} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-5">
        <Field id="rf" label="Desde"><Input id="rf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field id="rt" label="Hasta"><Input id="rt" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button type="submit" disabled={busy}>{busy ? "Redactando… (puede tardar)" : "Nuevo informe"}</Button>
        <p className="basis-full text-sm text-muted-foreground">La IA solo recibe recuentos de resultados por área, objetivo y mes. No recibe el código, las observaciones ni el diagnóstico.</p>
      </form>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : q.data!.length === 0 ? <Empty title="Sin informes" /> : q.data!.map((r) => (
        <article key={r.id} className={`rounded-xl border p-5 ${r.status === "borrador" ? "border-dashed border-warning-foreground/50 bg-warning/20" : "bg-card"}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{fmtDate(r.period_start)} – {fmtDate(r.period_end)}</h3>{r.ai_generated && <AiBadge />}{r.status === "borrador" && <DraftBadge />}</div>
            <div className="flex flex-wrap gap-2">
              {r.status === "borrador" && <Button size="sm" onClick={() => approve(r.id)}><Check className="mr-1 h-4 w-4" />Aprobar</Button>}
              {r.status === "aprobado" && <Button size="sm" variant="outline" onClick={async () => {
                reportPdf(code, `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`, r.content, r.stats as never, `Aprobado por ${who(r.approved_by)} el ${new Date(r.approved_at!).toLocaleDateString("es-ES")}`);
                await supabase.rpc("log_access", { _person_id: personId, _action: "exportar_pdf" });
              }}><FileDown className="mr-1 h-4 w-4" />Descargar PDF</Button>}
              {editing[r.id] === undefined && <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, [r.id]: r.content })}>Editar</Button>}
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>{r.status === "borrador" ? "Descartar" : "Eliminar"}</Button>
            </div>
          </div>
          {r.status === "borrador" && r.ai_generated && <div className="mb-3"><Notice title="Revisa antes de aprobar">Comprueba que el texto coincide con las cifras de seguimiento.</Notice></div>}
          {editing[r.id] !== undefined ? (
            <div className="space-y-2"><Textarea rows={10} value={editing[r.id]} onChange={(e) => setEditing({ ...editing, [r.id]: e.target.value })} aria-label="Texto del informe" />
              <Button size="sm" onClick={() => saveText(r.id)}>Guardar texto</Button></div>
          ) : <div className="whitespace-pre-line">{r.content}</div>}
          {r.status === "aprobado" && <p className="mt-3 text-sm text-muted-foreground">Aprobado por {who(r.approved_by)} el {new Date(r.approved_at!).toLocaleString("es-ES")}</p>}
        </article>
      ))}
    </div>
  );
}
