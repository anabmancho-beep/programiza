import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const FOOTER = "Documento confidencial. Contiene datos de salud. Uso exclusivo del centro.";

function footer(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  const today = new Date().toLocaleDateString("es-ES");
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`${FOOTER} Generado el ${today}.`, 14, h - 8);
    doc.text(`Página ${i} de ${n}`, w - 14, h - 8, { align: "right" });
  }
}

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(subtitle, 14, 25);
}

export type PdfActivity = { title: string; area: string; duration_min: number | null; support_level: string | null; materials: string | null; steps: string[]; adaptations: string | null; day_of_week: number | null; time_slot: string | null };

export function dailyAgendaPdf(code: string, title: string, date: string, acts: PdfActivity[]) {
  const doc = new jsPDF();
  header(doc, `Agenda diaria · ${code}`, `${title} · ${date}`);
  autoTable(doc, {
    startY: 32,
    head: [["#", "Hora", "Actividad", "Pasos", "Apoyo / materiales"]],
    body: acts.map((a, i) => [String(i + 1), a.time_slot?.slice(0, 5) ?? "", `${a.title}\n(${a.area}, ${a.duration_min ?? "?"} min)`, a.steps.map((s, k) => `${k + 1}. ${s}`).join("\n"), [a.support_level, a.materials, a.adaptations].filter(Boolean).join("\n")]),
    styles: { fontSize: 9, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: [62, 104, 86] },
    margin: { bottom: 16 },
  });
  footer(doc);
  doc.save(`agenda-diaria-${code}-${date}.pdf`);
}

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export function weeklyAgendaPdf(code: string, title: string, range: string, acts: PdfActivity[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, `Agenda semanal · ${code}`, `${title} · ${range}`);
  const slots = [...new Set(acts.map((a) => a.time_slot?.slice(0, 5) ?? "Sin hora"))].sort();
  const usedDays = DAYS.map((_, i) => i + 1).filter((d) => d <= 5 || acts.some((a) => a.day_of_week === d));
  autoTable(doc, {
    startY: 32,
    head: [["Franja", ...usedDays.map((d) => DAYS[d - 1] ?? "")]],
    body: slots.map((s) => [s, ...usedDays.map((d) => acts.filter((a) => a.day_of_week === d && (a.time_slot?.slice(0, 5) ?? "Sin hora") === s).map((a) => `${a.title} (${a.duration_min ?? "?"}′, ${a.support_level ?? ""})`).join("\n"))]),
    styles: { fontSize: 9, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: [62, 104, 86] },
    margin: { bottom: 16 },
  });
  const unassigned = acts.filter((a) => !a.day_of_week);
  if (unassigned.length) {
    autoTable(doc, { head: [["Sin día asignado"]], body: unassigned.map((a) => [a.title]), styles: { fontSize: 9 }, margin: { bottom: 16 } });
  }
  footer(doc);
  doc.save(`agenda-semanal-${code}.pdf`);
}

type Bucket = { total: number; lograda: number; lograda_con_apoyo: number; no_lograda: number; no_realizada: number };
export function reportPdf(code: string, period: string, content: string, stats: { total?: Bucket; por_area?: Record<string, Bucket>; por_objetivo?: Record<string, Bucket> }, approvedInfo: string) {
  const doc = new jsPDF();
  header(doc, `Informe de evolución · ${code}`, `${period} · ${approvedInfo}`);
  doc.setFontSize(10);
  doc.setTextColor(30);
  const lines = doc.splitTextToSize(content, 180);
  let y = 34;
  const h = doc.internal.pageSize.getHeight();
  for (const l of lines) {
    if (y > h - 20) { doc.addPage(); y = 20; }
    doc.text(l, 14, y);
    y += 5;
  }
  const row = (k: string, b: Bucket) => [k, String(b.total), String(b.lograda), String(b.lograda_con_apoyo), String(b.no_lograda), String(b.no_realizada)];
  const cols = ["Registros", "Lograda", "Con apoyo", "No lograda", "No realizada"];
  const head = [["", ...cols]];
  if (stats.total) autoTable(doc, { startY: y + 4, head, body: [row("Total", stats.total)], styles: { fontSize: 9 }, headStyles: { fillColor: [62, 104, 86] }, margin: { bottom: 16 } });
  if (stats.por_area) autoTable(doc, { head: [["Por área", ...cols]], body: Object.entries(stats.por_area).map(([k, b]) => row(k, b)), styles: { fontSize: 9 }, headStyles: { fillColor: [62, 104, 86] }, margin: { bottom: 16 } });
  if (stats.por_objetivo) autoTable(doc, { head: [["Por objetivo", ...cols]], body: Object.entries(stats.por_objetivo).map(([k, b]) => row(k, b)), styles: { fontSize: 9 }, headStyles: { fillColor: [62, 104, 86] }, margin: { bottom: 16 } });
  footer(doc);
  doc.save(`informe-${code}-${period.replace(/\s/g, "")}.pdf`);
}
