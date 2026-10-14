import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { errMsg } from "@/lib/constants";

export function Onboarding({ onSignOut }: { onSignOut: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: string, fn: () => Promise<{ error: unknown }>, ok: string) {
    setBusy(kind);
    const { error } = await fn();
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    toast.success(ok);
    qc.invalidateQueries();
  }

  return (
    <div className="min-h-screen bg-calm p-4 sm:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3"><Sprout className="h-8 w-8 text-primary" aria-hidden /><h1 className="text-3xl font-semibold">Bienvenida a Programiza</h1></div>
        <p className="text-lg">Para empezar, crea tu centro (serás su administrador/a) o únete a uno con el código que te facilite tu administración.</p>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader><CardTitle>Crear un centro</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) return toast.error("Escribe el nombre del centro"); run("create", async () => await supabase.rpc("create_center", { _name: name.trim() }), "Centro creado"); }}>
                <Label htmlFor="cname">Nombre del centro</Label>
                <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
                <Button type="submit" disabled={!!busy} className="w-full">{busy === "create" ? "Creando…" : "Crear centro"}</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader><CardTitle>Unirme a un centro</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (code.trim().length < 4) return toast.error("Introduce el código"); run("join", async () => await supabase.rpc("join_center", { _code: code.trim() }), "Te has unido al centro"); }}>
                <Label htmlFor="ccode">Código del centro</Label>
                <Input id="ccode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} required />
                <Button type="submit" variant="secondary" disabled={!!busy} className="w-full">{busy === "join" ? "Uniendo…" : "Unirme"}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <p>¿Solo quieres probar? Crea un centro de demostración con 4 personas ficticias y programaciones de muestra.</p>
            <Button variant="outline" disabled={!!busy} onClick={() => run("demo", async () => await supabase.rpc("load_demo_data"), "Datos de ejemplo cargados")}>
              {busy === "demo" ? "Cargando…" : "Cargar datos de ejemplo"}
            </Button>
          </CardContent>
        </Card>
        <button onClick={onSignOut} className="underline">Cerrar sesión</button>
      </div>
    </div>
  );
}
