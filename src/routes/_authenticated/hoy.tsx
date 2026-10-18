import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CloudOff, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { usePictograms, usePictoUrls } from "@/lib/pictos";
import { PageHeader, Loading, ErrorBox, Empty } from "@/components/states";
import { RESULTS, errMsg } from "@/lib/constants";
import { saveCache, readCache, readQueue, enqueue, flushQueue, isNetworkError, type PendingResult } from "@/lib/offline-hoy";

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

type HoyAct = { id: string; plan_id: string; title: string; time_slot: string | null; day_of_week: number | null; position: number; center_id: string; support_level: string | null; pictogram_id: string | null; library_picto: string | null; done: string | undefined };
type HoyPerson = { id: string; code: string; acts: HoyAct[] };

async function fetchHoy(today: string, dow: number): Promise<HoyPerson[]> {
  const { data: plans, error } = await supabase.from("plans").select("id, level, person_id, persons(id, code, consent_status)")
    .eq("is_template", false).in("level", ["diaria", "semanal"]).lte("start_date", today).gte("end_date", today).not("person_id", "is", null);
  if (error) throw error;
  const valid = plans.filter((p) => p.persons?.consent_status === "otorgado");
  if (!valid.length) return [];
  const { data: acts, error: e2 } = await supabase.from("plan_activities").select("id, plan_id, title, time_slot, day_of_week, position, center_id, support_level, pictogram_id, library_picto")
    .in("plan_id", valid.map((p) => p.id)).eq("status", "aprobado");
  if (e2) throw e2;
  const todays = acts.filter((a) => { const pl = valid.find((p) => p.id === a.plan_id)!; return pl.level === "diaria" || a.day_of_week === dow; });
  const { data: res, error: e3 } = todays.length
    ? await supabase.from("activity_results").select("activity_id, result").eq("result_date", today).in("activity_id", todays.map((a) => a.id))
    : { data: [], error: null };
  if (e3) throw e3;
  const byPerson = new Map<string, HoyPerson>();
  for (const a of todays) {
    const p = valid.find((x) => x.id === a.plan_id)!.persons!;
    const entry = byPerson.get(p.id) ?? { id: p.id, code: p.code, acts: [] };
    entry.acts.push({ ...a, done: res?.find((r) => r.activity_id === a.id)?.result });
    byPerson.set(p.id, entry);
  }
  return [...byPerson.values()].sort((a, b) => a.code.localeCompare(b.code)).map((p) => ({
    ...p, acts: p.acts.sort((a, b) => (a.time_slot ?? "99").localeCompare(b.time_slot ?? "99") || a.position - b.position),
  }));
}

function Hoy() {
  const me = useMe();
  const uid = me.data?.userId ?? "";
  const qc = useQueryClient();
  const today = localToday();
  const dow = ((new Date().getDay() + 6) % 7) + 1;
  const [busy, setBusy] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<PendingResult[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const pictos = usePictograms();

  useEffect(() => {
    if (!uid) return;
    setOnline(navigator.onLine);
    setPending(readQueue(uid));
    const sync = async () => {
      setOnline(navigator.onLine);
      const n = await flushQueue(uid);
      setPending(readQueue(uid));
      if (n) {
        toast.success(n === 1 ? "1 resultado sincronizado" : `${n} resultados sincronizados`);
        qc.invalidateQueries({ queryKey: ["hoy"] });
        qc.invalidateQueries({ queryKey: ["results"] });
      }
    };
    const off = () => setOnline(false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", off); };
  }, [uid, qc]);

  const q = useQuery({
    queryKey: ["hoy", today, uid],
    enabled: !!uid,
    networkMode: "always",
    retry: (n, e) => !isNetworkError(e) && n < 2,
    queryFn: async (): Promise<HoyPerson[]> => {
      try {
        if (!navigator.onLine) throw new Error("network offline");
        const r = await fetchHoy(today, dow);
        saveCache(uid, today, r);
        setFromCache(false);
        return r;
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        const c = readCache<HoyPerson[]>(uid, today);
        if (c) { setFromCache(true); return c; }
        throw new Error("Sin conexión y sin copia guardada de hoy. Abre esta página con conexión al menos una vez al día.");
      }
    },
  });

  const pathOf = (pid: string | null) => pictos.data?.find((p) => p.id === pid)?.storage_path ?? null;
  const urls = usePictoUrls((q.data ?? []).flatMap((p) => p.acts.map((a) => pathOf(a.pictogram_id))));
  const pendingOf = (id: string) => pending.find((r) => r.activity_id === id && r.result_date === today)?.result;

  async function record(a: { id: string; center_id: string; support_level: string | null }, personId: string, result: string) {
    const row: PendingResult = { center_id: a.center_id, activity_id: a.id, result_date: today, result, support_used: a.support_level, created_by: uid, person_id: personId };
    const queue = () => {
      enqueue(uid, row); setPending(readQueue(uid));
      toast.info("Sin conexión: resultado guardado en este dispositivo. Se enviará al volver la conexión.");
    };
    if (!navigator.onLine) { queue(); return; }
    setBusy(a.id);
    const { person_id: _p, ...ins } = row;
    const { error } = await supabase.from("activity_results").insert({ ...ins, result: result as "lograda" });
    setBusy(null);
    if (error) { if (isNetworkError(error)) queue(); else toast.error(errMsg(error)); return; }
    await supabase.rpc("log_access", { _person_id: personId, _action: "seguimiento" });
    toast.success("Resultado registrado");
    qc.invalidateQueries({ queryKey: ["hoy", today] });
    qc.invalidateQueries({ queryKey: ["results"] });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Hoy" subtitle={new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} />
      {(!online || fromCache || pending.length > 0) && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-warning bg-warning/15 p-4">
          <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">{online ? "Conexión recuperada" : "Sin conexión"}</p>
            {fromCache && <p>Estás viendo la copia de hoy guardada en este dispositivo.</p>}
            {pending.length > 0 && <p>{pending.length === 1 ? "1 resultado pendiente" : `${pending.length} resultados pendientes`} de enviar{online ? "…" : ". Se enviarán automáticamente al volver la conexión."}</p>}
          </div>
        </div>
      )}
      {q.isLoading || (!uid && me.isLoading) ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : !q.data?.length ? <Empty title="No hay actividades aprobadas para hoy"><p>Aparecen las de las programaciones diarias de hoy y las semanales que incluyen este día.</p></Empty> : (
        <div className="space-y-8">
          {q.data.map((p) => (
            <section key={p.id} aria-labelledby={`h-${p.id}`}>
              <h2 id={`h-${p.id}`} className="mb-3 text-2xl font-semibold"><Link to="/personas/$id" params={{ id: p.id }} className="underline-offset-4 hover:underline">{p.code}</Link></h2>
              <ul className="space-y-4">
                {p.acts.map((a) => {
                  const u = urls.data?.[pathOf(a.pictogram_id) ?? ""];
                  const pend = pendingOf(a.id);
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
                      ) : pend ? (
                        <p className="mt-3 flex items-center gap-2 font-bold" role="status"><Clock className="h-6 w-6" aria-hidden />Pendiente de enviar: {RESULTS.find((r) => r.value === pend)?.label}</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={`Resultado de ${a.title}`}>
                          {RESULTS.map((r) => (
                            <button key={r.value} disabled={busy === a.id || !uid} onClick={() => record(a, p.id, r.value)}
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
