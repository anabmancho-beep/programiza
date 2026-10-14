import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/constants";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña · Programiza" },
      { name: "description", content: "Establece una nueva contraseña para tu cuenta de Programiza." },
      { property: "og:title", content: "Nueva contraseña · Programiza" },
      { property: "og:description", content: "Establece una nueva contraseña para tu cuenta." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Mínimo 8 caracteres");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Contraseña actualizada");
    navigate({ to: "/inicio" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-calm p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-card p-8 shadow-soft">
        <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
        <Label htmlFor="pw">Contraseña nueva</Label>
        <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required autoComplete="new-password" />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
      </form>
    </div>
  );
}
