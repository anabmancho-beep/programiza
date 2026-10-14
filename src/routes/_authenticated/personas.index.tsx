import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/forms";
import { PageHeader, Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { AGE_RANGES, MAIN_TYPES, errMsg, label } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/personas/")({
  head: () => ({ meta: [{ title: "Personas · Programiza" }, { name: "description", content: "Personas atendidas del centro, identificadas por seudónimo." }, { property: "og:title", content: "Personas · Programiza" }, { property: "og:description", content: "Personas atendidas del centro." }] }),
  component: Personas,
});

export const CONSENT_BADGE: Record<string, string> = {
  otorgado: "bg-success text-success-foreground",
  pendiente: "bg-warning text-warning-foreground",
  retirado: "bg-health text-health-foreground",
};

function Personas() {
  const me = useMe();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [age, setAge] = useState("26-35");
  const [type, setType] = useState("psiquica");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["persons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("persons").select("id, code, age_range, main_type, consent_status, anonymized").order("code");
      if (error) throw error;
      return data;
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,20}$/.test(c)) { toast.error("Usa solo un código como «P-014» (letras, números y guiones)"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("persons").insert({ center_id: me.data!.center!.id, code: c, age_range: age, main_type: type, created_by: me.data!.userId }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "Ya existe una persona con ese código" : errMsg(error)); return; }
    await supabase.rpc("log_access", { _person_id: data.id, _action: "crear" });
    toast.success("Ficha creada");
    navigate({ to: "/personas/$id", params: { id: data.id } });
  }

  return (
    <div>
      <PageHeader title="Personas atendidas" subtitle="Identificadas solo por seudónimo o código." actions={<Button onClick={() => setOpen(true)}>Nueva persona</Button>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : q.data!.length === 0 ? (
        <Empty title="Aún no hay personas"><p>Crea la primera ficha o carga los datos de ejemplo desde Inicio.</p></Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data!.map((p) => (
            <li key={p.id}>
              <Link to="/personas/$id" params={{ id: p.id }} className="block rounded-xl border bg-card p-5 shadow-soft hover:border-primary">
                <div className="flex items-center justify-between"><span className="font-display text-2xl">{p.code}</span>
                  <Badge className={CONSENT_BADGE[p.consent_status]}>{p.consent_status}</Badge></div>
                <p className="text-muted-foreground">{label(MAIN_TYPES, p.main_type)} · {p.age_range} años</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva persona</DialogTitle></DialogHeader>
          <form id="new-p" onSubmit={create} className="space-y-4">
            <Notice title="No escribas nombres reales">Usa un seudónimo o código. No se piden nombre, DNI, dirección, teléfono ni fecha de nacimiento.</Notice>
            <Field id="p-code" label="Código o seudónimo"><Input id="p-code" placeholder="P-015" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} required /></Field>
            <Field id="p-age" label="Rango de edad"><NativeSelect id="p-age" value={age} onChange={(e) => setAge(e.target.value)}>{AGE_RANGES.map((a) => <option key={a}>{a}</option>)}</NativeSelect></Field>
            <Field id="p-type" label="Tipo principal"><NativeSelect id="p-type" value={type} onChange={(e) => setType(e.target.value)}>{MAIN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</NativeSelect></Field>
          </form>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="new-p" disabled={busy}>{busy ? "Creando…" : "Crear ficha"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
