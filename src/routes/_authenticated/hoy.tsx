import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { usePictograms, usePictoUrls } from "@/lib/pictos";
import { PageHeader, Loading, ErrorBox, Empty } from "@/components/states";
import { RESULTS, errMsg } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/hoy")({
  head: () => ({ meta: [{ title: "Hoy · Programiza" }, { name: "description", content: "Actividades del día de cada persona con registro rápido de resultados." }, { property: "og:title", content: "Hoy · Programiza" }, { property: "og:description", content: "Vista móvil de las actividades del día." }] }),
  component: Hoy,
});

const localToday = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const BTN: Record<string, string> = {
  lograda: "bg-success text-success-foreground",
  lograda_con_apoyo: "bg-secondary text-secondary-foreground",
  no_lograda: "bg-warning text-warning-foreground",
  no_realizada: "bg-muted text-foreground",
};

function Hoy() {
  const me = useMe();
  const qc = useQueryClient();
  const today = localToday();
  const dow = ((new Date().getDay() + 6) % 7) + 1;
  const [busy, setBusy] = useState<string | null>(null);
  const pictos = usePictograms();
  const q = useQuery({
    queryKey: ["hoy", today],
    queryFn: async () => {
      const { data: plans, error } = await supabase.from("plans").select("id, level, person_id, persons(id, code, consent_status)")
        .eq("is_template", false).in("level", ["diaria", "semanal"]).lte("start_date", today).gte("end_date", today).not("person_id", "is", null);
      if (error) throw error;
      const valid = plans.filter((p) => p.persons?.consent_status === "otorgado");
      if (!valid.length) return [];
      const { data: acts, error: e2 } = await supabase.from("plan_activities").select("id, plan_id, title, time_slot, day_of_week, position, center_id, support_level, pictogram_id")
        .in("plan_id", valid.map((p) => p.id)).eq("status", "aprobado");
      if (e2) throw e2;
      const todays = acts.filter((a) => { const pl = valid.find((p) => p.id === a.plan_id)!; return pl.level === "diaria" || a.day_of_week === dow; });
      const { data: res, error: e3 } = todays.length
        ? await supabase.from("activity_results").select("activity_id, result").eq("result_date", today).in("activity_id", todays.map((a) => a.id))
        : { data: [], error: null };
      if (e3) throw e3;
      const byPerson = new Map<string, { id: string; code: string; acts: (typeof todays[number] & { done: string | undefined })[] }>();
      for (const a of todays) {
        const p = valid.find((x) => x.id === a.plan_id)!.persons!;
        const entry = byPerson.get(p.id) ?? { id: p.id, code: p.code, acts: [] };
        entry.acts.push({ ...a, done: res?.find((r) => r.activity_id === a.id)?.result });
        byPerson.set(p.id, entry);
      }
      return [...byPerson.values()].sort((a, b) => a.code.localeCompare(b.code)).map((p) => ({
        ...p, acts: p.acts.sort((a, b) => (a.time_slot ?? "99").localeCompare(b.time_slot ?? "99") || a.position - b.position),
      }));
    },
  });
  const pathOf = (pid: string | null) => pictos.data?.find((p) => p.id === pid)?.storage_path ?? null;
  const urls = usePictoUrls((q.data ?? []).flatMap((p) => p.acts.map((a) => pathOf(a.pictogram_id))));

  async function record(a: { id: string; center_id: string; support_level: string | null }, personId: string, result: string) {
    setBusy(a.id);
    const { error } = await supabase.from("activity_results").insert({
      center_id: a.center_id, activity_id: a.id, result_date: today, result: result as "lograda", support_used: a.support_level, created_by: me.data!.userId,
    });
    setBusy(null);
    if (error) { toast.error(errMsg(error)); return; }
    await supabase.rpc("log_access", { _person_id: personId, _action: "seguimiento" });
    toast.success("Resultado registrado");
    qc.invalidateQueries({ queryKey: ["hoy", today] });
    qc.invalidateQueries({ queryKey: ["results"] });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Hoy" subtitle={new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : q.data!.length === 0 ? <Empty title="No hay actividades aprobadas para hoy"><p>Aparecen las de las programaciones diarias de hoy y las semanales que incluyen este día.</p></Empty> : (
        <div className="space-y-8">
          {q.data!.map((p) => (
            <section key={p.id} aria-labelledby={`h-${p.id}`}>
              <h2 id={`h-${p.id}`} className="mb-3 text-2xl font-semibold"><Link to="/personas/$id" params={{ id: p.id }} className="underline-offset-4 hover:underline">{p.code}</Link></h2>
              <ul className="space-y-4">
                {p.acts.map((a) => {
                  const u = urls.data?.[pathOf(a.pictogram_id) ?? ""];
                  return (
                    <li key={a.id} className="rounded-2xl border bg-card p-4">
                      <div className="flex items-center gap-3">
                        {u && <img src={u} alt="" className="h-16 w-16 shrink-0 rounded object-contain" />}
                        <div>
                          {a.time_slot && <p className="text-muted-foreground">{a.time_slot.slice(0, 5)}</p>}
                          <p className="text-xl font-bold">{a.title}</p>
                        </div>
                      </div>
                      {a.done ? (
                        <p className="mt-3 flex items-center gap-2 font-bold text-success-foreground" role="status"><CheckCircle2 className="h-6 w-6" aria-hidden />Registrado: {RESULTS.find((r) => r.value === a.done)?.label}</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={`Resultado de ${a.title}`}>
                          {RESULTS.map((r) => (
                            <button key={r.value} disabled={busy === a.id} onClick={() => record(a, p.id, r.value)}
                              className={`min-h-14 rounded-xl px-3 py-3 text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${BTN[r.value]}`}>{r.label}</button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
