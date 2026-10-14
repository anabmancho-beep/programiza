import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/forms";
import { Loading, ErrorBox } from "@/components/states";
import { AREAS, label } from "@/lib/constants";
import type { ActivityInput } from "@/components/ActivityDialog";

export const bankQuery = {
  queryKey: ["bank"],
  queryFn: async () => {
    const { data, error } = await supabase.from("activity_bank").select("*").order("area").order("title");
    if (error) throw error;
    return data;
  },
};

export function BankPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (a: ActivityInput) => void }) {
  const q = useQuery({ ...bankQuery, enabled: open });
  const [area, setArea] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Añadir desde el banco</DialogTitle></DialogHeader>
        <NativeSelect aria-label="Filtrar por área" value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas las áreas</option>{AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</NativeSelect>
        {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
          <ul className="space-y-2">
            {q.data!.filter((a) => !area || a.area === area).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div><p className="font-bold">{a.title}</p><p className="text-sm text-muted-foreground">{label(AREAS, a.area)} · {a.duration_min ?? "?"} min</p></div>
                <Button size="sm" onClick={() => { onOpenChange(false); onPick({ title: a.title, area: a.area, duration_min: a.duration_min, support_level: a.support_level, materials: a.materials, steps: a.steps, adaptations: a.adaptations }); }}>Copiar y adaptar</Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
