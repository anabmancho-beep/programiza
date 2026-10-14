import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/forms";
import { PageHeader, Loading, ErrorBox, Empty } from "@/components/states";
import { PlanCreateDialog } from "@/components/PlanCreateDialog";
import { LEVELS, fmtDate, label } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/programaciones/")({
  head: () => ({ meta: [{ title: "Programaciones · Programiza" }, { name: "description", content: "Programaciones anuales, mensuales, semanales y diarias en lista y calendario." }, { property: "og:title", content: "Programaciones · Programiza" }, { property: "og:description", content: "Programaciones en cuatro niveles enlazados." }] }),
  component: Programaciones,
});

const LEVEL_COLOR: Record<string, string> = {
  anual: "bg-primary text-primary-foreground",
  mensual: "bg-accent text-accent-foreground",
  semanal: "bg-secondary text-secondary-foreground",
  diaria: "bg-success text-success-foreground",
};

function Programaciones() {
  const [level, setLevel] = useState("");
  const [person, setPerson] = useState("");
  const [newTpl, setNewTpl] = useState(false);
  const q = useQuery({
    queryKey: ["plans", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("id, title, level, start_date, end_date, is_template, person_id, persons(code)").order("start_date", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
  const plans = (q.data ?? []).filter((p) => !p.is_template && (!level || p.level === level) && (!person || p.person_id === person));
  const templates = (q.data ?? []).filter((p) => p.is_template);
  const persons = useMemo(() => {
    const m = new Map<string, string>();
    (q.data ?? []).forEach((p) => p.person_id && p.persons && m.set(p.person_id, p.persons.code));
    return [...m.entries()];
  }, [q.data]);

  return (
    <div>
      <PageHeader title="Programaciones" subtitle="Las anuales se crean desde la ficha de cada persona; desde cada una se crean los niveles inferiores." />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <Tabs defaultValue="lista">
          <TabsList><TabsTrigger value="lista">Lista</TabsTrigger><TabsTrigger value="calendario">Calendario</TabsTrigger><TabsTrigger value="plantillas">Plantillas</TabsTrigger></TabsList>
          {(["lista", "calendario"] as const).map((v) => (
            <TabsContent key={v} value={v}>
              <div className="my-4 flex flex-wrap gap-3">
                <label className="flex items-center gap-2">Nivel <NativeSelect className="w-40" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Todos</option>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</NativeSelect></label>
                <label className="flex items-center gap-2">Persona <NativeSelect className="w-40" value={person} onChange={(e) => setPerson(e.target.value)}><option value="">Todas</option>{persons.map(([id, c]) => <option key={id} value={id}>{c}</option>)}</NativeSelect></label>
              </div>
              {plans.length === 0 ? <Empty title="No hay programaciones"><p>Abre una persona con consentimiento otorgado y crea su programación anual.</p></Empty>
                : v === "lista" ? (
                  <ul className="space-y-2">
                    {plans.map((p) => (
                      <li key={p.id}><Link to="/programaciones/$id" params={{ id: p.id }} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 hover:border-primary">
                        <span><Badge className={`mr-2 ${LEVEL_COLOR[p.level]}`}>{label(LEVELS, p.level)}</Badge>{p.title} <span className="text-muted-foreground">· {p.persons?.code}</span></span>
                        <span className="text-sm text-muted-foreground">{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</span>
                      </Link></li>
                    ))}
                  </ul>
                ) : <MonthCalendar plans={plans} />}
            </TabsContent>
          ))}
          <TabsContent value="plantillas">
            <div className="my-4"><Button onClick={() => setNewTpl(true)}>Nueva plantilla semanal</Button></div>
            {templates.length === 0 ? <Empty title="Sin plantillas"><p>Crea una o guarda cualquier programación como plantilla.</p></Empty> : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {templates.map((t) => (
                  <li key={t.id}><Link to="/programaciones/$id" params={{ id: t.id }} className="block rounded-lg border bg-card p-4 hover:border-primary">
                    <Badge className={`mr-2 ${LEVEL_COLOR[t.level]}`}>{label(LEVELS, t.level)}</Badge>{t.title}
                  </Link></li>
                ))}
              </ul>
            )}
            <PlanCreateDialog open={newTpl} onOpenChange={setNewTpl} level="semanal" template />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

type CalPlan = { id: string; title: string; level: string; start_date: string | null; end_date: string | null; persons: { code: string } | null };

function MonthCalendar({ plans }: { plans: CalPlan[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const iso = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const short = plans.filter((p) => p.level === "semanal" || p.level === "diaria");
  const long = plans.filter((p) => (p.level === "anual" || p.level === "mensual") && p.start_date && p.end_date && p.start_date <= iso(days) && p.end_date >= iso(1));
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => setCursor(new Date(y, m - 1, 1))}><ChevronLeft /></Button>
        <h2 className="text-xl font-semibold capitalize">{cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</h2>
        <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => setCursor(new Date(y, m + 1, 1))}><ChevronRight /></Button>
      </div>
      {long.length > 0 && <p className="mb-3 text-sm">Vigentes este mes: {long.map((p) => <Link key={p.id} to="/programaciones/$id" params={{ id: p.id }} className="mr-2 underline">{p.title}</Link>)}</p>}
      <div className="grid grid-cols-7 gap-1 text-center text-sm font-bold" aria-hidden>{["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: first }).map((_, i) => <div key={"e" + i} />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = iso(i + 1);
          const items = short.filter((p) => p.start_date && (p.level === "diaria" ? p.start_date === d : p.start_date <= d && (p.end_date ?? p.start_date) >= d));
          return (
            <div key={d} className="min-h-20 rounded-md border p-1 text-left">
              <div className="text-xs text-muted-foreground">{i + 1}</div>
              {items.map((p) => (
                <Link key={p.id} to="/programaciones/$id" params={{ id: p.id }} className={`mb-0.5 block truncate rounded px-1 text-xs ${LEVEL_COLOR[p.level]}`} title={p.title}>
                  {p.persons?.code} {p.level === "diaria" ? "· día" : "· sem"}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
