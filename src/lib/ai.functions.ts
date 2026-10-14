import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AREA_KEYS = ["autonomia_personal", "comunicacion", "habilidades_sociales", "cognitiva", "motricidad", "ocio", "ocupacional", "naturaleza"] as const;
const AREA_LABEL: Record<string, string> = {
  autonomia_personal: "Autonomía personal", comunicacion: "Comunicación", habilidades_sociales: "Habilidades sociales", cognitiva: "Cognitiva",
  motricidad: "Motricidad", ocio: "Ocio y tiempo libre", ocupacional: "Ocupacional", naturaleza: "Naturaleza",
};
const TYPE_LABEL: Record<string, string> = {
  fisica: "discapacidad física", psiquica: "discapacidad psíquica/intelectual", sensorial: "discapacidad sensorial",
  neurodesarrollo: "trastorno del neurodesarrollo u otro trastorno", varias: "varias discapacidades",
};
const AUT_AREAS = ["higiene", "alimentacion", "movilidad", "comunicacion", "tareas_domesticas", "ocio", "habilidades_sociales"];
const AUT_LEVELS: Record<string, string> = { autonomo: "autónomo/a", supervision: "necesita supervisión", apoyo_parcial: "apoyo parcial", apoyo_total: "apoyo total" };
const AGE_OK = ["<18", "18-25", "26-35", "36-45", "46-55", "56-65", ">65"];
const SUPPORT = ["Autónomo", "Supervisión", "Apoyo parcial", "Apoyo total"];
const RESULT_LABEL: Record<string, string> = { lograda: "Lograda", lograda_con_apoyo: "Lograda con apoyo", no_lograda: "No lograda", no_realizada: "No realizada" };

const SAFETY = `Eres un asistente para equipos educativos de centros que atienden a personas con discapacidad. Escribe en español de España.
Reglas obligatorias:
- Solo propones actividades EDUCATIVAS y de apoyo a la vida diaria. Nunca diagnosticas, nunca recomiendas tratamientos médicos, farmacológicos ni terapéuticos, ni dosis, ni terapias clínicas.
- Si algo requiere criterio clínico (salud, dolor, conducta grave, deglución, medicación, fisioterapia específica), indícalo y remite al profesional correspondiente.
- No inventes datos sobre la persona: usa solo el perfil que se te da.
- Lenguaje respetuoso y centrado en la persona.`;

/** Whitelisted, server-built profile. Never includes code, center, diagnosis or free text. */
function safeProfile(p: { main_type: string; age_range: string; autonomy: unknown }) {
  const aut = (p.autonomy ?? {}) as Record<string, unknown>;
  const autonomy: Record<string, string> = {};
  for (const k of AUT_AREAS) {
    const v = aut[k];
    if (typeof v === "string" && AUT_LEVELS[v]) autonomy[k] = AUT_LEVELS[v];
  }
  return {
    tipo: TYPE_LABEL[p.main_type] ?? "no consta",
    rango_edad: AGE_OK.includes(p.age_range) ? p.age_range : "no consta",
    autonomia: autonomy,
  };
}

const suggestionSchema = z.object({
  aviso_clinico: z.string().nullable(),
  ritmo_general: z.string(),
  objetivos: z.array(z.object({ area: z.string(), descripcion: z.string(), indicador: z.string(), criterio: z.string(), plazo_semanas: z.number() })),
  actividades: z.array(z.object({
    titulo: z.string(), area: z.string(), duracion_min: z.number(), nivel_apoyo: z.string(), materiales: z.string(),
    pasos: z.array(z.string()), adaptaciones: z.string(), sesiones_semana: z.number(), objetivo_indice: z.number().nullable(),
    dia_semana: z.number().nullable(), hora: z.string().nullable(),
  })),
});

export const suggestPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid(), area: z.enum(AREA_KEYS).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { aiObject, AiError } = await import("./ai.server");
    const { data: plan, error } = await supabase.from("plans").select("id, center_id, level, person_id, start_date, is_template").eq("id", data.planId).maybeSingle();
    if (error || !plan) return { ok: false as const, error: "Programación no encontrada" };
    if (!plan.person_id) return { ok: false as const, error: "Las sugerencias con IA solo están disponibles en programaciones de una persona." };
    const { data: person } = await supabase.from("persons").select("id, main_type, age_range, autonomy, consent_status").eq("id", plan.person_id).maybeSingle();
    if (!person) return { ok: false as const, error: "Persona no encontrada" };
    if (person.consent_status !== "otorgado") return { ok: false as const, error: "Sin consentimiento otorgado no se pueden generar sugerencias." };

    const payload = { nivel_programacion: plan.level, area_preferente: data.area ? AREA_LABEL[data.area] : "cualquiera", perfil: safeProfile(person) };
    const instructions = `${SAFETY}
Tarea: propón una programación de nivel "${plan.level}". Devuelve entre 2 y 4 objetivos medibles (concretos, medibles, alcanzables y con plazo en semanas) y entre 3 y 6 actividades.
Áreas permitidas (usa la clave exacta): ${AREA_KEYS.join(", ")}.
Nivel de apoyo: uno de ${SUPPORT.join(", ")}.
objetivo_indice: índice (empezando en 0) del objetivo al que contribuye la actividad, o null.
${plan.level === "semanal" ? "dia_semana: 1 (lunes) a 5 (viernes). hora: HH:MM entre 09:00 y 17:00." : plan.level === "diaria" ? "dia_semana: null. hora: HH:MM en orden cronológico." : "dia_semana: null. hora: null."}
aviso_clinico: texto breve si algo del perfil requiere valoración de un profesional sanitario o terapeuta; si no, null.`;

    let s: z.infer<typeof suggestionSchema>;
    try {
      s = await aiObject(suggestionSchema, instructions, JSON.stringify(payload));
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Error de IA" };
    }

    const area = (a: string) => ((AREA_KEYS as readonly string[]).includes(a) ? a : data.area ?? "autonomia_personal");
    const clampStr = (t: string, n: number) => t.trim().slice(0, n);
    const base = plan.start_date ? new Date(plan.start_date + "T00:00:00") : new Date();
    const objRows = s.objetivos.slice(0, 4).map((o) => {
      const d = new Date(base); d.setDate(d.getDate() + Math.max(1, Math.min(52, Math.round(o.plazo_semanas || 4))) * 7);
      return { center_id: plan.center_id, plan_id: plan.id, area: area(o.area), description: clampStr(o.descripcion, 500), indicator: clampStr(o.indicador, 300), criterion: clampStr(o.criterio, 300), deadline: d.toISOString().slice(0, 10), ai_generated: true, status: "borrador" as const };
    }).filter((o) => o.description.length >= 3);
    const { data: insertedObj, error: oe } = objRows.length ? await supabase.from("plan_objectives").insert(objRows).select("id") : { data: [], error: null };
    if (oe) return { ok: false as const, error: oe.message };

    const actRows = s.actividades.slice(0, 6).map((a, i) => {
      const ses = Math.max(1, Math.min(7, Math.round(a.sesiones_semana || 1)));
      const hora = a.hora && /^\d{2}:\d{2}$/.test(a.hora) ? a.hora : null;
      return {
        center_id: plan.center_id, plan_id: plan.id, title: clampStr(a.titulo, 160) || "Actividad", area: area(a.area),
        duration_min: Math.max(5, Math.min(240, Math.round(a.duracion_min || 30))),
        support_level: SUPPORT.includes(a.nivel_apoyo) ? a.nivel_apoyo : "Supervisión",
        materials: clampStr(a.materiales, 300) || null,
        steps: a.pasos.slice(0, 10).map((p) => clampStr(p, 200)).filter(Boolean),
        adaptations: clampStr(`${a.adaptaciones}${a.adaptaciones ? " · " : ""}Ritmo: ${ses} sesión(es)/semana`, 1000),
        day_of_week: plan.level === "semanal" && a.dia_semana && a.dia_semana >= 1 && a.dia_semana <= 7 ? Math.round(a.dia_semana) : null,
        time_slot: plan.level === "semanal" || plan.level === "diaria" ? hora : null,
        objective_id: a.objetivo_indice != null ? insertedObj?.[a.objetivo_indice]?.id ?? null : null,
        position: 100 + i, ai_generated: true, status: "borrador" as const,
      };
    });
    if (actRows.length) {
      const { error: ae } = await supabase.from("plan_activities").insert(actRows);
      if (ae) return { ok: false as const, error: ae.message };
    }
    await supabase.rpc("log_access", { _person_id: person.id, _action: "sugerencia_ia" });
    return { ok: true as const, clinicalNote: s.aviso_clinico, rhythm: s.ritmo_general, objectives: objRows.length, activities: actRows.length };
  });

export const draftReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ personId: z.string().uuid(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { aiObject, AiError } = await import("./ai.server");
    if (data.to < data.from) return { ok: false as const, error: "La fecha final es anterior a la inicial." };
    const { data: person } = await supabase.from("persons").select("id, center_id, consent_status").eq("id", data.personId).maybeSingle();
    if (!person) return { ok: false as const, error: "Persona no encontrada" };
    if (person.consent_status !== "otorgado") return { ok: false as const, error: "Sin consentimiento otorgado no se pueden generar informes." };
    const { data: rows, error } = await supabase
      .from("activity_results")
      .select("result, result_date, plan_activities(area, objective_id, plan_objectives(id, area, description, status))")
      .eq("person_id", data.personId).gte("result_date", data.from).lte("result_date", data.to)
      .order("result_date", { ascending: true });
    if (error) return { ok: false as const, error: error.message };

    type Bucket = { total: number; lograda: number; lograda_con_apoyo: number; no_lograda: number; no_realizada: number };
    const nb = (): Bucket => ({ total: 0, lograda: 0, lograda_con_apoyo: 0, no_lograda: 0, no_realizada: 0 });
    const all = nb(); const byArea: Record<string, Bucket> = {}; const byMonth: Record<string, Bucket> = {};
    // Objective descriptions never leave the server: AI sees "Objetivo N · Área" only.
    const byObjAi: Record<string, Bucket> = {}; const byObjReal: Record<string, Bucket> = {};
    const labels = new Map<string, { n: number; label: string; description: string }>();
    const NONE = "Sin objetivo vinculado";
    for (const r of rows ?? []) {
      const act = r.plan_activities as unknown as { area: string; plan_objectives: { id: string; area: string; description: string; status: string } | null } | null;
      const k = r.result as keyof Bucket;
      const add = (b: Bucket) => { b.total++; b[k]++; };
      add(all);
      add((byArea[AREA_LABEL[act?.area ?? ""] ?? "Sin área"] ??= nb()));
      const o = act?.plan_objectives && act.plan_objectives.status === "aprobado" ? act.plan_objectives : null;
      if (o) {
        let l = labels.get(o.id);
        if (!l) { const n = labels.size + 1; l = { n, label: `Objetivo ${n} · ${AREA_LABEL[o.area] ?? "Sin área"}`, description: o.description }; labels.set(o.id, l); }
        add((byObjAi[l.label] ??= nb()));
        add((byObjReal[`Objetivo ${l.n}: ${l.description}`] ??= nb()));
      } else { add((byObjAi[NONE] ??= nb())); add((byObjReal[NONE] ??= nb())); }
      add((byMonth[r.result_date.slice(0, 7)] ??= nb()));
    }
    const aiStats = { periodo: { desde: data.from, hasta: data.to }, total: all, por_area: byArea, por_objetivo: byObjAi, por_mes: byMonth, etiquetas: RESULT_LABEL };
    const stats = { ...aiStats, por_objetivo: byObjReal };

    let content: string; let ai = false;
    if (all.total === 0) {
      content = `No hay registros de seguimiento entre ${data.from} y ${data.to}. No es posible valorar la evolución en este periodo. Se recomienda registrar los resultados de las actividades para poder elaborar el informe.`;
    } else {
      const instructions = `${SAFETY}
Tarea: redacta un informe de evolución (4-8 párrafos breves) usando EXCLUSIVAMENTE las cifras del JSON. No inventes cifras, porcentajes, observaciones ni hechos. Calcula porcentajes solo a partir de los recuentos dados.
Los objetivos aparecen como etiquetas genéricas ("Objetivo 1", "Objetivo 2"…). Menciónalos exactamente con esa etiqueta ("Objetivo N") y no intentes adivinar su contenido.
Si un área u objetivo tiene menos de 3 registros, di expresamente que los datos son insuficientes para concluir. Si faltan áreas u objetivos, dilo.
No te refieras a la persona con nombre ni código: usa "la persona".
Termina con propuestas educativas generales para el siguiente periodo, sin recomendaciones clínicas.`;
      try {
        const out = await aiObject(z.object({ texto: z.string() }), instructions, JSON.stringify(aiStats));
        const byN = new Map([...labels.values()].map((l) => [l.n, l.description]));
        // Rebuild on the server: "Objetivo N" -> "Objetivo N («descripción»)"
        content = out.texto.trim().replace(/\bObjetivo (\d+)\b(?:\s*·\s*[^,.;:()\n]+)?/g, (m, n) => {
          const d = byN.get(Number(n));
          return d ? `Objetivo ${n} («${d}»)` : m;
        });
        ai = true;
      } catch (e) {
        return { ok: false as const, error: e instanceof AiError ? e.message : "Error de IA" };
      }
    }
    const { data: rep, error: re } = await supabase.from("reports").insert({
      center_id: person.center_id, person_id: person.id, period_start: data.from, period_end: data.to, stats, content, ai_generated: ai, status: "borrador", created_by: userId,
    }).select("id").single();
    if (re) return { ok: false as const, error: re.message };
    await supabase.rpc("log_access", { _person_id: person.id, _action: "informe" });
    return { ok: true as const, id: rep.id };
  });
