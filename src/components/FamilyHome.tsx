import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LibraryPictoView } from "@/components/LibraryPicto";
import { usePictoUrls } from "@/lib/pictos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/forms";
import { Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { DAYS, fmtDate } from "@/lib/constants";

type Week = { title: string; start: string; end: string; activities: { id: string; title: string; duration_min: number | null; day_of_week: number | null; time_slot: string | null; steps: string[]; pictogram_path: string | null; library_picto?: string | null }[] } | null;
type Rep = { id: string; period_start: string; period_end: string; content: string; approved_at: string };

const localToday = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export function FamilyHome({ onSignOut }: { onSignOut: () => void }) {
  const ov = useQuery({
    queryKey: ["family-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("family_overview");
      if (error) throw error;
      return data as unknown as { center: string; persons: { id: string; code: string }[] };
    },
  });
  const [pid, setPid] = useState("");
  const [date, setDate] = useState(localToday());
  useEffect(() => { if (!pid && ov.data?.persons[0]) setPid(ov.data.persons[0].id); }, [ov.data, pid]);
  const week = useQuery({
    queryKey: ["family-week", pid, date], enabled: !!pid,
    queryFn: async () => { const { data, error } = await supabase.rpc("family_week", { _person_id: pid, _date: date }); if (error) throw error; return data as unknown as Week; },
  });
  const reps = useQuery({
    queryKey: ["family-reports", pid], enabled: !!pid,
    queryFn: async () => { const { data, error } = await supabase.rpc("family_reports", { _person_id: pid }); if (error) throw error; return data as unknown as Rep[]; },
  });
  const urls = usePictoUrls((week.data?.activities ?? []).map((a) => a.pictogram_path));

  return (
    <div className="min-h-screen bg-calm">
      <header className="flex items-center justify-between bg-sidebar p-4 text-sidebar-foreground">
        <span className="flex items-center gap-2 font-display text-xl"><Sprout className="h-6 w-6 text-sidebar-primary" aria-hidden />Programiza · Familias</span>
        <button onClick={onSignOut} className="flex items-center gap-2 font-bold"><LogOut className="h-4 w-4" aria-hidden />Cerrar sesión</button>
      </header>
      <main id="contenido" className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        {ov.isLoading ? <Loading /> : ov.error ? <ErrorBox error={ov.error} /> : ov.data!.persons.length === 0 ? (
          <Notice title="Sin acceso activo">No tienes ninguna persona vinculada o el consentimiento ya no está otorgado. Ponte en contacto con el centro.</Notice>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-semibold">{ov.data!.center}</h1>
              <p className="text-muted-foreground">Vista de solo lectura para la familia.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              {ov.data!.persons.length > 1 && <Field id="fp" label="Persona"><NativeSelect id="fp" value={pid} onChange={(e) => setPid(e.target.value)}>{ov.data!.persons.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</NativeSelect></Field>}
              <Field id="fd" label="Semana que incluye el día"><Input id="fd" type="date" value={date} onChange={(e) => setDate(e.target.value || localToday())} /></Field>
            </div>
            <section aria-labelledby="fw">
              <h2 id="fw" className="mb-3 text-2xl font-semibold">Agenda semanal</h2>
              {week.isLoading ? <Loading /> : week.error ? <ErrorBox error={week.error} /> : !week.data ? <Empty title="No hay agenda para esa semana" /> : (
                <>
                  <p className="mb-3 text-muted-foreground">{fmtDate(week.data.start)} – {fmtDate(week.data.end)}</p>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {DAYS.map((d, i) => {
                      const list = week.data!.activities.filter((a) => a.day_of_week === i + 1);
                      if (i >= 5 && !list.length) return null;
                      return (
                        <div key={d} className="rounded-xl border bg-card p-3">
                          <h3 className="mb-2 font-bold">{d}</h3>
                          {list.length === 0 ? <p className="text-sm text-muted-foreground">Libre</p> : (
                            <ul className="space-y-2">{list.map((a) => (
                              <li key={a.id} className="flex items-center gap-3 rounded-lg border p-2">
                                {a.pictogram_path && urls.data?.[a.pictogram_path] && <img src={urls.data[a.pictogram_path]} alt="" className="h-12 w-12 object-contain" />}
                                {!a.pictogram_path && a.library_picto && <LibraryPictoView id={a.library_picto} size="sm" />}
                                <span>{a.time_slot && <span className="mr-1 text-muted-foreground">{a.time_slot.slice(0, 5)}</span>}<span className="font-bold">{a.title}</span></span>
                              </li>
                            ))}</ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
            <section aria-labelledby="fr">
              <h2 id="fr" className="mb-3 text-2xl font-semibold">Informes compartidos</h2>
              {reps.isLoading ? <Loading /> : reps.error ? <ErrorBox error={reps.error} /> : reps.data!.length === 0 ? <Empty title="El centro todavía no ha compartido informes" /> : reps.data!.map((r) => (
                <article key={r.id} className="mb-4 rounded-xl border bg-card p-5">
                  <h3 className="text-lg font-semibold">{fmtDate(r.period_start)} – {fmtDate(r.period_end)}</h3>
                  <p className="mt-2 whitespace-pre-line">{r.content}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Aprobado el {new Date(r.approved_at).toLocaleDateString("es-ES")}</p>
                </article>
              ))}
            </section>
            <Button variant="link" asChild><a href="/privacidad">Privacidad y datos</a></Button>
          </>
        )}
      </main>
    </div>
  );
}
