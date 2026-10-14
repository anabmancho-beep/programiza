import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/constants";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceder · Programiza" },
      { name: "description", content: "Inicia sesión o crea tu cuenta en Programiza." },
      { property: "og:title", content: "Acceder · Programiza" },
      { property: "og:description", content: "Inicia sesión o crea tu cuenta en Programiza." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Introduce un correo válido");
    if (mode !== "forgot" && password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/inicio" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/inicio", data: { display_name: name.trim() || undefined } },
        });
        if (error) throw error;
        setSent("Te hemos enviado un correo para confirmar tu cuenta. Ábrelo para continuar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setSent("Si el correo existe, recibirás un enlace para restablecer la contraseña.");
      }
    } catch (err) {
      toast.error(errMsg(err) === "Invalid login credentials" ? "Correo o contraseña incorrectos" : errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error(errMsg(r.error));
    if (r.redirected) return;
    navigate({ to: "/inicio" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-calm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-soft">
        <Link to="/" className="mb-6 flex items-center gap-2 font-display text-2xl"><Sprout className="h-7 w-7 text-primary" aria-hidden />Programiza</Link>
        <h1 className="mb-6 text-2xl font-semibold">
          {mode === "login" ? "Iniciar sesión" : mode === "signup" ? "Crear cuenta" : "Recuperar contraseña"}
        </h1>
        {sent ? (
          <div role="status" className="space-y-4"><p>{sent}</p><Button variant="outline" onClick={() => { setSent(null); setMode("login"); }}>Volver</Button></div>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-4" noValidate>
              {mode === "signup" && (
                <div className="space-y-1.5"><Label htmlFor="name">Tu nombre (opcional)</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" /></div>
              )}
              <div className="space-y-1.5"><Label htmlFor="email">Correo electrónico</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
              {mode !== "forgot" && (
                <div className="space-y-1.5"><Label htmlFor="pw">Contraseña</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Un momento…" : mode === "login" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Enviar enlace"}
              </Button>
            </form>
            {mode !== "forgot" && (
              <>
                <div className="my-4 text-center text-sm text-muted-foreground">o</div>
                <Button variant="outline" className="w-full" onClick={google}>Continuar con Google</Button>
              </>
            )}
            <div className="mt-6 flex flex-col gap-2 text-sm">
              {mode === "login" ? (
                <>
                  <button className="text-left underline" onClick={() => setMode("signup")}>¿No tienes cuenta? Crea una</button>
                  <button className="text-left underline" onClick={() => setMode("forgot")}>He olvidado mi contraseña</button>
                </>
              ) : (
                <button className="text-left underline" onClick={() => setMode("login")}>Ya tengo cuenta</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
