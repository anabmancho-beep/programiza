import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/forms";
import { RESULTS, SUPPORT_LEVELS, errMsg } from "@/lib/constants";

export function ResultDialog({ activity, onClose }: { activity: { id: string; title: string; center_id: string; support_level: string | null } | null; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [result, setResult] = useState("lograda");
  const [support, setSupport] = useState("Supervisión");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (activity) { setDate(new Date().toISOString().slice(0, 10)); setResult("lograda"); setSupport(activity.support_level ?? "Supervisión"); setNotes(""); }
  }, [activity]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!activity) return;
    if (!date) { toast.error("Indica la fecha"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("activity_results").insert({
      center_id: activity.center_id, activity_id: activity.id, result_date: date, result: result as "lograda", support_used: support, notes: notes.trim() || null, created_by: me.data!.userId,
    }).select("person_id").single();
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    if (data.person_id) await supabase.rpc("log_access", { _person_id: data.person_id, _action: "seguimiento" });
    toast.success("Resultado registrado");
    qc.invalidateQueries({ queryKey: ["results"] });
    qc.invalidateQueries({ queryKey: ["plan"] });
    onClose();
  }

  return (
    <Dialog open={!!activity} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar resultado · {activity?.title}</DialogTitle></DialogHeader>
        <form id="res-form" onSubmit={save} className="space-y-4">
          <Field id="r-date" label="Fecha"><Input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <fieldset>
            <legend className="mb-2 font-medium">Resultado</legend>
            <div className="grid grid-cols-2 gap-2">
              {RESULTS.map((r) => (
                <label key={r.value} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${result === r.value ? "border-primary bg-secondary" : ""}`}>
                  <input type="radio" name="result" value={r.value} checked={result === r.value} onChange={() => setResult(r.value)} /> {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="r-sup" label="Nivel de apoyo usado"><NativeSelect id="r-sup" value={support} onChange={(e) => setSupport(e.target.value)}>{SUPPORT_LEVELS.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
          <Field id="r-notes" label="Observaciones" hint="No escribas nombres ni datos identificativos."><Textarea id="r-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </form>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form="res-form" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
