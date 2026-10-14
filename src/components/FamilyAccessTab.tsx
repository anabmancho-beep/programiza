import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms";
import { Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { errMsg } from "@/lib/constants";

export function FamilyAccessTab({ personId, granted }: { personId: string; granted: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["family", personId],
    queryFn: async () => {
      const [inv, links] = await Promise.all([
        supabase.from("family_invites").select("id, email, token, created_at, expires_at, accepted_at, accepted_by").eq("person_id", personId).order("created_at", { ascending: false }),
        supabase.from("family_links").select("id, user_id, created_at").eq("person_id", personId),
      ]);
      if (inv.error) throw inv.error;
      if (links.error) throw links.error;
      return { invites: inv.data, links: links.data };
    },
  });
  const urlFor = (t: string) => `${window.location.origin}/invitacion/${t}`;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { toast.error("Escribe un correo válido"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_family_invite", { _person_id: personId, _email: email.trim() });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    setLink(urlFor(data));
    setEmail("");
    qc.invalidateQueries({ queryKey: ["family", personId] });
  }
  async function copy(t: string) { await navigator.clipboard.writeText(t); toast.success("Enlace copiado"); }
  async function revokeInvite(id: string) {
    const { error } = await supabase.from("family_invites").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    qc.invalidateQueries({ queryKey: ["family", personId] });
  }
  async function removeLink(id: string) {
    if (!confirm("¿Retirar el acceso de este familiar? Dejará de ver la agenda y los informes.")) return;
    const { error } = await supabase.from("family_links").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Acceso retirado");
    qc.invalidateQueries({ queryKey: ["family", personId] });
  }

  const emailOf = (uid: string) => q.data?.invites.find((i) => i.accepted_by === uid)?.email ?? "Familiar";

  return (
    <div className="mt-4 space-y-4">
      <Notice title="Qué ve la familia">Solo en modo lectura: la agenda semanal (actividades aprobadas) y los informes aprobados que marquéis como «Compartir con la familia». Nunca ve adaptaciones, observaciones, conductas, salud ni a otras personas.</Notice>
      {!granted ? <Notice title="Consentimiento no otorgado">No se puede invitar a la familia hasta que el consentimiento esté «otorgado». Si se retira, la familia pierde el acceso al momento.</Notice> : (
        <form onSubmit={invite} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-5">
          <Field id="fe" label="Correo del familiar o tutor legal"><Input id="fe" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} className="min-w-64" /></Field>
          <Button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear invitación"}</Button>
          <p className="basis-full text-sm text-muted-foreground">Se genera un enlace válido 14 días. Envíalo tú a la familia. Solo podrá usarlo quien inicie sesión con ese correo.</p>
        </form>
      )}
      {link && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-primary bg-secondary p-4" role="status">
          <span className="break-all font-mono text-sm">{link}</span>
          <Button size="sm" onClick={() => copy(link)}><Copy className="mr-1 h-4 w-4" />Copiar enlace</Button>
        </div>
      )}
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <>
          <section>
            <h3 className="mb-2 text-lg font-semibold">Familiares con acceso</h3>
            {q.data!.links.length === 0 ? <Empty title="Nadie tiene acceso todavía" /> : (
              <ul className="space-y-2">{q.data!.links.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
                  <span>{emailOf(l.user_id)} · desde {new Date(l.created_at).toLocaleDateString("es-ES")}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeLink(l.id)}>Retirar acceso</Button>
                </li>
              ))}</ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-lg font-semibold">Invitaciones</h3>
            {q.data!.invites.length === 0 ? <p className="text-muted-foreground">Sin invitaciones.</p> : (
              <ul className="space-y-2">{q.data!.invites.map((i) => {
                const st = i.accepted_at ? "Aceptada" : new Date(i.expires_at) < new Date() ? "Caducada" : "Pendiente";
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
                    <span>{i.email} · <strong>{st}</strong></span>
                    <span className="flex gap-1">
                      {st === "Pendiente" && <Button size="sm" variant="outline" onClick={() => copy(urlFor(i.token))}><Copy className="mr-1 h-4 w-4" />Copiar enlace</Button>}
                      {st !== "Aceptada" && <Button size="sm" variant="ghost" onClick={() => revokeInvite(i.id)}>Anular</Button>}
                    </span>
                  </li>
                );
              })}</ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
