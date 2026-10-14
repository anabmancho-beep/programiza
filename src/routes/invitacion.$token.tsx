import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loading, Notice } from "@/components/states";
import { errMsg } from "@/lib/constants";

export const PENDING_INVITE_KEY = "programiza.invite";

export const Route = createFileRoute("/invitacion/$token")({
  head: () => ({ meta: [
    { title: "Invitación para familias · Programiza" },
    { name: "description", content: "Acepta la invitación del centro para ver la agenda y los informes compartidos." },
    { property: "og:title", content: "Invitación para familias · Programiza" },
    { property: "og:description", content: "Acceso de solo lectura para familias y tutores legales." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Invite,
});

const STATUS: Record<string, string> = {
  no_valida: "Esta invitación no existe o ha sido anulada.",
  usada: "Esta invitación ya se ha usado.",
  caducada: "Esta invitación ha caducado. Pide una nueva al centro.",
};

function Invite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [state, setState] = useState<{ signedIn: boolean; email: string | null; status: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { localStorage.setItem(PENDING_INVITE_KEY, token); setState({ signedIn: false, email: null, status: "pendiente" }); return; }
      const { data: st } = await supabase.rpc("invite_status", { _token: token });
      setState({ signedIn: true, email: data.user.email ?? null, status: st ?? "no_valida" });
    })();
  }, [token]);

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc("accept_family_invite", { _token: token });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    localStorage.removeItem(PENDING_INVITE_KEY);
    toast.success("Acceso activado");
    qc.invalidateQueries();
    navigate({ to: "/inicio" });
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-6 sm:p-10">
      <h1 className="text-3xl font-semibold">Invitación para la familia</h1>
      <p>El centro te invita a ver, en modo lectura, la agenda semanal y los informes que comparta contigo.</p>
      {!state ? <Loading /> : !state.signedIn ? (
        <>
          <Notice title="Inicia sesión para continuar">Entra o crea tu cuenta con el mismo correo al que te ha llegado la invitación. Después vuelve a abrir este enlace.</Notice>
          <Button asChild><Link to="/auth">Entrar o crear cuenta</Link></Button>
        </>
      ) : STATUS[state.status] ? <Notice title="No se puede usar">{STATUS[state.status]}</Notice> : (
        <>
          <p>Has iniciado sesión como <strong>{state.email}</strong>.</p>
          <Button onClick={accept} disabled={busy}>{busy ? "Activando…" : "Aceptar invitación"}</Button>
        </>
      )}
      <p className="text-sm"><Link to="/privacidad" className="underline">Privacidad y datos</Link></p>
    </div>
  );
}
