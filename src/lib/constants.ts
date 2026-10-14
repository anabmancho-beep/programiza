export const ROLE_LABELS: Record<string, string> = {
  admin: "Administración del centro",
  educador: "Educador/a",
  profesional: "Profesional",
  familia: "Familia",
};

export const MAIN_TYPES: { value: string; label: string }[] = [
  { value: "fisica", label: "Física" },
  { value: "psiquica", label: "Psíquica / intelectual" },
  { value: "sensorial", label: "Sensorial" },
  { value: "neurodesarrollo", label: "Trastorno del neurodesarrollo / otro trastorno" },
  { value: "varias", label: "Varias" },
];

export const AGE_RANGES = ["<18", "18-25", "26-35", "36-45", "46-55", "56-65", ">65"];

export const AUTONOMY_AREAS: { key: string; label: string }[] = [
  { key: "higiene", label: "Higiene" },
  { key: "alimentacion", label: "Alimentación" },
  { key: "movilidad", label: "Movilidad" },
  { key: "comunicacion", label: "Comunicación" },
  { key: "tareas_domesticas", label: "Tareas domésticas" },
  { key: "ocio", label: "Ocio" },
  { key: "habilidades_sociales", label: "Habilidades sociales" },
];

export const AUTONOMY_LEVELS: { value: string; label: string }[] = [
  { value: "autonomo", label: "Autónomo/a" },
  { value: "supervision", label: "Supervisión" },
  { value: "apoyo_parcial", label: "Apoyo parcial" },
  { value: "apoyo_total", label: "Apoyo total" },
];

export const AREAS: { value: string; label: string }[] = [
  { value: "autonomia_personal", label: "Autonomía personal" },
  { value: "comunicacion", label: "Comunicación" },
  { value: "habilidades_sociales", label: "Habilidades sociales" },
  { value: "cognitiva", label: "Cognitiva" },
  { value: "motricidad", label: "Motricidad" },
  { value: "ocio", label: "Ocio y tiempo libre" },
  { value: "ocupacional", label: "Ocupacional" },
  { value: "naturaleza", label: "Naturaleza" },
];

export const SUPPORT_LEVELS = ["Autónomo", "Supervisión", "Apoyo parcial", "Apoyo total"];

export const LEVELS: { value: "anual" | "mensual" | "semanal" | "diaria"; label: string }[] = [
  { value: "anual", label: "Anual" },
  { value: "mensual", label: "Mensual" },
  { value: "semanal", label: "Semanal" },
  { value: "diaria", label: "Diaria" },
];

export const CHILD_LEVEL: Record<string, "mensual" | "semanal" | "diaria" | undefined> = {
  anual: "mensual",
  mensual: "semanal",
  semanal: "diaria",
};

export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const label = (list: { value: string; label: string }[], v?: string | null) =>
  list.find((x) => x.value === v)?.label ?? v ?? "—";

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Ha ocurrido un error inesperado.";
}

export const fmtDate = (d?: string | null) =>
  d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";
