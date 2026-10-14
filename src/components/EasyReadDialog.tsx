import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { easyRead } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/forms";
import { Notice } from "@/components/states";
import { errMsg } from "@/lib/constants";

/** planId → rewrites the approved agenda; otherwise rewrites the text typed or passed in. */
export function EasyReadDialog({ open, onOpenChange, planId, initialText }: { open: boolean; onOpenChange: (o: boolean) => void; planId?: string; initialText?: string }) {
  const run = useServerFn(easyRead);
  const [text, setText] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setText(initialText ?? ""); setOut(""); } }, [open, initialText]);

  async function go() {
    if (!planId && text.trim().length < 3) { toast.error("Escribe el texto que quieres adaptar"); return; }
    setBusy(true);
    try {
      const r = await run({ data: planId ? { planId } : { text } });
      if (!r.ok) { toast.error(r.error); return; }
      setOut(r.text);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Pasar a lectura fácil</DialogTitle></DialogHeader>
        <Notice title="Privacidad">{planId ? "Se envían solo los títulos, días, horas y pasos de las actividades aprobadas. Nunca el código, las adaptaciones ni las observaciones." : "No escribas nombres ni datos personales. Antes de enviar el texto, el servidor quita códigos, correos, teléfonos, DNI y fechas."}</Notice>
        {!planId && <Field id="er-in" label="Texto original"><Textarea id="er-in" rows={6} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} /></Field>}
        {out && (
          <div className="rounded-lg border bg-card p-4" role="status">
            <p className="mb-2 font-bold">Versión en lectura fácil (revísala antes de usarla)</p>
            <p className="whitespace-pre-line text-lg leading-relaxed">{out}</p>
          </div>
        )}
        <DialogFooter>
          {out && <Button variant="outline" onClick={() => { navigator.clipboard.writeText(out); toast.success("Copiado"); }}>Copiar</Button>}
          <Button onClick={go} disabled={busy}>{busy ? "Adaptando…" : out ? "Volver a generar" : "Adaptar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
