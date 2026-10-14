import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { NativeSelect } from "@/components/forms";
import { Loading, ErrorBox, Empty } from "@/components/states";
import { AREAS, RESULTS, label } from "@/lib/constants";

type Row = { id: string; result: string; result_date: string; support_used: string | null; notes: string | null; plan_activities: { title: string; area: string; objective_id: string | null; plan_objectives: { description: string; status: string } | null } | null };

const score = (r: string): number | null => (r === "lograda" ? 1 : r === "lograda_con_apoyo" ? 0.5 : r === "no_lograda" ? 0 : null);
const pct = (rs: Row[]) => {
  const v = rs.map((r) => score(r.result)).filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) : null;
};
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function EvolutionTab({ personId }: { personId: string }) {
  const logged = useRef(false);
  const q = useQuery({
    queryKey: ["results", personId],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_results")
        .select("id, result, result_date, support_used, notes, plan_activities(title, area, objective_id, plan_objectives(description, status))")
        .eq("person_id", personId).order("result_date");
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  useEffect(() => {
    if (q.data && !logged.current) { logged.current = true; supabase.rpc("log_access", { _person_id: personId, _action: "ver_evolucion" }); }
  }, [q.data, personId]);

  const rows = q.data ?? [];
  const months = useMemo(() => [...new Set(rows.map((r) => r.result_date.slice(0, 7)))].sort(), [rows]);
  const [mA, setMA] = useState("");
  const [mB, setMB] = useState("");
  useEffect(() => { if (months.length) { setMA(months[Math.max(0, months.length - 2)]!); setMB(months[months.length - 1]!); } }, [months]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!rows.length) return <Empty title="Sin registros de seguimiento"><p>Registra resultados desde las actividades aprobadas de sus programaciones.</p></Empty>;

  const objName = (r: Row) => (r.plan_activities?.plan_objectives?.status === "aprobado" ? r.plan_activities.plan_objectives.description : "Sin objetivo");
  const objectives = [...new Set(rows.map(objName))];
  const byObjMonth = months.map((m) => {
    const o: Record<string, string | number | null> = { mes: m };
    for (const ob of objectives) o[ob] = pct(rows.filter((r) => r.result_date.startsWith(m) && objName(r) === ob));
    return o;
  });
  const areaKeys = [...new Set(rows.map((r) => r.plan_activities?.area ?? ""))];
  const compare = areaKeys.map((a) => ({
    area: label(AREAS, a),
    [mA || "A"]: pct(rows.filter((r) => r.result_date.startsWith(mA) && r.plan_activities?.area === a)) ?? 0,
    [mB || "B"]: pct(rows.filter((r) => r.result_date.startsWith(mB) && r.plan_activities?.area === a)) ?? 0,
  }));

  return (
    <div className="mt-4 space-y-6">
      <p className="text-sm text-muted-foreground">Índice de logro: lograda = 100 %, con apoyo = 50 %, no lograda = 0 %. «No realizada» no cuenta.</p>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-lg font-semibold">Evolución por objetivo (% de logro por mes)</h3>
        <div className="h-72"><ResponsiveContainer><LineChart data={byObjMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis domain={[0, 100]} unit="%" /><Tooltip /><Legend />
          {objectives.map((o, i) => <Line key={o} type="monotone" dataKey={o} stroke={COLORS[i % COLORS.length]} strokeWidth={2} connectNulls />)}</LineChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">Comparación por área</h3>
          <label className="flex items-center gap-2">Mes A <NativeSelect className="w-36" value={mA} onChange={(e) => setMA(e.target.value)}>{months.map((m) => <option key={m}>{m}</option>)}</NativeSelect></label>
          <label className="flex items-center gap-2">Mes B <NativeSelect className="w-36" value={mB} onChange={(e) => setMB(e.target.value)}>{months.map((m) => <option key={m}>{m}</option>)}</NativeSelect></label>
        </div>
        <div className="h-72"><ResponsiveContainer><BarChart data={compare}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="area" /><YAxis domain={[0, 100]} unit="%" /><Tooltip /><Legend />
          <Bar dataKey={mA || "A"} fill="var(--chart-1)" /><Bar dataKey={mB || "B"} fill="var(--chart-2)" /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-lg font-semibold">Últimos registros</h3>
        <ul className="divide-y">{[...rows].reverse().slice(0, 20).map((r) => (
          <li key={r.id} className="py-2 text-sm"><span className="font-bold">{new Date(r.result_date + "T00:00:00").toLocaleDateString("es-ES")}</span> · {r.plan_activities?.title} · {label(RESULTS, r.result)} · Apoyo: {r.support_used ?? "—"}{r.notes ? ` · ${r.notes}` : ""}</li>
        ))}</ul>
      </section>
    </div>
  );
}
