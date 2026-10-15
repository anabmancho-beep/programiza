import { supabase } from "@/integrations/supabase/client";

export type PendingResult = {
  activity_id: string; center_id: string; result: string; support_used: string | null;
  result_date: string; created_by: string; person_id: string;
};

const cacheKey = (uid: string, day: string) => `hoy-cache:${uid}:${day}`;
const queueKey = (uid: string) => `hoy-queue:${uid}`;

export function saveCache(uid: string, day: string, data: unknown) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(`hoy-cache:${uid}:`) && k !== cacheKey(uid, day)) localStorage.removeItem(k);
    }
    localStorage.setItem(cacheKey(uid, day), JSON.stringify(data));
  } catch { /* almacenamiento lleno o no disponible */ }
}
export function readCache<T>(uid: string, day: string): T | null {
  try { const v = localStorage.getItem(cacheKey(uid, day)); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
export function readQueue(uid: string): PendingResult[] {
  try { return JSON.parse(localStorage.getItem(queueKey(uid)) ?? "[]"); } catch { return []; }
}
function writeQueue(uid: string, q: PendingResult[]) {
  if (q.length) localStorage.setItem(queueKey(uid), JSON.stringify(q)); else localStorage.removeItem(queueKey(uid));
}
export function enqueue(uid: string, r: PendingResult) {
  writeQueue(uid, [...readQueue(uid).filter((x) => !(x.activity_id === r.activity_id && x.result_date === r.result_date)), r]);
}
export function clearHoyCaches() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith("hoy-cache:")) localStorage.removeItem(k);
  }
}

let flushing = false;
/** Envía los resultados pendientes. Devuelve cuántos se han sincronizado. */
export async function flushQueue(uid: string): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    const remaining: PendingResult[] = [];
    for (const r of readQueue(uid)) {
      const { person_id, ...row } = r;
      const { error } = await supabase.from("activity_results").insert({ ...row, result: row.result as "lograda" });
      if (error && isNetworkError(error)) { remaining.push(r); continue; }
      // Errores de permisos/consentimiento: se descartan para no bloquear la cola.
      if (!error) { sent++; await supabase.rpc("log_access", { _person_id: person_id, _action: "seguimiento" }); }
    }
    writeQueue(uid, remaining);
  } finally { flushing = false; }
  return sent;
}

export function isNetworkError(e: unknown) {
  const m = String((e as { message?: string })?.message ?? e);
  return !navigator.onLine || /fetch|network|Load failed/i.test(m);
}
