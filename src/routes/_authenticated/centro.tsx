import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/forms";
import { PageHeader, Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { ROLE_LABELS, errMsg } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/centro")({
  head: () => ({ meta: [{ title: "Centro y equipo · Programiza" }, { name: "description", content: "Gestión del equipo, roles y registro de accesos." }, { property: "og:title", content: "Centro y equipo · Programiza" }, { property: "og:description", content: "Equipo, roles y registro de accesos." }] }),
  component: Centro,
});

type Role = "admin" | "educador" | "profesional" | "familia";

function Centro() {
  const me = useMe();
  const qc = useQueryClient();
  const team = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id, display_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      return r.data.map((x) => ({ ...x, name: p.data.find((y) => y.id === x.user_id)?.display_name ?? "Sin nombre" }));
    },
  });
  const logs = useQuery({
    queryKey: ["logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("access_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  if (me.data?.role !== "admin") return <Notice title="Solo para administración">Esta sección es exclusiva de la administración del centro.</Notice>;

  async function setRole(uid: string, role: Role) {
    const { error } = await supabase.rpc("assign_role", { _user_id: uid, _role: role });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Rol actualizado");
    qc.invalidateQueries({ queryKey: ["team"] });
  }
  async function regen() {
    if (!confirm("El código actual dejará de funcionar. ¿Continuar?")) return;
    const { error } = await supabase.rpc("regenerate_join_code");
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Código regenerado");
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  const nameOf = (uid: string) => team.data?.find((t) => t.user_id === uid)?.name ?? "Usuario";

  return (
    <div>
      <PageHeader title="Centro y equipo" subtitle={me.data.center?.name} />
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
        <div><p className="text-muted-foreground">Código para unirse al centro</p><p className="font-mono text-3xl tracking-widest">{me.data.center?.join_code}</p>
          <p className="text-sm text-muted-foreground">Quien se una entra como educador/a; después puedes cambiar su rol.</p></div>
        <Button variant="outline" onClick={regen}><RefreshCw className="mr-2 h-4 w-4" />Regenerar código</Button>
      </section>
      <Tabs defaultValue="equipo">
        <TabsList><TabsTrigger value="equipo">Equipo</TabsTrigger><TabsTrigger value="registro">Registro de accesos</TabsTrigger></TabsList>
        <TabsContent value="equipo">
          {team.isLoading ? <Loading /> : team.error ? <ErrorBox error={team.error} /> : (
            <ul className="mt-4 divide-y rounded-xl border bg-card">
              {team.data!.map((t) => (
                <li key={t.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <span className="font-bold">{t.name}{t.user_id === me.data!.userId && " (tú)"}</span>
                  {t.user_id === me.data!.userId ? <span>{ROLE_LABELS[t.role]}</span> : (
                    <NativeSelect className="w-64" aria-label={`Rol de ${t.name}`} value={t.role} onChange={(e) => setRole(t.user_id, e.target.value as Role)}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="registro">
          {logs.isLoading ? <Loading /> : logs.error ? <ErrorBox error={logs.error} /> : logs.data!.length === 0 ? <Empty title="Sin accesos registrados" /> : (
            <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-left">
                <caption className="sr-only">Últimos 200 accesos a fichas</caption>
                <thead className="bg-muted"><tr><th className="p-3">Fecha</th><th className="p-3">Usuario</th><th className="p-3">Ficha</th><th className="p-3">Acción</th></tr></thead>
                <tbody>{logs.data!.map((l) => (
                  <tr key={l.id} className="border-t"><td className="p-3">{new Date(l.created_at).toLocaleString("es-ES")}</td><td className="p-3">{nameOf(l.user_id)}</td><td className="p-3">{l.person_code ?? "(anonimizada)"}</td><td className="p-3 capitalize">{l.action}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
