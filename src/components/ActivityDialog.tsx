import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/forms";
import { AREAS, DAYS, SUPPORT_LEVELS } from "@/lib/constants";
import { usePictograms, usePictoUrls } from "@/lib/pictos";

export type ActivityInput = {
  title: string;
  area: string;
  duration_min: number | null;
  support_level: string | null;
  materials: string | null;
  steps: string[];
  adaptations: string | null;
  day_of_week?: number | null;
  time_slot?: string | null;
  objective_id?: string | null;
  pictogram_id?: string | null;
};

const empty: ActivityInput = { title: "", area: "autonomia_personal", duration_min: 30, support_level: "Supervisión", materials: "", steps: [], adaptations: "", day_of_week: null, time_slot: "" };

export function ActivityDialog({
  open, onOpenChange, initial, onSave, withSchedule, title = "Actividad", objectives,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<ActivityInput> | null;
  onSave: (a: ActivityInput) => Promise<void>;
  withSchedule?: boolean;
  title?: string;
  objectives?: { id: string; description: string }[];
}) {
  const [a, setA] = useState<ActivityInput>(empty);
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const pictos = usePictograms(open);
  const pictoUrls = usePictoUrls((pictos.data ?? []).map((p) => p.storage_path));

  useEffect(() => {
    if (open) {
      const v = { ...empty, ...(initial ?? {}) } as ActivityInput;
      setA(v);
      setSteps((v.steps ?? []).join("\n"));
    }
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!a.title.trim()) { toast.error("El título es obligatorio"); return; }
    if (a.duration_min != null && (a.duration_min < 1 || a.duration_min > 600)) { toast.error("La duración debe estar entre 1 y 600 minutos"); return; }
    if (a.time_slot && !/^\d{2}:\d{2}$/.test(a.time_slot)) { toast.error("La franja debe tener formato HH:MM"); return; }
    setBusy(true);
    try {
      await onSave({
        ...a,
        title: a.title.trim(),
        steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
        materials: a.materials || null,
        adaptations: a.adaptations || null,
        time_slot: a.time_slot || null,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" id="act-form">
          <div className="sm:col-span-2"><Field id="a-title" label="Título"><Input id="a-title" value={a.title} maxLength={160} onChange={(e) => setA({ ...a, title: e.target.value })} required /></Field></div>
          <Field id="a-area" label="Área"><NativeSelect id="a-area" value={a.area} onChange={(e) => setA({ ...a, area: e.target.value })}>{AREAS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</NativeSelect></Field>
          <Field id="a-dur" label="Duración (minutos)"><Input id="a-dur" type="number" min={1} max={600} value={a.duration_min ?? ""} onChange={(e) => setA({ ...a, duration_min: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field id="a-sup" label="Nivel de apoyo"><NativeSelect id="a-sup" value={a.support_level ?? ""} onChange={(e) => setA({ ...a, support_level: e.target.value })}>{SUPPORT_LEVELS.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Field>
          <Field id="a-mat" label="Materiales"><Input id="a-mat" value={a.materials ?? ""} maxLength={300} onChange={(e) => setA({ ...a, materials: e.target.value })} /></Field>
          {withSchedule && (
            <>
              <Field id="a-day" label="Día"><NativeSelect id="a-day" value={a.day_of_week ?? ""} onChange={(e) => setA({ ...a, day_of_week: e.target.value ? Number(e.target.value) : null })}><option value="">Sin día</option>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</NativeSelect></Field>
              <Field id="a-slot" label="Franja (HH:MM)"><Input id="a-slot" type="time" value={a.time_slot ?? ""} onChange={(e) => setA({ ...a, time_slot: e.target.value })} /></Field>
            </>
          )}
          {!withSchedule && a.time_slot !== undefined && (
            <Field id="a-slot2" label="Hora (opcional)"><Input id="a-slot2" type="time" value={a.time_slot ?? ""} onChange={(e) => setA({ ...a, time_slot: e.target.value })} /></Field>
          )}
          {objectives && objectives.length > 0 && (
            <div className="sm:col-span-2"><Field id="a-obj" label="Objetivo al que contribuye"><NativeSelect id="a-obj" value={a.objective_id ?? ""} onChange={(e) => setA({ ...a, objective_id: e.target.value || null })}><option value="">Ninguno</option>{objectives.map((o) => <option key={o.id} value={o.id}>{o.description}</option>)}</NativeSelect></Field></div>
          )}
          <div className="sm:col-span-2">
            <Field id="a-picto" label="Pictograma (opcional)" hint="Imágenes subidas por el centro en «Pictogramas».">
              <div className="flex items-center gap-3">
                <NativeSelect id="a-picto" value={a.pictogram_id ?? ""} onChange={(e) => setA({ ...a, pictogram_id: e.target.value || null })}>
                  <option value="">Sin pictograma</option>
                  {(pictos.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </NativeSelect>
                {(() => { const p = pictos.data?.find((x) => x.id === a.pictogram_id); const u = p && pictoUrls.data?.[p.storage_path]; return u ? <img src={u} alt="" className="h-14 w-14 rounded border object-contain" /> : null; })()}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2"><Field id="a-steps" label="Pasos (uno por línea)"><Textarea id="a-steps" rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field id="a-adapt" label="Adaptaciones" hint="Describe apoyos, no datos identificativos."><Textarea id="a-adapt" rows={2} maxLength={1000} value={a.adaptations ?? ""} onChange={(e) => setA({ ...a, adaptations: e.target.value })} /></Field></div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="act-form" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
