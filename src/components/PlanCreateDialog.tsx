import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/forms";
import { errMsg, label, LEVELS } from "@/lib/constants";

type Level = "anual" | "mensual" | "semanal" | "diaria";

export function PlanCreateDialog({ open, onOpenChange, level, personId, parentId, template }: {
  open: boolean; onOpenChange: (o: boolean) => void; level: Level; personId?: string | null; parentId?: string | null; template?: boolean;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [obj, setObj] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setTitle(""); setObj(""); setStart(""); setEnd(""); } }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("El título es obligatorio"); return; }
    if (!template && (!start || !end)) { toast.error("Indica fecha de inicio y fin"); return; }
    if (start && end && end < start) { toast.error("La fecha de fin no puede ser anterior al inicio"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("plans").insert({
      center_id: me.data!.center!.id, person_id: template ? null : personId ?? null, parent_id: template ? null : parentId ?? null,
      level, title: title.trim(), objectives: obj || null, start_date: start || null, end_date: end || null, is_template: !!template, created_by: me.data!.userId,
    }).select("id").single();
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Programación creada");
    qc.invalidateQueries({ queryKey: ["plans"] });
    onOpenChange(false);
    navigate({ to: "/programaciones/$id", params: { id: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{template ? "Nueva plantilla" : "Nueva programación"} · {label(LEVELS, level)}</DialogTitle></DialogHeader>
        <form id="plan-form" onSubmit={submit} className="space-y-4">
          <Field id="pl-title" label="Título"><Input id="pl-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} required /></Field>
          <Field id="pl-obj" label="Objetivos (uno por línea)"><Textarea id="pl-obj" rows={4} value={obj} onChange={(e) => setObj(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="pl-s" label="Inicio"><Input id="pl-s" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field id="pl-e" label="Fin"><Input id="pl-e" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
        </form>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" form="plan-form" disabled={busy}>{busy ? "Creando…" : "Crear"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
